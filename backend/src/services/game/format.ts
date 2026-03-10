// Форматирует сессию для отправки клиенту
// userId нужен чтобы скрыть информацию соперника (не показывать его timeLeft точно)

export const formatSession = (session: any, userId: string | null) => {
  if (!session) return null;

  const mySide = userId
    ? session.sides.find((s: any) => s.playerId === userId && !s.isBot)
    : null;

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
    isSurrender: session.isSurrender,
    isPrivate: session.isPrivate ?? false,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    sides: session.sides.map((side: any) => ({
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
    })),
    isMyTurn: mySide ? session.currentSideId === mySide.id : null,
    mySideId: mySide?.id ?? null,
  };
};

// Форматирует список батлов для лобби
// spectatorCounts: Map sessionId → count (передаётся из socket.ts)
export const formatBattlesList = (sessions: any[], spectatorCounts?: Map<string, number>) => {
  return sessions.map((s) => ({
    id: s.id,
    code: s.code,
    bet: s.bet?.toString() ?? "0",
    duration: s.duration,
    createdAt: s.createdAt,
    spectatorCount: spectatorCounts?.get(s.id) ?? 0,
    creator: s.sides[0]
      ? {
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
