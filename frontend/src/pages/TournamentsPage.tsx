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
  WORLD: '#F5C842', COUNTRY: '#3DBA7A', WEEKLY: '#D4A843',
  MONTHLY: '#E8B84B', SEASONAL: '#C4A843', YEARLY: '#F5C842',
};

type TFilter = 'all' | 'joined';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '.58rem',
  fontWeight: 700,
  color: '#7A7875',
  textTransform: 'uppercase',
  letterSpacing: '.14em',
};

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
        <div style={{ position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)", background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340, background: 'linear-gradient(135deg,#141018,#0F0E18)', borderRadius: 20, padding: 28, border: '.5px solid rgba(245,200,66,0.35)', textAlign: 'center', boxShadow: '0 0 60px rgba(245,200,66,0.12)' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F0C85A', marginBottom: 8 }}>
              {tournamentFinish.tournamentName ?? tt.title}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3DBA7A', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              +{tournamentFinish.prize ? `${Number(tournamentFinish.prize).toLocaleString()} ᚙ` : '—'}
            </div>
            {tournamentFinish.place && (
              <div style={{ fontSize: '0.78rem', color: '#7A7875', marginBottom: 24 }}>
                {tournamentFinish.place === 1 ? '🥇' : tournamentFinish.place === 2 ? '🥈' : '🥉'} {tournamentFinish.place} {t.common.place}
              </div>
            )}
            <button
              onClick={() => setTournamentFinish(null)}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: '.5px solid rgba(212,168,67,.4)', background: 'linear-gradient(135deg,rgba(212,168,67,.25),rgba(212,168,67,.15))', color: '#F0C85A', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {tt.awesome}
            </button>
          </div>
        </div>
      )}

      {/* T6: Active tournament matches */}
      {myMatches.length > 0 && (
        <div style={{ margin: '0 16px 12px' }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 8, display: 'block', padding: '0 2px' }}>
            {tt.yourActiveMatches}
          </div>
          {myMatches.map((match: ActiveMatch) => {
            const isP1 = match.player1?.userId === match.myUserId;
            const opponent = isP1 ? match.player2?.user : match.player1?.user;
            return (
              <div
                key={match.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'linear-gradient(135deg,#141018,#0F0E18)',
                  border: '.5px solid rgba(240,200,90,.25)',
                  borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 20 }}>🏆</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E8E3DB' }}>
                    {match.tournament?.name} · Round {match.round}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#7A7875', marginTop: 2 }}>
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
                    style={{ padding: '7px 14px', borderRadius: 9, border: '.5px solid rgba(212,168,67,.35)', background: 'rgba(212,168,67,.12)', color: '#F0C85A', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {tt.play}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', margin: '4px 16px 12px', gap: 8 }}>
        {(['all', 'joined'] as TFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: filter === f ? '.5px solid rgba(212,168,67,.45)' : '.5px solid rgba(255,255,255,.08)',
              background: filter === f ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
              color: filter === f ? '#F0C85A' : '#7A7875',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            {f === 'all' ? tt.tabAll : tt.tabJoined}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: '0.82rem' }}>
          {t.common.loading}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: '0.82rem' }}>
          {filter === 'joined' ? tt.noJoined : tt.noActive}
        </div>
      )}

      {typeOrder.map(type => {
        const items = grouped[type];
        if (!items?.length) return null;
        return (
          <div key={type}>
            <div style={{ ...LABEL_STYLE, padding: '14px 18px 8px', display: 'block', color: TYPE_COLORS[type] ?? '#D4A843' }}>
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
  const color = TYPE_COLORS[tour.type] ?? '#F5C842';
  const icon = TYPE_ICONS[tour.type] ?? '🏆';
  const endDate = tour.endAt ? new Date(tour.endAt).toLocaleDateString('en-US') : null;

  return (
    <div style={{
      margin: '0 16px 10px',
      background: 'linear-gradient(135deg,#141018,#0F0E18)',
      borderRadius: 16,
      border: `.5px solid rgba(212,168,67,.18)`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', background: `linear-gradient(135deg,${color}10,transparent)`, borderBottom: '.5px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `rgba(212,168,67,.08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color }}>
              {tour.name}
            </div>
            {tour.period && (
              <div style={{ fontSize: '0.72rem', color: '#7A7875', marginTop: 2 }}>
                {tt.period}: {tour.period}
              </div>
            )}
          </div>
          {tour.isJoined && (
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#3DBA7A', background: 'rgba(61,186,122,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              {tt.joined}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 16 }}>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.playersLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.88rem', fontWeight: 700, color: '#E8E3DB' }}>
            {tour.currentPlayers.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.entryFeeLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.88rem', fontWeight: 700, color: '#F0C85A' }}>
            {fmtBalance(tour.entryFee)} ᚙ
          </div>
        </div>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.prizePool}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.88rem', fontWeight: 700, color: '#F0C85A' }}>
            {fmtBalance(tour.totalPool ?? tour.prizePool)} ᚙ
          </div>
        </div>
      </div>

      {/* My stats */}
      {tour.isJoined && tour.myStats && (
        <div style={{ margin: '0 14px 10px', background: 'rgba(61,186,122,0.05)', border: '.5px solid rgba(61,186,122,.2)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ ...LABEL_STYLE, marginBottom: 5, display: 'block', color: '#3DBA7A' }}>
            {tt.myStats}
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3DBA7A' }}>✓ {tour.myStats.wins}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FF4D6A' }}>✗ {tour.myStats.losses}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7A7875' }}>= {tour.myStats.draws}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F0C85A', marginLeft: 'auto' }}>
              Points: {tour.myStats.points.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {endDate && (
        <div style={{ fontSize: '0.7rem', color: '#4A5270', padding: '0 16px 4px' }}>
          {tt.ends}: {endDate}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px' }}>
        <button
          onClick={onView}
          style={{ padding: '8px 12px', borderRadius: 9, border: '.5px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#C4BFB8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {tt.leaderboard}
        </button>
        <button
          onClick={onDonate}
          style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(212,168,67,.08)', color: '#D4A843', border: '.5px solid rgba(212,168,67,.22)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {tt.donateToPrize}
        </button>
        {!tour.isJoined ? (
          <button
            onClick={onJoin}
            disabled={joining}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 9,
              background: 'rgba(212,168,67,.12)', color: '#F0C85A',
              border: '.5px solid rgba(212,168,67,.35)',
              fontSize: '0.78rem', fontWeight: 700, cursor: joining ? 'default' : 'pointer',
              opacity: joining ? 0.6 : 1,
            }}
          >
            {joining ? tt.joining : tt.join}
          </button>
        ) : (
          <button
            onClick={onLeave}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 9,
              background: 'rgba(255,77,106,0.08)', color: '#FF4D6A',
              border: '.5px solid rgba(255,77,106,.2)',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {tt.leave}
          </button>
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
        <div style={{ width: 36, height: 4, background: '#2A2232', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#E8E3DB' }}>🏆 {tt.leaderboard}</div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: '.5px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#7A7875', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        {!data && (
          <div style={{ textAlign: 'center', color: '#4A5270', padding: 24, fontSize: '0.82rem' }}>
            {t.common.loading}
          </div>
        )}
        {data?.players?.map((p: TournamentPlayer, i: number) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: i === 0 ? '#F0C85A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#4A5270', width: 24, textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </div>
            <Avatar user={p.user} size="s" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E8E3DB' }}>{p.user?.firstName}</div>
              <div style={{ fontSize: '0.7rem', color: '#7A7875' }}>{p.wins}W {p.losses}L {p.draws}D</div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.82rem', fontWeight: 700, color: '#F0C85A' }}>
              {p.points?.toFixed(1) ?? '0.0'}
            </div>
          </div>
        ))}
        {!data?.players?.length && data && (
          <div style={{ textAlign: 'center', color: '#4A5270', padding: 16, fontSize: '0.82rem' }}>
            {tt.noParticipants}
          </div>
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
        <div style={{ width: 36, height: 4, background: '#2A2232', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#E8E3DB', marginBottom: 8 }}>{tt.donateToPrize}</div>
        <div style={{ fontSize: '0.75rem', color: '#7A7875', marginBottom: 16 }}>
          {tt.allCoinsToWinners}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                border: amount === v ? '.5px solid rgba(212,168,67,.45)' : '.5px solid rgba(255,255,255,.08)',
                background: amount === v ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.04)',
                color: amount === v ? '#F0C85A' : '#7A7875',
                fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              {fmtBalance(v)}
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            border: '.5px solid rgba(212,168,67,.4)', background: 'linear-gradient(135deg,rgba(212,168,67,.25),rgba(212,168,67,.15))',
            color: '#F0C85A', fontSize: '0.92rem', fontWeight: 700,
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? tt.donateError : `${t.shop.tonTab.buy} ${fmtBalance(amount)} ᚙ`}
        </button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(10px)',
  zIndex: "var(--z-modal, 300)" as any,
  display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(180deg,#100C18,#0A080E)',
  borderRadius: '22px 22px 0 0',
  padding: '16px 20px 28px',
  borderTop: '.5px solid rgba(212,168,67,.18)',
  maxHeight: '85vh',
  overflowY: 'auto',
};
