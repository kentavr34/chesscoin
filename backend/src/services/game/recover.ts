/**
 * Восстановление партий, чьё завершение сорвалось.
 *
 * 30.07.2026 живой прогон турнирного матча показал: если finishSession падает
 * (в тот раз — deadlock 40P01), ход уже записан в позицию и PGN, а сессия
 * остаётся IN_PROGRESS. Позже уборка закрывает её как отмену, и **мат
 * засчитывается ничьёй 0.5/0.5** — результат партии теряется.
 *
 * Дедлок починен, но полагаться на «больше не упадёт» нельзя: упасть может
 * что угодно. Поэтому здесь отдельный контур — раз в 5 минут ищем партии,
 * которые ПО ПОЗИЦИИ уже закончены, и доводим их до правильного результата.
 */
import { Chess } from "chess.js";
import { SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger";
import { finishSession } from "./finish";

// Партия считается «зависшей», если позиция терминальна, а статус ещё игровой,
// и с последнего изменения прошло больше двух минут (чтобы не мешать
// нормальному завершению, которое идёт прямо сейчас).
const STUCK_AFTER_MS = 2 * 60 * 1000;

export async function recoverStuckGames(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
    const candidates = await prisma.session.findMany({
      where: { status: SessionStatus.IN_PROGRESS, updatedAt: { lt: cutoff } },
      include: { sides: true },
      take: 50,
    });
    if (candidates.length === 0) return;

    let recovered = 0;
    for (const session of candidates) {
      if (!session.fen) continue;
      let chess: Chess;
      try {
        chess = new Chess(session.fen);
      } catch {
        continue; // битый FEN — не наше дело, это отдельный дефект
      }
      if (!chess.isGameOver()) continue;

      // Позиция закончена, а партия — нет. Определяем результат честно.
      const isDraw = chess.isDraw() || chess.isStalemate() ||
                     chess.isThreefoldRepetition() || chess.isInsufficientMaterial();

      if (isDraw) {
        await finishSession(session.id, SessionStatus.DRAW, { isDraw: true });
        logger.warn(`[Recover] Партия ${session.id.slice(0, 8)} доведена до ничьей по позиции`);
      } else if (chess.isCheckmate()) {
        // Мат ставит тот, кто НЕ ходит: chess.turn() — сторона, получившая мат.
        const matedIsWhite = chess.turn() === "w";
        const winner = session.sides.find(s => s.isWhite !== matedIsWhite);
        const loser  = session.sides.find(s => s.isWhite === matedIsWhite);
        if (!winner || !loser) continue;
        await finishSession(session.id, SessionStatus.FINISHED, {
          winnerSideId: winner.id,
          loserSideId:  loser.id,
        });
        logger.warn(`[Recover] Партия ${session.id.slice(0, 8)} доведена до победы по мату`);
      } else {
        continue;
      }
      recovered++;
    }

    if (recovered > 0) {
      logger.info(`[Recover] Восстановлено сорванных завершений: ${recovered}`);
    }
  } catch (err: unknown) {
    logError("[Recover]", err);
  }
}
