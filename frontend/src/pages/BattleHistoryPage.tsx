import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { profileApi } from '@/api';
import { fmtBalance, fmtDate } from '@/utils/format';
import { useT } from '@/i18n/useT';
import type { UserPublic } from '@/types';

interface HistoryGame {
  sessionId: string;
  type: string;
  result: string;
  isWhite: boolean;
  winningAmount?: string | null;
  bet?: string | null;
  botLevel?: number | null;
  pgn?: string | null;
  finishedAt?: string | null;
  opponent?: UserPublic | null;
  hasBot?: boolean;
}

const PAGE_SIZE = 20;

export const BattleHistoryPage: React.FC = () => {
  const t: any = useT();
  const navigate = useNavigate();
  const [games, setGames] = useState<HistoryGame[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const r = (await profileApi.getGames(PAGE_SIZE, off)) as any;
      setGames(r.games as HistoryGame[]);
      setTotal(r.total ?? 0);
      setOffset(off);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGames(0); }, [loadGames]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <PageLayout title={t.profile.battleHistory ?? 'Battle History'} onBack={() => navigate(-1)}>
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--battle-history-loader-color, #7B61FF)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
        </div>
      )}

      {!loading && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📜</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary, #8B92A8)', fontWeight: 600 }}>{t.profile.noGamesPlayed ?? 'No games yet'}</div>
        </div>
      )}

      {!loading && games.length > 0 && (
        <>
          <div style={{ padding: '8px 18px 4px', fontSize: 11, color: 'var(--battle-history-page-info-color, #6A7090)' }}>
            {total} {t.profile.totalGamesLabel ?? 'games'} · page {currentPage}/{totalPages}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
            {games.map((g) => {
              const isWon = g.result === 'WON';
              const isDraw = g.result === 'DRAW';
              const statusColor = isWon ? 'var(--color-green, #00D68F)' : isDraw ? 'var(--color-purple, #9B85FF)' : 'var(--color-red, #FF4D6A)';
              const statusLabel = isWon ? '✓ Win' : isDraw ? '= Draw' : '✕ Loss';
              const typeIcon = g.hasBot ? '🤖' : g.type === 'FRIENDLY' ? '🤝' : '⚔️';

              return (
                <div key={g.sessionId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', background: 'var(--color-bg-card, #1C2030)',
                  border: `1px solid ${isWon ? 'rgba(0,214,143,0.12)' : isDraw ? 'rgba(155,133,255,0.12)' : 'rgba(255,77,106,0.10)'}`,
                  borderRadius: 14, cursor: g.pgn ? 'pointer' : 'default',
                }} onClick={() => g.pgn && navigate(`/profile`, { state: { replay: { pgn: g.pgn, title: g.opponent?.firstName ? `vs ${g.opponent.firstName}` : 'Game', sessionId: g.sessionId } } })}>
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: statusColor, flexShrink: 0 }} />

                  {g.opponent ? (
                    <div onClick={(e) => { if (g.opponent?.id) { e.stopPropagation(); navigate('/profile/' + g.opponent.id); } }} style={{ cursor: g.opponent?.id ? 'pointer' : 'default', flexShrink: 0 }}>
                      <Avatar user={g.opponent} size="s" />
                    </div>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      {typeIcon}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary, #F0F2F8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.opponent?.firstName ?? (g.hasBot ? `J.A.R.V.I.S Lv.${g.botLevel ?? '?'}` : 'Unknown')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted, #4A5270)', marginTop: 2 }}>
                      {g.finishedAt ? fmtDate(g.finishedAt) : ''}
                      {g.bet && BigInt(g.bet) > 0n ? ` · ${fmtBalance(g.bet)} ᚙ` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                    {g.winningAmount && isWon && (
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: 'var(--color-accent, #F5C842)' }}>+{fmtBalance(g.winningAmount)} ᚙ</span>
                    )}
                    {g.pgn && <span style={{ fontSize: 9, color: 'var(--battle-history-page-info-color, #6A7090)' }}>▶ replay</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 0 24px' }}>
              <button
                disabled={offset === 0}
                onClick={() => loadGames(Math.max(0, offset - PAGE_SIZE))}
                style={{ ...pgBtn, opacity: offset === 0 ? 0.3 : 1 }}
              >← Prev</button>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #8B92A8)', display: 'flex', alignItems: 'center' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => loadGames(offset + PAGE_SIZE)}
                style={{ ...pgBtn, opacity: offset + PAGE_SIZE >= total ? 0.3 : 1 }}
              >Next →</button>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </PageLayout>
  );
};

const pgBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--color-bg-card, #1C2030)', border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
  borderRadius: 10, color: 'var(--color-text-secondary, #8B92A8)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
