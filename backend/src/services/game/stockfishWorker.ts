/**
 * stockfishWorker.ts
 * Запускается как Worker Thread — не блокирует основной event loop.
 * Общается с основным потоком через parentPort.
 *
 * stockfish@16 API (WASM):
 *   const sf = require("stockfish/src/stockfish-nnue-16-single.js");
 *   const engine = await sf()();  // двойная фабрика, возвращает Promise
 *   engine.postMessage("uci");
 *   engine.addMessageListener((line: string) => { ... });
 *
 * Протокол:
 *   → { fen, level, requestId }             — посчитать лучший ход
 *   ← { move: {from,to} | null, requestId } — ответ
 */

import { parentPort } from "worker_threads";
import { Chess } from "chess.js";
import * as fs from "fs";

const DEBUG_LOG = "c:\\Users\\SAM\\Desktop\\chesscoin\\backend\\sf_debug.log";
function dlog(msg: string) {
  try { fs.appendFileSync(DEBUG_LOG, new Date().toISOString() + " " + msg + "\n"); } catch {}
}

// Minimal logger for worker thread (pino not available in workers)
const log = {
  info: (...args: unknown[]) => console.log("[StockfishWorker]", ...args),
  warn: (...args: unknown[]) => console.warn("[StockfishWorker]", ...args),
  error: (...args: unknown[]) => console.error("[StockfishWorker]", ...args),
  debug: (...args: unknown[]) => {}, // silent in prod
};

// ─── Уровни J.A.R.V.I.S (20 уровней) ────────────────────────────────────────
//
// СТРАТЕГИЯ (учит старый v1.0.2 архив):
//   randomPct  → % случайных ходов вместо Stockfish (ключевой элемент слабости!)
//               Уровень 1: 70% случайных ходов, уровень 7: 15%, уровень 12+: 0%
//               Без этого Stockfish на Skill=0 всё равно играет сильнее новичка
//   depthOnly  → false: go movetime X depth Y (первое условие wins — для слабых уровней)
//               true:  go depth X            (гарантирует глубину на медленном VPS)
//   contempt   → -100 для уровней 1-3: движок менее агрессивен, охотнее соглашается на ничью
//
const JARVIS_LEVELS = [
  // 1-5: Novice (800-1600 Elo) — слабая игра через:
  //   1) большой % случайных ходов (70%→15%)
  //   2) короткий movetime + малая глубина
  //   3) низкий Skill Level + UCI_Elo ограничение
  { level: 1,  elo: 800,  movetime: 50,    useSkill: true,  skill: 0,  depth: 1,  depthOnly: false, randomPct: 70, contempt: -100 },
  { level: 2,  elo: 900,  movetime: 80,    useSkill: true,  skill: 1,  depth: 2,  depthOnly: false, randomPct: 55, contempt: -100 },
  { level: 3,  elo: 1100, movetime: 150,   useSkill: true,  skill: 2,  depth: 3,  depthOnly: false, randomPct: 40, contempt: -100 },
  { level: 4,  elo: 1300, movetime: 300,   useSkill: true,  skill: 4,  depth: 5,  depthOnly: false, randomPct: 25, contempt: 0   },
  { level: 5,  elo: 1500, movetime: 500,   useSkill: true,  skill: 6,  depth: 7,  depthOnly: false, randomPct: 15, contempt: 0   },

  // 6-10: Intermediate (1700-2200 Elo) — depth-only гарантирует силу на медленном VPS
  //   небольшой % случайных ходов (8%→2%) оставляем для реализма
  { level: 6,  elo: 1700, movetime: 5000,  useSkill: true,  skill: 9,  depth: 9,  depthOnly: true,  randomPct: 8,  contempt: 0   },
  { level: 7,  elo: 1800, movetime: 5000,  useSkill: true,  skill: 11, depth: 10, depthOnly: true,  randomPct: 5,  contempt: 0   },
  { level: 8,  elo: 1950, movetime: 5000,  useSkill: true,  skill: 13, depth: 11, depthOnly: true,  randomPct: 3,  contempt: 0   },
  { level: 9,  elo: 2100, movetime: 8000,  useSkill: true,  skill: 14, depth: 12, depthOnly: true,  randomPct: 2,  contempt: 0   },
  { level: 10, elo: 2200, movetime: 8000,  useSkill: true,  skill: 15, depth: 13, depthOnly: true,  randomPct: 1,  contempt: 0   },

  // 11-15: Advanced (2300-2700 Elo) — movetime-based (НЕ depthOnly!)
  // depthOnly для depth 14-20 вызывал таймаут на медленном VPS → случайный ход
  // movetime 8-12 секунд гарантирует достижение depth 12-16 + UCI_Elo ограничивает силу
  { level: 11, elo: 2300, movetime: 8000,  useSkill: true,  skill: 16, depth: 14, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 12, elo: 2400, movetime: 9000,  useSkill: true,  skill: 17, depth: 15, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 13, elo: 2500, movetime: 10000, useSkill: true,  skill: 18, depth: 16, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 14, elo: 2600, movetime: 11000, useSkill: true,  skill: 19, depth: 18, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 15, elo: 2700, movetime: 12000, useSkill: false, skill: 20, depth: 20, depthOnly: false, randomPct: 0,  contempt: 0   },

  // 16-20: Unbeatable (2800-3200+ Elo) — полная сила, movetime как страховка от OOM
  { level: 16, elo: 2800, movetime: 5000,  useSkill: false, skill: 20, depth: 16, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 17, elo: 2900, movetime: 6000,  useSkill: false, skill: 20, depth: 17, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 18, elo: 3000, movetime: 7000,  useSkill: false, skill: 20, depth: 18, depthOnly: false, randomPct: 0,  contempt: 0   },
  { level: 19, elo: 3100, movetime: 8000,  useSkill: false, skill: 20, depth: 19, depthOnly: false, randomPct: 0,  contempt: 0   },
  // 20: Mystic (Magnus level)
  { level: 20, elo: 3200, movetime: 10000, useSkill: false, skill: 20, depth: 20, depthOnly: false, randomPct: 0,  contempt: 0   },
];

