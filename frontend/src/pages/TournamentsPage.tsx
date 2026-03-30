import React, { useEffect, useState } from 'react';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { tournamentsApi } from '@/api';
import { getSocket } from '@/api/socket';
import { fmtBalance } from '@/utils/format';
import { useConfirm } from '@/components/ui/ConfirmModal';
import type { TournamentFull, ActiveMatch, League } from '@/types'; // R1
import { useNavigate } from 'react-router-dom';

import { useT } from '@/i18n/useT';

const showToast = (text: string, type: 'error' | 'info' = 'error') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

const TYPE_ICONS: Record<string, string> = {
  WORLD: '🌍', COUNTRY: '🏴', WEEKLY: '📅', MONTHLY: '🗓️', SEASONAL: '🌸', YEARLY: '🏆',
};
const TYPE_COLORS: Record<string, string> = {
  WORLD: 'var(--accent, #F5C842)', COUNTRY: 'var(--green, #00D68F)', WEEKLY: '#9B85FF',
  MONTHLY: '#FF9F43', SEASONAL: '#FF6B9D', YEARLY: 'var(--accent, #F5C842)',
};

type TFilter = 'all' | 'joined';

export const TournamentsPage: React.FC = () => {
  const t = useT();
  const tt = t.tournaments;
  const [tournaments, setTournaments] = useState<TournamentFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [donateModal, setDonateModal] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [myMatches, setMyMatches] = useState<ActiveMatch[]>([]); // T6
  const [tournamentFinish, setTournamentFinish] = useState<{ tournamentName?: string; prize?: string; place?: number } | null>(null);
  const tourInfo = useInfoPopup('tournaments', tt.infoSlides as unknown as { icon: string; title: string; desc: string }[]);
  const [confirm, ConfirmDialog] = useConfirm();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [res, matchRes] = await Promise.all([
        tournamentsApi.list(),
        tournamentsApi.myMatches().catch(() => ({ matches: [] })),
      ]);
      setTournaments(res.tournaments);
      setMyMatches(matchRes.matches);
    } finally {
      setLoading(false);
    }
  };

  // T2+T7: Socket handler for tournament events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const data = e.detail;
      if (!data) return;

      // T2: match assigned
      if (data.type === 'tournament:match') {
        load(); // refresh match list
        window.dispatchEvent(new CustomEvent('chesscoin:toast', {
          detail: {
            text: tt.tournamentMatch(data.opponentName),
            type: 'info',
            actionLabel: tt.play,
            onAction: () => {
              import('react-router-dom').then(({ useNavigate: _ }) => {
                window.location.hash = '#/battles';
              });
            },
          },
        }));
      }

      // T7: tournament finished
      if (data.type === 'tournament:finished') {
        setTournamentFinish(data);
      }
    };

    // Listen via socket store
    const sock = (window as unknown as Record<string, unknown>).__chesscoinSocket as
      | { on: (event: string, cb: (d: unknown) => void) => void }
      | undefined;
    if (sock) {
      sock.on('tournament:match', (d: unknown) => handler(new CustomEvent('t', { detail: d })));
      sock.on('tournament:finished', (d: unknown) => setTournamentFinish(d as { tournamentName?: string; prize?: string; place?: number }));
    }

    // T7: listen for tournament finish event from useSocket
    const finishHandler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data) setTournamentFinish(data);
    };
    window.addEventListener('chesscoin:tournament:finished', finishHandler);

    return () => {
      window.removeEventListener('chesscoin:tournament:finished', finishHandler);
    };
  }, []);

  useEffect(() => { load(); }, []);

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    try {
      await tournamentsApi.join(id);
      await load();
    } catch (e: unknown) {
      // T8: User-friendly message when country is required
      const err = e as Record<string, unknown>;
      if ((err.message as string | undefined)?.includes('COUNTRY_REQUIRED') || err.error === 'COUNTRY_REQUIRED') {
        showToast(tt.countryRequired, 'info');
      } else {
        showToast((err.message as string | undefined) ?? tt.joinError);
      }
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (id: string) => {
    const ok = await confirm({ title: tt.leave, message: tt.leaveConfirm, danger: true, okLabel: t.common?.confirm ?? 'Yes', cancelLabel: t.common?.cancel ?? 'Cancel' });
    if (!ok) return;
    try {
      await tournamentsApi.leave(id);
      await load();
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) ?? t.common.error);
    }
  };

  const filtered = filter === 'joined' ? tournaments.filter(tournament => tournament.isJoined) : tournaments;
  const grouped = filtered.reduce<Record<string, TournamentFull[]>>((acc, tour) => {
    (acc[tour.type] = acc[tour.type] ?? []).push(tour);
    return acc;
  }, {});
  const typeOrder = ['WORLD', 'YEARLY', 'SEASONAL', 'MONTHLY', 'WEEKLY', 'COUNTRY'];

  return (
    <PageLayout title={tt.title} centered>

      {ConfirmDialog}
      {tourInfo.show && <InfoPopup infoKey="tournaments" slides={tt.infoSlides as unknown as { icon: string; title: string; desc: string }[]} onClose={tourInfo.close} />}
      {/* T7: Tournament finish and prize popup */}
      {tournamentFinish && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340, background: 'linear-gradient(135deg,#161927,#1A2040)', border: '1px solid rgba(245,200,66,0.35)', borderRadius: 28, padding: '32px 24px', textAlign: 'center', boxShadow: '0 0 60px rgba(245,200,66,0.15)' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🏆</div>
            <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 16, fontWeight: 800, color: 'var(--accent, #F5C842)', marginBottom: 8 }}>
              {tournamentFinish.tournamentName ?? tt.title}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00D68F', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              +{tournamentFinish.prize ? `${Number(tournamentFinish.prize).toLocaleString()} ᚙ` : '—'}
            </div>
            {tournamentFinish.place && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)', marginBottom: 24 }}>
                {tournamentFinish.place === 1 ? '🥇' : tournamentFinish.place === 2 ? '🥈' : '🥉'} {tournamentFinish.place} {t.common.place}
              </div>
            )}
            <button onClick={() => setTournamentFinish(null)} style={{ width: '100%', padding: '14px', background: 'var(--accent, #F5C842)', border: 'none', borderRadius: 14, color: '#0B0D11', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {tt.awesome}
            </button>
          </div>
        </div>
      )}

      {/* T6: Active tournament matches */}
      {myMatches.length > 0 && (
        <div style={{ margin: '0 18px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent, #F5C842)', letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
            {tt.yourActiveMatches}
          </div>
          {myMatches.map((match: ActiveMatch) => {
            const isP1 = match.player1?.userId === match.myUserId;
            const opponent = isP1 ? match.player2?.user : match.player1?.user;
            return (
              <div key={match.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 14, marginBottom: 8 }}>
                <div style={{ fontSize: 20 }}>🏆</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                    {match.tournament?.name} · Round {match.round}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                    vs {opponent?.firstName ?? t.game.opponent}
                  </div>
                </div>
                {match.sessionId && (
                  <button
                    onClick={() => {
                      if (isP1) {
                        navigate(`/game/${match.sessionId}`);
                      } else {
                        if ((match as any).sessionCode) {
                          getSocket().emit('game:join', { code: (match as any).sessionCode }, (res: any) => {
                            if (res.ok) navigate(`/game/${match.sessionId}`);
                            else showToast(res.error || 'Error joining match');
                          });
                        } else {
                          navigate(`/game/${match.sessionId}`);
                        }
                      }
                    }}
                    style={{ padding: '7px 12px', background: 'var(--accent, #F5C842)', border: 'none', borderRadius: 10, color: '#0B0D11', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {tt.play}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={segStyle}>
        <button style={segBtn(filter === 'all')} onClick={() => setFilter('all')}>{tt.tabAll}</button>
        <button style={segBtn(filter === 'joined')} onClick={() => setFilter('joined')}>{tt.tabJoined}</button>
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32 }}>{t.common.loading}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32, fontSize: 13 }}>
          {filter === 'joined' ? tt.noJoined : tt.noActive}
        </div>
      )}

      {typeOrder.map(type => {
        const items = grouped[type];
        if (!items?.length) return null;
        return (
          <div key={type}>
            <div style={{ ...secStyle, color: TYPE_COLORS[type] }}>
              {TYPE_ICONS[type]} {items[0].typeLabel}
            </div>
            {items.map(item => (
              <TournamentCard
                key={item.id}
                tour={item}
                onJoin={() => handleJoin(item.id)}
                onLeave={() => handleLeave(item.id)}
                onView={() => setSelected(item.id)}
                onDonate={() => setDonateModal(item.id)}
                joining={joiningId === item.id}
              />
            ))}
          </div>
        );
      })}

      {selected && (
        <TournamentDetailModal tournamentId={selected} onClose={() => setSelected(null)} />
      )}
      {donateModal && (
        <DonateModal
          tournamentId={donateModal}
          onClose={() => setDonateModal(null)}
          onSuccess={() => { setDonateModal(null); load(); }}
        />
      )}
    </PageLayout>
  );
};

const TournamentCard: React.FC<{
  tour: TournamentFull; onJoin: () => void; onLeave: () => void;
  onView: () => void; onDonate: () => void; joining: boolean;
}> = ({ tour, onJoin, onLeave, onView, onDonate, joining }) => {
  const t = useT();
  const tt = t.tournaments;
  const color = TYPE_COLORS[tour.type] ?? 'var(--accent, #F5C842)';
  const icon = TYPE_ICONS[tour.type] ?? '🏆';
  const endDate = tour.endAt ? new Date(tour.endAt).toLocaleDateString('en-US') : null;

  return (
    <div style={{ margin: '0 18px 10px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', background: `linear-gradient(135deg,${color}12,transparent)`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color }}>{tour.name}</div>
            {tour.period && <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>{tt.period}: {tour.period}</div>}
          </div>
          {tour.isJoined && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green, #00D68F)', background: 'rgba(0,214,143,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              {tt.joined}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '10px 16px', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>{tt.playersLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginTop: 2 }}>
            {tour.currentPlayers.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>{tt.entryFeeLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: 'var(--accent, #F5C842)', marginTop: 2 }}>
            {fmtBalance(tour.entryFee)} ᚙ
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>{tt.prizePool}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>
            {fmtBalance(tour.totalPool ?? tour.prizePool)} ᚙ
          </div>
        </div>
      </div>

      {tour.isJoined && tour.myStats && (
        <div style={{ margin: '0 14px 10px', padding: '8px 12px', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--green, #00D68F)', fontWeight: 700, marginBottom: 4 }}>{tt.myStats}</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--green, #00D68F)' }}>✓ {tour.myStats.wins}</span>
            <span style={{ fontSize: 13, color: 'var(--red, #FF4D6A)' }}>✗ {tour.myStats.losses}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)' }}>= {tour.myStats.draws}</span>
            <span style={{ fontSize: 13, color: 'var(--accent, #F5C842)', marginLeft: 'auto' }}>Points: {tour.myStats.points.toFixed(1)}</span>
          </div>
        </div>
      )}

      {endDate && <div style={{ padding: '0 16px 4px', fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>{tt.ends}: {endDate}</div>}

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px' }}>
        <button onClick={onView} style={viewBtn}>{tt.leaderboard}</button>
        <button onClick={onDonate} style={donateBtn}>{tt.donateToPrize}</button>
        {!tour.isJoined ? (
          <button onClick={onJoin} disabled={joining} style={{ ...joinBtnStyle, opacity: joining ? 0.6 : 1 }}>
            {joining ? tt.joining : tt.join}
          </button>
        ) : (
          <button onClick={onLeave} style={leaveBtnStyle}>{tt.leave}</button>
        )}
      </div>
    </div>
  );
};

interface TournamentPlayer {
  id: string;
  user?: { id: string; firstName: string; avatar?: string | null; avatarGradient?: string | null; elo: number; league: League };
  wins: number;
  losses: number;
  draws: number;
  points?: number;
}
interface TournamentDetail {
  players?: TournamentPlayer[];
  [key: string]: unknown;
}

const TournamentDetailModal: React.FC<{ tournamentId: string; onClose: () => void }> = ({ tournamentId, onClose }) => {
  const t = useT();
  const tt = t.tournaments;
  const [data, setData] = useState<TournamentDetail | null>(null);
  useEffect(() => {
    tournamentsApi.get(tournamentId).then(r => setData(r.tournament)).catch(console.error);
  }, [tournamentId]);
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>🏆 {tt.leaderboard}</div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        {!data && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24 }}>{t.common.loading}</div>}
        {data?.players?.map((p: TournamentPlayer, i: number) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? 'var(--accent, #F5C842)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted, #4A5270)', width: 24, textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <Avatar user={p.user} size="s" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{p.user?.firstName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>{p.wins}W {p.losses}L {p.draws}D</div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>
              {p.points?.toFixed(1) ?? '0.0'}
            </span>
          </div>
        ))}
        {!data?.players?.length && data && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 16 }}>{tt.noParticipants}</div>
        )}
      </div>
    </div>
  );
};

const DonateModal: React.FC<{ tournamentId: string; onClose: () => void; onSuccess: () => void }> = ({ tournamentId, onClose, onSuccess }) => {
  const t = useT();
  const tt = t.tournaments;
  const [amount, setAmount] = useState('10000');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try { await tournamentsApi.donate(tournamentId, amount); onSuccess(); }
    catch (e: unknown) { showToast((e instanceof Error ? e.message : null) ?? t.common.error); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 8 }}>{tt.donateToPrize}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 16 }}>{tt.allCoinsToWinners}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <button key={v} onClick={() => setAmount(v)} style={chipBtn(amount === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? tt.donateError : `${t.shop.tonTab.buy} ${fmtBalance(amount)} ᚙ`}
        </button>
      </div>
    </div>
  );
};

const segStyle: React.CSSProperties = { display: 'flex', margin: '4px 18px 10px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3 };
const segBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: 8, border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: active ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)', background: active ? 'var(--bg-input, #232840)' : 'transparent', cursor: 'pointer' });
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', padding: '16px 18px 8px' };
const viewBtn: React.CSSProperties = { padding: '8px 12px', background: 'var(--bg-input, #232840)', color: 'var(--text-primary, #F0F2F8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const donateBtn: React.CSSProperties = { padding: '8px 12px', background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const joinBtnStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const leaveBtnStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', background: 'rgba(255,77,106,0.1)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end' };
const modalStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-card, #161927)', borderRadius: '24px 24px 0 0', padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh', overflowY: 'auto' };
const handleBar: React.CSSProperties = { width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' };
const closeBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%', background: 'var(--border, rgba(255,255,255,0.07))', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary, #8B92A8)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const chipBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '7px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(245,200,66,0.12)' : 'var(--bg-input, #232840)', color: active ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)', borderColor: active ? 'rgba(245,200,66,0.3)' : 'var(--border, rgba(255,255,255,0.07))', fontFamily: 'inherit' });
const goldBtnFull: React.CSSProperties = { width: '100%', padding: '13px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
