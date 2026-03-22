// ═══════════════════════════════════════════════════════════════
// stockfishPool.ts — Worker Pool для Stockfish (OPT-6)
//
// ПРОБЛЕМА: Сейчас каждый ход создаёт новый Worker Thread.
// При 150 партиях → 150 параллельных процессов → CPU crash.
//
// РЕШЕНИЕ: Pool из MAX_WORKERS воркеров.
// Когда все заняты — запрос встаёт в очередь.
// При освобождении воркера — следующий из очереди получает его.
// ═══════════════════════════════════════════════════════════════
import { Worker } from "worker_threads";
import path from "path";
import { logger } from "@/lib/logger";

// Максимум параллельных Stockfish воркеров
// Каждый воркер = 1 WASM engine + 1 Node.js thread (~50-80MB RAM)
// 2 CPU / 2GB RAM: max 4 воркеров | 4 CPU: 8 | 8 CPU: 16
const MAX_WORKERS = Number(process.env.STOCKFISH_POOL_SIZE ?? 4);
const WORKER_PATH  = path.join(__dirname, "stockfishWorker.js");

interface PoolWorker {
  worker: Worker;
  busy:   boolean;
}

interface QueueItem {
  resolve: (worker: Worker) => void;
  reject:  (err: Error) => void;
  timeout: NodeJS.Timeout;
}

class StockfishPool {
  private pool:  PoolWorker[] = [];
  private queue: QueueItem[]  = [];

  private createWorker(): Worker {
    const w = new Worker(WORKER_PATH);
    w.on("error", (err) => {
      logger.warn("[StockfishPool] Worker error:", err.message);
      // Удаляем сломанный воркер из пула
      const idx = this.pool.findIndex(p => p.worker === w);
      if (idx !== -1) this.pool.splice(idx, 1);
    });
    return w;
  }

  // Получить свободный воркер (или встать в очередь)
  acquire(timeoutMs = 10_000): Promise<Worker> {
    // Есть свободный в пуле?
    const free = this.pool.find(p => !p.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free.worker);
    }

    // Пул не заполнен — создаём новый
    if (this.pool.length < MAX_WORKERS) {
      const worker = this.createWorker();
      this.pool.push({ worker, busy: true });
      logger.info(`[StockfishPool] Created worker #${this.pool.length}/${MAX_WORKERS}`);
      return Promise.resolve(worker);
    }

    // Все заняты — встаём в очередь
    logger.warn(`[StockfishPool] All ${MAX_WORKERS} workers busy, queuing (queue size: ${this.queue.length + 1})`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Таймаут — убираем из очереди и возвращаем ошибку
        const idx = this.queue.findIndex(q => q.resolve === resolve);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error("StockfishPool timeout: все воркеры заняты"));
      }, timeoutMs);

      this.queue.push({ resolve, reject, timeout });
    });
  }

  // Вернуть воркер в пул
  release(worker: Worker): void {
    const poolEntry = this.pool.find(p => p.worker === worker);
    if (!poolEntry) return;

    // Сбрасываем состояние воркера (отправляем stop)
    try { worker.postMessage({ type: "stop" }); } catch {}

    // Есть ожидающие в очереди?
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timeout);
      next.resolve(worker); // отдаём воркер следующему
    } else {
      poolEntry.busy = false; // возвращаем в пул как свободный
    }
  }

  // Статистика (для /health endpoint)
  stats() {
    return {
      total:  this.pool.length,
      busy:   this.pool.filter(p => p.busy).length,
      free:   this.pool.filter(p => !p.busy).length,
      queued: this.queue.length,
      max:    MAX_WORKERS,
    };
  }

  // Graceful shutdown
  async shutdown() {
    for (const { worker } of this.pool) {
      await worker.terminate();
    }
    this.pool = [];
    logger.info("[StockfishPool] Shutdown complete");
  }
}

// Синглтон — один пул на весь процесс
export const stockfishPool = new StockfishPool();