// ─── Fallback: случайный ход ──────────────────────────────────────────────────
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

// ─── Парсинг UCI хода ─────────────────────────────────────────────────────────
function parseUciMove(uciMove: string): { from: string; to: string } | null {
  if (!uciMove || uciMove === "(none)") return null;
  const from = uciMove.slice(0, 2);
  const to   = uciMove.slice(2, 4);
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;
  return { from, to };
}

// ─── Stockfish Engine Interface ───────────────────────────────────────────────
interface StockfishEngine {
  postMessage(msg: string): void;
  addMessageListener(fn: (line: string) => void): void;
  removeMessageListener(fn: (line: string) => void): void;
  terminate(): void;
}

// ─── Async initialization ─────────────────────────────────────────────────────
let engine: StockfishEngine | null = null;
let initError: string | null = null;
let engineReady = false; // true after "readyok"

async function initEngine(): Promise<void> {
  try {
    // stockfish@16: require returns factory, factory() returns factory2, factory2() returns Promise<engine>
    const sf = require("stockfish/src/stockfish-nnue-16-single.js");
    engine = await sf()() as StockfishEngine;

    // Wait for UCI + readyok
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("UCI init timeout")), 10000);

      const listener = (line: string) => {
        if (line === "uciok") {
          engine!.postMessage("isready");
        }
        if (line === "readyok") {
          clearTimeout(timeout);
          engineReady = true;
          engine!.removeMessageListener(listener);
          resolve();
        }
      };
      engine!.addMessageListener(listener);
      engine!.postMessage("uci");
    });

    log.info("Engine initialized successfully (WASM single-threaded)");
  } catch (e: unknown) {
    initError = e instanceof Error ? e.message : String(e);
    log.error("Failed to initialize:", initError);
  }
}

// Start initialization immediately
const initPromise = initEngine();

