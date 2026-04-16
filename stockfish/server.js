/**
 * stockfish/server.js — Native Stockfish HTTP microservice
 *
 * Архитектура: Express HTTP сервер + node-uci (native binary) + chess.js
 * Аналог v1.0.2 stockfish service, но с улучшенной логикой уровней.
 *
 * Ключевое преимущество над WASM:
 *   - Нативный бинарник: depth 10 за ~200-500ms (WASM: 8-15 секунд!)
 *   - Стабильная работа при 50-100 одновременных играх
 *   - movetime 2-6 секунд → реальная глубина 12-18 на слабом VPS
 *
 * API:
 *   POST /move { fen: string, level: number } → { bestmove: string }
 *   GET  /health → { status: 'ok', ready: boolean }
 */

const express = require('express');
const { Engine } = require('node-uci');
const { Chess } = require('chess.js');

const app = express();
app.use(express.json());

const STOCKFISH_PATH = process.env.STOCKFISH_PATH || '/app/stockfish';

// ─── Конфигурация 20 уровней (улучшенная относительно v1.0.2) ─────────────────
//
// randomPct — % случайных ходов (КЛЮЧЕВОЙ элемент слабости для низких уровней).
//   Без него Stockfish на Skill=0 всё равно играет сильнее реального новичка.
//   Уровень 1: 70% случайных ходов, уровень 7: 5%, уровень 11+: 0%.
//
// movetime — теперь реалистично благодаря нативному бинарнику:
//   depth 10 за ~200-500ms (а не 8-15 секунд как WASM).
//   Уровни 6-10: 2000-3500ms достигают depth 12-16.
//   Уровни 11-20: 4000-8000ms достигают depth 16-22+.
//
const LEVELS = [
  // Уровни 1-5: слабая игра через randomPct + ограниченный depth + UCI_Elo
  { elo: 800,  movetime: 50,   skill: 0,  depth: 1,  useElo: true,  randomPct: 70 }, // 1
  { elo: 900,  movetime: 80,   skill: 1,  depth: 2,  useElo: true,  randomPct: 55 }, // 2
  { elo: 1100, movetime: 150,  skill: 2,  depth: 3,  useElo: true,  randomPct: 40 }, // 3
  { elo: 1300, movetime: 300,  skill: 4,  depth: 5,  useElo: true,  randomPct: 25 }, // 4
  { elo: 1500, movetime: 500,  skill: 6,  depth: 7,  useElo: true,  randomPct: 15 }, // 5

  // Уровни 6-10: клубный игрок, небольшой % случайных ходов для реализма
  { elo: 1700, movetime: 2000, skill: 9,  depth: 9,  useElo: true,  randomPct: 8  }, // 6
  { elo: 1800, movetime: 2500, skill: 11, depth: 10, useElo: true,  randomPct: 5  }, // 7
  { elo: 1950, movetime: 3000, skill: 13, depth: 11, useElo: true,  randomPct: 3  }, // 8
  { elo: 2100, movetime: 3500, skill: 14, depth: 12, useElo: true,  randomPct: 2  }, // 9
  { elo: 2200, movetime: 3500, skill: 15, depth: 13, useElo: true,  randomPct: 1  }, // 10

  // Уровни 11-15: серьёзная игра, нет случайных ходов
  { elo: 2300, movetime: 4000, skill: 16, depth: 14, useElo: true,  randomPct: 0  }, // 11
  { elo: 2400, movetime: 4500, skill: 17, depth: 15, useElo: true,  randomPct: 0  }, // 12
  { elo: 2500, movetime: 5000, skill: 18, depth: 16, useElo: true,  randomPct: 0  }, // 13
  { elo: 2600, movetime: 5500, skill: 19, depth: 18, useElo: true,  randomPct: 0  }, // 14
  { elo: 2700, movetime: 6000, skill: 20, depth: 20, useElo: false, randomPct: 0  }, // 15

  // Уровни 16-20: полная сила Stockfish (Magnus-уровень)
  { elo: 2800, movetime: 4000, skill: 20, depth: 16, useElo: false, randomPct: 0  }, // 16
  { elo: 2900, movetime: 5000, skill: 20, depth: 17, useElo: false, randomPct: 0  }, // 17
  { elo: 3000, movetime: 6000, skill: 20, depth: 18, useElo: false, randomPct: 0  }, // 18
  { elo: 3100, movetime: 7000, skill: 20, depth: 19, useElo: false, randomPct: 0  }, // 19
  { elo: 3200, movetime: 8000, skill: 20, depth: 20, useElo: false, randomPct: 0  }, // 20
];

