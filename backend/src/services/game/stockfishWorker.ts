/**
import { logger, logError } from "@/lib/logger";
 * stockfishWorker.ts
 * Запускается как Worker Thread — не блокирует основной event loop.
 * Общается с основным потоком через parentPort.
 *
 * Протокол сообщений:
 *   → { fen, level, requestId }       — посчитать лучший ход
 *   ← { move: {from,to} | null, requestId }  — ответ
 */

import { parentPort } from "worker_threads";
import { Chess } from "chess.js";

// ─── Уровни J.A.R.V.I.S (20 уровней) ────────────────────────────────────────
// elo: целевой UCI_Elo для Stockfish (1320–3190)
// movetime: сколько мс думает движок
// useSkill: true = использовать Skill Level (слабее), false = полная сила с ограничением времени
const JARVIS_LEVELS = [
  { level: 1,  elo: 1320, movetime: 50,   useSkill: true,  skill: 0  },
  { level: 2,  elo: 1400, movetime: 80,   useSkill: true,  skill: 1  },
  { level: 3,  elo: 1500, movetime: 120,  useSkill: true,  skill: 2  },
  { level: 4,  elo: 1600, movetime: 180,  useSkill: true,  skill: 3  },
  { level: 5,  elo: 1700, movetime: 250,  useSkill: true,  skill: 5  },
  { level: 6,  elo: 1800, movetime: 350,  useSkill: true,  skill: 6  },
  { level: 7,  elo: 1900, movetime: 500,  useSkill: true,  skill: 8  },
  { level: 8,  elo: 2000, movetime: 700,  useSkill: true,  skill: 10 },
  { level: 9,  elo: 2100, movetime: 1000, useSkill: true,  skill: 12 },
  { level: 10, elo: 2200, movetime: 1400, useSkill: true,  skill: 14 },
  { level: 11, elo: 2300, movetime: 1800, useSkill: true,  skill: 15 },
  { level: 12, elo: 2400, movetime: 2200, useSkill: true,  skill: 16 },
  { level: 13, elo: 2500, movetime: 2700, useSkill: true,  skill: 17 },
  { level: 14, elo: 2600, movetime: 3200, useSkill: true,  skill: 18 },
  { level: 15, elo: 2700, movetime: 3500, useSkill: true,  skill: 19 },
  { level: 16, elo: 2800, movetime: 4000, useSkill: false, skill: 20 },
  { level: 17, elo: 2900, movetime: 4500, useSkill: false, skill: 20 },
  { level: 18, elo: 3000, movetime: 5000, useSkill: false, skill: 20 },
  { level: 19, elo: 3100, movetime: 5500, useSkill: false, skill: 20 },
  { level: 20, elo: 3190, movetime: 6000, useSkill: false, skill: 20 },
];

// ─── Fallback: случайный ход (если Stockfish не ответил) ──────────────────────
function getRandomMove(fen: string): { from: string; to: string } | null {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to };
  } catch {
    return null;
  }
}

// ─── Парсинг хода из UCI-ответа Stockfish ────────────────────────────────────
// Stockfish отвечает строкой вида: "bestmove e2e4 ponder d7d5"
function parseUciMove(uciMove: string): { from: string; to: string } | null {
  if (!uciMove || uciMove === "(none)") return null;
  // UCI формат: e2e4, e7e5, e1g1 (рокировка), e7e8q (промоция)
  const from = uciMove.slice(0, 2);
  const to   = uciMove.slice(2, 4);
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;
  return { from, to };
}

// ─── Инициализация Stockfish ──────────────────────────────────────────────────
// stockfish npm пакет экспортирует фабрику движка с UCI интерфейсом
let stockfishFactory: unknown = null;
let initError: string | null = null;

try {
  // stockfish@16 поставляет WASM + JS fallback
  stockfishFactory = require("stockfish");
} catch (e: unknown) {
  initError = (e instanceof Error ? e.message : String(e));
  logger.error("[StockfishWorker] Failed to load stockfish:", (e instanceof Error ? e.message : String(e)));
}

// ─── Обработка запросов от основного потока ───────────────────────────────────
parentPort?.on("message", async ({ fen, level, requestId }: {
  fen: string;
  level: number;
  requestId: string;
}) => {
  const cfg = JARVIS_LEVELS[Math.max(0, Math.min(19, level - 1))];

  // Если stockfish не загрузился — отдаём случайный ход
  if (!stockfishFactory || initError) {
    logger.warn("[StockfishWorker] Using random fallback, reason:", initError);
    parentPort?.postMessage({ move: getRandomMove(fen), requestId });
    return;
  }

  const timeoutMs = cfg.movetime + 4000; // запас 4 сек сверх movetime

  try {
    const move = await new Promise<{ from: string; to: string } | null>((resolve) => {
      let resolved = false;
      const saferesolve = (v: { from: string; to: string } | null) => {
        if (!resolved) { resolved = true; resolve(v); }
      };

      const timer = setTimeout(() => {
        logger.warn("[StockfishWorker] Timeout, using random fallback");
        saferesolve(getRandomMove(fen));
      }, timeoutMs);

      let engine: Record<string,unknown> & { postMessage: (m: string) => void; onmessage: ((e: { data: string }) => void) | null };
      try {
        engine = (stockfishFactory as unknown as () => typeof engine)();
      } catch (e: unknown) {
        clearTimeout(timer);
        logger.warn("[StockfishWorker] Engine init error:", (e instanceof Error ? e.message : String(e)));
        saferesolve(getRandomMove(fen));
        return;
      }

      // J3: Правильная UCI последовательность с ожиданием uciok и readyok
      // Только после readyok можно слать setoption и go
      let uciOk = false;
      let readyOk = false;

      engine.onmessage = (event: { data: string }) => {
        const line: string = typeof event === "string" ? event : (event?.data ?? "");

        if (line === "uciok") {
          uciOk = true;
          // После uciok отправляем isready
          engine.postMessage("isready");
          return;
        }

        if (line === "readyok" && !readyOk) {
          readyOk = true;
          // J3: теперь движок готов — можно слать настройки и команду go
          if (cfg.useSkill) {
            // Уровни 1-15: ограничиваем через Skill Level + UCI_LimitStrength + UCI_Elo
            engine.postMessage("setoption name UCI_LimitStrength value true");
            engine.postMessage(`setoption name UCI_Elo value ${cfg.elo}`);
            engine.postMessage(`setoption name Skill Level value ${cfg.skill}`);
          } else {
            // Уровни 16-20: полная сила Stockfish, только лимит по времени
            engine.postMessage("setoption name UCI_LimitStrength value false");
            engine.postMessage(`setoption name Skill Level value 20`);
          }
          engine.postMessage(`position fen ${fen}`);
          engine.postMessage(`go movetime ${cfg.movetime}`);
          return;
        }

        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          const parts = line.split(" ");
          const uciMove = parts[1];
          const parsed = parseUciMove(uciMove);
          logger.debug(`[JARVIS] Lv${level} elo=${cfg.elo} movetime=${cfg.movetime}ms → ${uciMove}`);

          try { engine.postMessage("quit"); } catch {}
          saferesolve(parsed ?? getRandomMove(fen));
        }
      };

      // Стартуем UCI
      engine.postMessage("uci");
    });

    parentPort?.postMessage({ move, requestId });
  } catch (err: unknown) {
    logger.error("[StockfishWorker] Unexpected error:", (err instanceof Error ? err.message : String(err)));
    parentPort?.postMessage({ move: getRandomMove(fen), requestId });
  }
});

// Сигнализируем основному потоку что воркер готов
parentPort?.postMessage({ ready: true });
