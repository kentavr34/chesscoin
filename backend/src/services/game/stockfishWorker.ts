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

// Minimal logger for worker thread (pino not available in workers)
const log = {
  info: (...args: unknown[]) => console.log("[StockfishWorker]", ...args),
  warn: (...args: unknown[]) => console.warn("[StockfishWorker]", ...args),
  error: (...args: unknown[]) => console.error("[StockfishWorker]", ...args),
  debug: (...args: unknown[]) => {}, // silent in prod
};

// ─── Уровни J.A.R.V.I.S (20 уровней) ────────────────────────────────────────
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
        if (line === "readyok") {
          // Engine ready for this request — send options and go
          if (cfg.useSkill) {
            engine!.postMessage("setoption name UCI_LimitStrength value true");
            engine!.postMessage(`setoption name UCI_Elo value ${cfg.elo}`);
            engine!.postMessage(`setoption name Skill Level value ${cfg.skill}`);
          } else {
            engine!.postMessage("setoption name UCI_LimitStrength value false");
            engine!.postMessage("setoption name Skill Level value 20");
          }
          engine!.postMessage(`position fen ${fen}`);
          engine!.postMessage(`go movetime ${cfg.movetime}`);
          return;
        }

        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          const uciMove = line.split(" ")[1];
          const parsed = parseUciMove(uciMove);
          saferesolve(parsed ?? getRandomMove(fen));
        }
      };

      engine!.addMessageListener(listener);
      // Reset engine state and wait for readyok
      engine!.postMessage("stop");
      engine!.postMessage("ucinewgame");
      engine!.postMessage("isready");
    });

    parentPort?.postMessage({ move, requestId });
  } catch (err: unknown) {
    log.error("Unexpected error:", err instanceof Error ? err.message : String(err));
    parentPort?.postMessage({ move: getRandomMove(fen), requestId });
  }
});

// Signal ready to main thread
parentPort?.postMessage({ ready: true });