// ─── Случайный ход через chess.js ─────────────────────────────────────────────
function getRandomMove(fen) {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (!moves.length) return null;
    const m = moves[Math.floor(Math.random() * moves.length)];
    return m.from + m.to;
  } catch {
    return null;
  }
}

// ─── Инициализация движка ──────────────────────────────────────────────────────
const engine = new Engine(STOCKFISH_PATH);
let isReady = false;
// Мьютекс: один запрос к движку в любой момент времени
let engineBusy = false;
const pendingQueue = [];

const initPromise = (async () => {
  try {
    console.log(`[SF] Initializing Stockfish from ${STOCKFISH_PATH}...`);
    await engine.init();
    await engine.isready();
    console.log('[SF] Engine ready!');
    isReady = true;
  } catch (err) {
    console.error('[SF] Init error:', err.message);
  }
})();

// ─── Обработка очереди запросов ───────────────────────────────────────────────
// node-uci не поддерживает параллельные запросы к одному экземпляру движка.
// Реализуем простую очередь через промисы.
async function withEngine(task) {
  if (engineBusy) {
    // Встать в очередь
    await new Promise(resolve => pendingQueue.push(resolve));
  }
  engineBusy = true;
  try {
    return await task();
  } finally {
    engineBusy = false;
    if (pendingQueue.length > 0) {
      const next = pendingQueue.shift();
      next();
    }
  }
}

// ─── POST /move ───────────────────────────────────────────────────────────────
app.post('/move', async (req, res) => {
  const { fen, level } = req.body;

  if (!fen) {
    return res.status(400).json({ error: 'FEN required' });
  }

  await initPromise;

  if (!isReady) {
    console.warn('[SF] Engine not ready, returning random move');
    return res.json({ bestmove: getRandomMove(fen) });
  }

  const lvl = Math.max(1, Math.min(20, parseInt(level || '10', 10)));
  const cfg = LEVELS[lvl - 1];

  // ── Случайный ход (реализм слабых уровней) ─────────────────────────────────
  if (cfg.randomPct > 0 && Math.floor(Math.random() * 100) < cfg.randomPct) {
    console.log(`[SF] Level ${lvl}: random move (${cfg.randomPct}% chance triggered)`);
    return res.json({ bestmove: getRandomMove(fen) });
  }

  try {
    const bestmove = await withEngine(async () => {
      // Сбрасываем состояние движка перед каждым новым запросом
      try { engine.chain().stop(); } catch {}
      await engine.ucinewgame();
      await engine.isready();

      // Устанавливаем параметры уровня
      await engine.setoption('Hash', '32');
      await engine.setoption('Threads', '1');

      if (cfg.useElo) {
        await engine.setoption('UCI_LimitStrength', 'true');
        await engine.setoption('UCI_Elo', String(cfg.elo));
        await engine.setoption('Skill Level', String(cfg.skill));
      } else {
        await engine.setoption('UCI_LimitStrength', 'false');
        await engine.setoption('Skill Level', '20');
      }

      await engine.position(fen);
      const result = await engine.go({ movetime: cfg.movetime, depth: cfg.depth });

      console.log(`[SF] Level ${lvl} (ELO ${cfg.elo}): ${result.bestmove} (mt=${cfg.movetime}ms d=${cfg.depth})`);
      return result.bestmove;
    });

    res.json({ bestmove: bestmove || getRandomMove(fen) });

  } catch (err) {
    console.error(`[SF] Error at level ${lvl}:`, err.message);
    res.json({ bestmove: getRandomMove(fen) });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ready: isReady, queueLength: pendingQueue.length });
});

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
  console.log(`[SF] HTTP server listening on port ${PORT}`);
});