// ─── Handle requests from main thread ─────────────────────────────────────────
parentPort?.on("message", async ({ fen, level, requestId }: {
  fen: string;
  level: number;
  requestId: string;
}) => {
  // Wait for engine init on first request
  await initPromise;

  const cfg = JARVIS_LEVELS[Math.max(0, Math.min(19, level - 1))];

  // Fallback if engine not available
  if (!engine || !engineReady || initError) {
    log.warn("Using random fallback, reason:", initError ?? "engine not ready");
    parentPort?.postMessage({ move: getRandomMove(fen), requestId });
    return;
  }

  // ── Случайный ход (ключевой элемент слабости для низких уровней) ────────────
  // Из анализа v1.0.2: уровень 1 → 70% случайных, уровень 7 → 5%, 12+ → 0%
  // Без этого Stockfish даже на Skill=0 играет намного сильнее реального новичка
  if ((cfg as any).randomPct > 0) {
    const roll = Math.floor(Math.random() * 100);
    if (roll < (cfg as any).randomPct) {
      dlog(`[RANDOM] level ${level}, roll ${roll} < ${(cfg as any).randomPct}% → random move`);
      parentPort?.postMessage({ move: getRandomMove(fen), requestId });
      return;
    }
  }

  const timeoutMs = cfg.movetime + 4000;

  try {
    const move = await new Promise<{ from: string; to: string } | null>((resolve) => {
      let isSearching = false;
      let resolved = false;

      const saferesolve = (v: { from: string; to: string } | null) => {
        if (!resolved) {
          resolved = true;
          engine!.removeMessageListener(listener);
          resolve(v);
        }
      };

      const timer = setTimeout(() => {
        if ((cfg as any).depthOnly && engine && !resolved) {
          // depthOnly: отправляем stop — движок вернёт bestmove из текущей глубины поиска
          dlog(`[TIMEOUT] depthOnly level ${level}, sending stop to get partial bestmove`);
          log.warn(`depthOnly timeout (${timeoutMs}ms) at level ${level}, sending stop`);
          engine.postMessage("stop");
          // Жёсткий таймаут 3с если stop не даёт ответа (крайне редко)
          setTimeout(() => {
            if (!resolved) {
              dlog(`[TIMEOUT] Hard timeout after stop, random fallback`);
              saferesolve(getRandomMove(fen));
            }
          }, 3000);
        } else {
          log.warn("Timeout, using random fallback");
          saferesolve(getRandomMove(fen));
        }
      }, timeoutMs);

      const listener = (line: string) => {
        dlog("[SF OUT] " + line);
        if (line === "readyok" && !isSearching) {
          isSearching = true;
          // Engine ready for this request — send options and go
          const send = (m: string) => { dlog("[SF IN] " + m); engine!.postMessage(m); };

          // Память для стабильной работы глубоких уровней
          send("setoption name Hash value 16");
          send("setoption name Threads value 1");

          // Contempt: отрицательный = движок охотнее соглашается на ничью и менее агрессивен
          // Используется для уровней 1-3 (из v1.0.2: contempt -100 создаёт пассивную игру)
          const contemptVal = (cfg as any).contempt ?? 0;
          // Stockfish 14+ убрал Contempt, но попробуем — будет молча проигнорировано если не поддерживается
          if (contemptVal !== 0) {
            send(`setoption name Contempt value ${contemptVal}`);
          } else {
            send("setoption name Contempt value 0");
          }

          if (cfg.useSkill) {
            send("setoption name UCI_LimitStrength value true");
            send(`setoption name UCI_Elo value ${cfg.elo}`);
            send(`setoption name Skill Level value ${cfg.skill}`);
          } else {
            send("setoption name UCI_LimitStrength value false");
            send("setoption name Skill Level value 20");
          }
          send(`position fen ${fen}`);
          // depthOnly: true → гарантированная глубина (для средних/сильных уровней)
          // depthOnly: false → movetime+depth (первое условие останавливает — для слабых уровней)
          if ((cfg as any).depthOnly) {
            send(`go depth ${cfg.depth}`);
          } else {
            send(`go movetime ${cfg.movetime} depth ${cfg.depth}`);
          }
          return;
        }

        if (isSearching && line.startsWith("bestmove")) {
          clearTimeout(timer);
          const uciMove = line.split(" ")[1];
          const parsed = parseUciMove(uciMove);
          saferesolve(parsed ?? getRandomMove(fen));
        }
      };

      const send = (m: string) => { dlog("[SF IN] " + m); engine!.postMessage(m); };
      engine!.addMessageListener(listener);
      // Reset engine state and wait for readyok
      send("stop");
      send("ucinewgame");
      send("isready");
    });

    dlog(`[WORKER] Resolved move: ${JSON.stringify(move)}`);
    parentPort?.postMessage({ move, requestId });
  } catch (err: unknown) {
    dlog(`[WORKER ERROR] ${err instanceof Error ? err.message : String(err)}`);
    log.error("Unexpected error:", err instanceof Error ? err.message : String(err));
    parentPort?.postMessage({ move: getRandomMove(fen), requestId });
  }
});

dlog("[WORKER] Booted up, signaling ready");
// Signal ready to main thread
parentPort?.postMessage({ ready: true });
