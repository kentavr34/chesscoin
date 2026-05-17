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
      // 2026-05-16: ISO-2 код страны для <CountryFlag> на доске.
      // Доступно если запрос загрузил `countryMember.country.code`.
      country: (side.player as any).countryMember?.country?.code ?? null,
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
    // PR-1: источник партии теперь в БД-поле Session.sourceType. Redis-fallback
    // (session:source:<id>) ещё работает в socket.ts для существующих сессий
    // на 30 дней — потом выпилим. sourceMeta — legacy alias на sourceRefId.
    sourceType: (session as any).sourceType ?? null,
    sourceRefId: (session as any).sourceRefId ?? null,
    sourceMeta: (session as any).sourceRefId ?? (session as any).sourceMeta ?? null,
    deadlineAt: (session as any).deadlineAt ?? null,
    acceptedByAll: (session as any).acceptedByAll ?? false,
    shareToken: (session as any).shareToken ?? null,
    duration: (session as any).duration ?? null,
    pieceCoins: (session as any).pieceCoins ?? null,
  };
};

// Форматирует список батлов для лобби
export const formatBattlesList = (sessions: SessionWithSides[], spectatorCounts?: Map<string, number>) => {
  const formatPlayer = (side: SessionSideWithPlayer) => ({
    id: side.player.id,
    firstName: side.player.firstName,
    avatar: side.player.avatar,
    avatarGradient: side.player.avatarGradient,
    elo: side.player.elo,
    league: side.player.league,
    isWhite: side.isWhite,
  });
  return sessions.map((s) => ({
    id: s.id,
    code: s.code,
    bet: s.bet?.toString() ?? "0",
    status: s.status,
    duration: (s as Record<string, unknown> & typeof s).duration,
    createdAt: (s as Record<string, unknown> & typeof s).createdAt,
    spectatorCount: spectatorCounts?.get(s.id) ?? 0,
    // PR-1: источник из БД, legacy sourceMeta — alias на sourceRefId.
    sourceType: (s as any).sourceType ?? null,
    sourceRefId: (s as any).sourceRefId ?? null,
    sourceMeta: (s as any).sourceRefId ?? (s as any).sourceMeta ?? null,
    deadlineAt: (s as any).deadlineAt ?? null,
    acceptedByAll: (s as any).acceptedByAll ?? false,
    shareToken: (s as any).shareToken ?? null,
    creator: s.sides[0] ? formatPlayer(s.sides[0]) : null,
    // Для турнирных вызовов: оба игрока известны заранее
    opponent: s.sides[1] ? formatPlayer(s.sides[1]) : null,
  }));
};
