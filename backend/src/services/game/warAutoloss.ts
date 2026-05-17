/**
 * warAutoloss.ts — PR-1
 *
 * Форфейт war-партий по дедлайну. Правило (Кенан 2026-05-17):
 *  • дедлайн партии 24ч (Session.deadlineAt, выставлен в warMatchmaking).
 *  • если один игрок принял (game:accept_private), второй нет → побеждает играющий.
 *  • если оба не приняли → проигрывает чей был ход (по жеребьёвке цветов — белые).
 *  • если оба приняли, партия идёт — НЕ трогаем, доигрывается шахматным таймером.
 *
 * Запускается из crons.ts каждые 5 минут.
 */

import { prisma } from "@/lib/prisma";
import { logger, logError } from "@/lib/logger";
import { finishSession } from "./finish";
import { SessionStatus } from "@prisma/client";

export async function processWarAutoloss(): Promise<{ processed: number }> {
  try {
    const now = new Date();

    // Просроченные war-партии в WAITING_FOR_OPPONENT — никто/один не принял
    const stale = await prisma.session.findMany({
      where: {
        sourceType: "WAR",
        status: SessionStatus.WAITING_FOR_OPPONENT,
        deadlineAt: { lt: now },
      },
      include: { sides: true },
      take: 200,
    });

    let processed = 0;

    for (const session of stale) {
      try {
        const sides = session.sides;
        if (sides.length !== 2) {
          // Сломанная партия — отменяем без победителя
          await prisma.session.update({
            where: { id: session.id },
            data: { status: SessionStatus.CANCELLED },
          });
          continue;
        }

        const whiteSide = sides.find(s => s.isWhite);
        const blackSide = sides.find(s => !s.isWhite);
        if (!whiteSide || !blackSide) continue;

        // PR-1: side.status === IN_PROGRESS означает «игрок нажал accept_private»
        // (см. socket.ts: game:accept_private переводит side в IN_PROGRESS).
        const whiteAccepted = whiteSide.status === "IN_PROGRESS";
        const blackAccepted = blackSide.status === "IN_PROGRESS";

        let winnerSideId: string;
        let loserSideId: string;

        if (whiteAccepted && !blackAccepted) {
          winnerSideId = whiteSide.id;
          loserSideId = blackSide.id;
        } else if (blackAccepted && !whiteAccepted) {
          winnerSideId = blackSide.id;
          loserSideId = whiteSide.id;
        } else {
          // Оба не приняли (или странная ситуация «оба приняли но партия всё ещё
          // WAITING» — невозможно по логике). Проигрывает чей ход = белые.
          winnerSideId = blackSide.id;
          loserSideId = whiteSide.id;
        }

        await finishSession(session.id, SessionStatus.TIME_EXPIRED, {
          winnerSideId,
          loserSideId,
          isDraw: false,
        });

        processed++;
        logger.info(`[WarAutoloss] Session ${session.id}: winner side ${winnerSideId} by deadline`);
      } catch (err) {
        logError(`[WarAutoloss] Session ${session.id} error:`, err);
      }
    }

    if (processed > 0) {
      logger.info(`[WarAutoloss] Processed ${processed} stale war sessions`);
    }

    return { processed };
  } catch (err) {
    logError("[WarAutoloss] Top-level error:", err);
    return { processed: 0 };
  }
}
