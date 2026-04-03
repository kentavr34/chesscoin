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
// СТРАТЕГИЯ:
//   depthOnly: false → go movetime X depth Y  (останавливается первым условием — для слабых уровней)
//   depthOnly: true  → go depth X             (гарантирует достижение заданной глубины — для средних/сильных)
//
// Уровни 1-5: короткий movetime → движок останавливается до нужной глубины → специально слабая игра
// Уровни 6-15: depth-only → гарантированная сила независимо от скорости VPS
// Уровни 16-20: долгий movetime без ограничения глубины → максимальный расчёт
//
const JARVIS_LEVELS = [
  // 1-5: Novice (800-1600 Elo) — специально ограничены временем для слабой игры
  { level: 1,  elo: 800,  movetime: 50,    useSkill: true,  skill: 0,  depth: 4,  depthOnly: false },
  { level: 2,  elo: 1000, movetime: 100,   useSkill: true,  skill: 1,  depth: 5,  depthOnly: false },
  { level: 3,  elo: 1200, movetime: 200,   useSkill: true,  skill: 3,  depth: 6,  depthOnly: false },
  { level: 4,  elo: 1400, movetime: 350,   useSkill: true,  skill: 5,  depth: 7,  depthOnly: false },
  { level: 5,  elo: 1600, movetime: 600,   useSkill: true,  skill: 7,  depth: 8,  depthOnly: false },

  // 6-10: Intermediate (1700-2200 Elo) — depth-only, гарантированная сила
  { level: 6,  elo: 1700, movetime: 5000,  useSkill: true,  skill: 9,  depth: 9,  depthOnly: true  },
  { level: 7,  elo: 1800, movetime: 5000,  useSkill: true,  skill: 11, depth: 10, depthOnly: true  },
  { level: 8,  elo: 1950, movetime: 5000,  useSkill: true,  skill: 13, depth: 11, depthOnly: true  },
  { level: 9,  elo: 2100, movetime: 8000,  useSkill: true,  skill: 14, depth: 12, depthOnly: true  },
  { level: 10, elo: 2200, movetime: 8000,  useSkill: true,  skill: 15, depth: 13, depthOnly: true  },

  // 11-15: Advanced (2300-2700 Elo) — depth-only, серьёзная игра
  { level: 11, elo: 2300, movetime: 8000,  useSkill: true,  skill: 16, depth: 14, depthOnly: true  },
  { level: 12, elo: 2400, movetime: 10000, useSkill: true,  skill: 17, depth: 15, depthOnly: true  },
  { level: 13, elo: 2500, movetime: 10000, useSkill: true,  skill: 18, depth: 16, depthOnly: true  },
  { level: 14, elo: 2600, movetime: 12000, useSkill: true,  skill: 19, depth: 18, depthOnly: true  },
  { level: 15, elo: 2700, movetime: 12000, useSkill: false, skill: 20, depth: 20, depthOnly: true  },

  // 16-20: Unbeatable (2800-3200+ Elo) — полная сила, movetime как страховка от OOM
  { level: 16, elo: 2800, movetime: 5000,  useSkill: false, skill: 20, depth: 16, depthOnly: false },
  { level: 17, elo: 2900, movetime: 6000,  useSkill: false, skill: 20, depth: 17, depthOnly: false },
  { level: 18, elo: 3000, movetime: 7000,  useSkill: false, skill: 20, depth: 18, depthOnly: false },
  { level: 19, elo: 3100, movetime: 8000,  useSkill: false, skill: 20, depth: 19, depthOnly: false },
  // 20: Mystic (Magnus level)
  { level: 20, elo: 3200, movetime: 10000, useSkill: false, skill: 20, depth: 20, depthOnly: false },
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
        log.warn("Timeout, using random fallback");
        saferesolve(getRandomMove(fen));
      }, timeoutMs);

      const listener = (line: string) => {
        dlog("[SF OUT] " + line);
        if (line === "readyok" && !isSearching) {
          isSearching = true;
          // Engine ready for this request — send options and go
          const send = (m: string) => { dlog("[SF IN] " + m); engine!.postMessage(m); };

          // Добавляем память для стабильной работы глубоких уровней
          send("setoption name Hash value 16");

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
