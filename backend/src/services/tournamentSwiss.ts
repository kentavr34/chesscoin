/**
 * Sprint 4: Swiss-system pairing engine for tournaments.
 *
 * Standard Swiss rules:
 *  - сортировка по очкам (points desc), тай-брейки: Buchholz → Sonneborn-Berger
 *  - игроков сверху пары с ближайшим следующим, избегая повторной встречи
 *  - при нечётном количестве — последний по очкам получает bye (1 очко авто-побед)
 *
 * Total rounds: log2(maxPlayers) — 4→2, 8→3, 16→4, 32→5.
 */

export interface SwissParticipant {
  id: string;          // TournamentPlayer.id
  userId: string;
  points: number;      // текущие очки в турнире (1 win, 0.5 draw, 0 loss)
}

export interface SwissPreviousMatch {
  player1Id: string | null;
  player2Id: string | null;
  winnerId?: string | null;
  // points awarded per match (для Sonneborn-Berger)
  points?: number;
}

export interface SwissPair {
  player1Id: string;
  player2Id: string | null; // null = bye
  isBye?: boolean;
}

/**
 * Возвращает количество раундов в Swiss-турнире на основе maxPlayers.
 */
export function totalRoundsForBracket(maxPlayers: number): number {
  if (maxPlayers <= 4) return 2;
  if (maxPlayers <= 8) return 3;
  if (maxPlayers <= 16) return 4;
  if (maxPlayers <= 32) return 5;
  // fallback: log2 округлённое вверх
  return Math.max(2, Math.ceil(Math.log2(Math.max(2, maxPlayers))));
}

/**
 * Подсчёт Buchholz (сумма очков соперников) для каждого игрока.
 * Используется как первый тай-брейк в Swiss.
 */
export function computeBuchholz(
  participants: SwissParticipant[],
  previousMatches: SwissPreviousMatch[]
): Map<string, number> {
  const pointsById = new Map(participants.map(p => [p.id, p.points]));
  const buch = new Map<string, number>();
  for (const p of participants) buch.set(p.id, 0);

  for (const m of previousMatches) {
    if (!m.player1Id || !m.player2Id) continue;
    const p1Pts = pointsById.get(m.player1Id) ?? 0;
    const p2Pts = pointsById.get(m.player2Id) ?? 0;
    if (buch.has(m.player1Id)) buch.set(m.player1Id, (buch.get(m.player1Id) ?? 0) + p2Pts);
    if (buch.has(m.player2Id)) buch.set(m.player2Id, (buch.get(m.player2Id) ?? 0) + p1Pts);
  }
  return buch;
}

/**
 * Подсчёт Sonneborn-Berger (сумма очков побеждённых соперников + 0.5 за ничью).
 * Второй тай-брейк.
 */
export function computeSonnebornBerger(
  participants: SwissParticipant[],
  previousMatches: SwissPreviousMatch[]
): Map<string, number> {
  const pointsById = new Map(participants.map(p => [p.id, p.points]));
  const sb = new Map<string, number>();
  for (const p of participants) sb.set(p.id, 0);

  for (const m of previousMatches) {
    if (!m.player1Id || !m.player2Id) continue;
    const p1Pts = pointsById.get(m.player1Id) ?? 0;
    const p2Pts = pointsById.get(m.player2Id) ?? 0;
    if (m.winnerId === m.player1Id) {
      sb.set(m.player1Id, (sb.get(m.player1Id) ?? 0) + p2Pts);
    } else if (m.winnerId === m.player2Id) {
      sb.set(m.player2Id, (sb.get(m.player2Id) ?? 0) + p1Pts);
    } else {
      // ничья
      sb.set(m.player1Id, (sb.get(m.player1Id) ?? 0) + 0.5 * p2Pts);
      sb.set(m.player2Id, (sb.get(m.player2Id) ?? 0) + 0.5 * p1Pts);
    }
  }
  return sb;
}

/**
 * Сортирует игроков по: points desc → Buchholz desc → Sonneborn-Berger desc → id.
 * Возвращает копию массива.
 */
export function sortBySwissStandings(
  participants: SwissParticipant[],
  previousMatches: SwissPreviousMatch[]
): SwissParticipant[] {
  const buch = computeBuchholz(participants, previousMatches);
  const sb = computeSonnebornBerger(participants, previousMatches);

  return [...participants].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const bA = buch.get(a.id) ?? 0;
    const bB = buch.get(b.id) ?? 0;
    if (bB !== bA) return bB - bA;
    const sbA = sb.get(a.id) ?? 0;
    const sbB = sb.get(b.id) ?? 0;
    if (sbB !== sbA) return sbB - sbA;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Главная функция: пары на следующий раунд по Swiss-системе.
 *
 * @param participants    активные игроки турнира (id, userId, points)
 * @param previousMatches все предыдущие матчи турнира (для anti-rematch и тай-брейков)
 * @param round           номер нового раунда (для логирования; не влияет на алгоритм)
 */
export function pairSwissRound(
  participants: SwissParticipant[],
  previousMatches: SwissPreviousMatch[],
  round: number // eslint-disable-line @typescript-eslint/no-unused-vars
): SwissPair[] {
  if (participants.length < 2) return [];

  // Множество уже сыгранных пар (по TournamentPlayer.id, симметрично)
  const playedKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const played = new Set<string>();
  for (const m of previousMatches) {
    if (m.player1Id && m.player2Id) {
      played.add(playedKey(m.player1Id, m.player2Id));
    }
  }

  const sorted = sortBySwissStandings(participants, previousMatches);
  const pool = [...sorted];
  const pairs: SwissPair[] = [];

  // При нечётном количестве — последний по очкам получает bye
  if (pool.length % 2 === 1) {
    // bye отдаём наименее ранжированному игроку, который ещё не получал bye в этом турнире
    const hadByeBefore = (id: string) =>
      previousMatches.some(m => (m.player1Id === id && !m.player2Id) || (m.player2Id === id && !m.player1Id));
    let byeIdx = pool.length - 1;
    while (byeIdx > 0 && hadByeBefore(pool[byeIdx]!.id)) byeIdx--;
    const byePlayer = pool.splice(byeIdx, 1)[0]!;
    pairs.push({ player1Id: byePlayer.id, player2Id: null, isBye: true });
  }

  // Жадное паросочетание: топ vs следующий, при rematch — ищем дальше
  while (pool.length >= 2) {
    const p1 = pool.shift()!;
    let pairedIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      if (!played.has(playedKey(p1.id, pool[i]!.id))) {
        pairedIdx = i;
        break;
      }
    }
    if (pairedIdx === -1) {
      // все оставшиеся — повторы; берём ближайшего по очкам (первого)
      pairedIdx = 0;
    }
    const p2 = pool.splice(pairedIdx, 1)[0]!;
    pairs.push({ player1Id: p1.id, player2Id: p2.id });
  }

  return pairs;
}
