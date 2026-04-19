import type { SessionWithSides, SessionSideWithPlayer } from "@/types/db";

// Форматирует сессию для отправки клиенту
export const formatSession = (session: SessionWithSides, userId: string | null) => {
  if (!session) return null;

  const mySide = userId
    ? session.sides.find((s) => s.playerId === userId && !s.isBot)
    : null;

  const formatSide = (side: SessionSideWithPlayer) => ({
    id: side.id,
    playerId: side.playerId,
    isWhite: side.isWhite,
    isBot: side.isBot,
    status: side.status,
    eatenPieces: side.eatenPieces,
    winningAmount: side.winningAmount?.toString() ?? null,
    timeLeft: side.timeLeft,
    player: {
      id: side.player.id,
      firstName: side.player.firstName,
      lastName: side.player.lastName,
      username: side.player.username,
      avatar: side.player.avatar,
      avatarType: side.player.avatarType,
      avatarGradient: side.player.avatarGradient,
      elo: side.player.elo,
      league: side.player.league,
    },
  });

  return {
    id: session.id,
    code: session.code,
    type: session.type,
    status: session.status,
    fen: session.fen,
    pgn: session.pgn,
    bet: session.bet?.toString() ?? null,
    botLevel: session.botLevel,
    currentSideId: session.currentSideId,
    winnerSideId: session.winnerSideId,
    isSurrender: (session as Record<string, unknown> & typeof session).isSurrender,
    isPrivate: session.isPrivate ?? false,
    startedAt: (session as Record<string, unknown> & typeof session).startedAt,
    finishedAt: (session as Record<string, unknown> & typeof session).finishedAt,
    sides: session.sides.map(formatSide),
    isMyTurn: mySide ? session.currentSideId === mySide.id : null,
    mySideId: mySide?.id ?? null,
    // S3: скины создателя батла (видны обоим игрокам)
    boardSkinUrl: (session as any).boardSkinUrl ?? null,
    pieceSkinUrl: (session as any).pieceSkinUrl ?? null,
    // G18: метаданные источника (турнир, война, обычный батл)
    sourceType: (session as any).sourceType ?? null,
    sourceMeta: (session as any).sourceMeta ?? null,
    duration: (session as any).duration ?? null,
    pieceCoins: (session as any).pieceCoins ?? null,
  };
};

// In-memory хранилище оригинального выбора цвета создателем батла
// (WAITING-сессии живут недолго, персистентность не нужна)
export const battleColorChoices = new Map<string, 'white' | 'black' | 'random'>();

// Форматирует список батлов для лобби
export const formatBattlesList = (sessions: SessionWithSides[], spectatorCounts?: Map<string, number>) => {
  return sessions.map((s) => ({
    id: s.id,
    code: s.code,
    bet: s.bet?.toString() ?? "0",
    status: s.status,
    duration: (s as Record<string, unknown> & typeof s).duration,
    createdAt: (s as Record<string, unknown> & typeof s).createdAt,
    spectatorCount: spectatorCounts?.get(s.id) ?? 0,
    sourceType: (s as any).sourceType ?? null,
    sourceMeta: (s as any).sourceMeta ?? null,
    // Оригинальный выбор цвета (нужен для отображения «Рандом» на карточке вызова)
    colorChoice: battleColorChoices.get(s.id) ?? (s.sides[0]?.isWhite ? 'white' : 'black'),
    creator: s.sides[0]
      ? {
          id: s.sides[0].player.id,       // нужен для навигации на профиль
          firstName: s.sides[0].player.firstName,
          avatar: s.sides[0].player.avatar,
          avatarGradient: s.sides[0].player.avatarGradient,
          elo: s.sides[0].player.elo,
          league: s.sides[0].player.league,
          isWhite: s.sides[0].isWhite,
        }
      : null,
  }));
};
