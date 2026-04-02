import React, { useEffect, useState } from 'react';
import { PageLayout, useInfoPopup, InfoPopup } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { tournamentsApi } from '@/api';
import { getSocket } from '@/api/socket';
import { fmtBalance } from '@/utils/format';
import { useConfirm } from '@/components/ui/ConfirmModal';
import type { TournamentFull, ActiveMatch, League } from '@/types'; // R1
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Heading } from '@/components/ui/Heading';
import { Card } from '@/components/ui/Card';

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
        <div style={{ position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)", background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Card padding="lg" style={{ width: '100%', maxWidth: 340, background: 'linear-gradient(135deg,#161927,#1A2040)', border: '1px solid rgba(245,200,66,0.35)', textAlign: 'center', boxShadow: '0 0 60px rgba(245,200,66,0.15)' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🏆</div>
            <Heading level={2} color="--color-accent-gold" style={{ marginBottom: 8 }}>
              {tournamentFinish.tournamentName ?? tt.title}
            </Heading>
            <Text variant="body" weight="bold" style={{ fontSize: 22, color: '#00D68F', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              +{tournamentFinish.prize ? `${Number(tournamentFinish.prize).toLocaleString()} ᚙ` : '—'}
            </Text>
            {tournamentFinish.place && (
              <Text variant="caption" color="--color-text-secondary" style={{ marginBottom: 24 }}>
                {tournamentFinish.place === 1 ? '🥇' : tournamentFinish.place === 2 ? '🥈' : '🥉'} {tournamentFinish.place} {t.common.place}
              </Text>
            )}
            <Button variant="primary" size="md" fullWidth onClick={() => setTournamentFinish(null)}>
              {tt.awesome}
            </Button>
          </Card>
        </div>
      )}

      {/* T6: Active tournament matches */}
      {myMatches.length > 0 && (
        <div style={{ margin: '0 18px 12px' }}>
          <Text variant="caption" color="--color-accent-gold" weight="bold" style={{ letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
            {tt.yourActiveMatches}
          </Text>
          {myMatches.map((match: ActiveMatch) => {
            const isP1 = match.player1?.userId === match.myUserId;
            const opponent = isP1 ? match.player2?.user : match.player1?.user;
            return (
              <Card key={match.id} padding="md" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.2)', marginBottom: 8 }}>
                <div style={{ fontSize: 20 }}>🏆</div>
                <div style={{ flex: 1 }}>
                  <Text variant="body" weight="bold">
                    {match.tournament?.name} · Round {match.round}
                  </Text>
                  <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 2 }}>
                    vs {opponent?.firstName ?? t.game.opponent}
                  </Text>
                </div>
                {match.sessionId && (
                  <Button
                    variant="primary"
                    size="sm"
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
                  >
                    {tt.play}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', margin: '4px 18px 10px', gap: 8 }}>
        <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" fullWidth onClick={() => setFilter('all')}>
          {tt.tabAll}
        </Button>
        <Button variant={filter === 'joined' ? 'primary' : 'secondary'} size="sm" fullWidth onClick={() => setFilter('joined')}>
          {tt.tabJoined}
        </Button>
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
            <Text variant="caption" weight="bold" style={{ fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', padding: '16px 18px 8px', color: TYPE_COLORS[type], display: 'block' }}>
              {TYPE_ICONS[type]} {items[0].typeLabel}
            </Text>
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
    <Card style={{ margin: '0 18px 10px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', background: `linear-gradient(135deg,${color}12,transparent)`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <Heading level={3} color={color} style={{ fontSize: 14 }}>
              {tour.name}
            </Heading>
            {tour.period && (
              <Text variant="caption" color="--color-text-secondary" style={{ marginTop: 2 }}>
                {tt.period}: {tour.period}
              </Text>
            )}
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
          <Text variant="caption" color="--color-text-muted">{tt.playersLabel}</Text>
          <Text variant="body" weight="bold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, marginTop: 2 }}>
            {tour.currentPlayers.toLocaleString()}
          </Text>
        </div>
        <div>
          <Text variant="caption" color="--color-text-muted">{tt.entryFeeLabel}</Text>
          <Text variant="body" weight="bold" color="--color-accent-gold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, marginTop: 2 }}>
            {fmtBalance(tour.entryFee)} ᚙ
          </Text>
        </div>
        <div>
          <Text variant="caption" color="--color-text-muted">{tt.prizePool}</Text>
          <Text variant="body" weight="bold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, color, marginTop: 2 }}>
            {fmtBalance(tour.totalPool ?? tour.prizePool)} ᚙ
          </Text>
        </div>
      </div>

      {tour.isJoined && tour.myStats && (
        <Card padding="sm" style={{ margin: '0 14px 10px', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.15)' }}>
          <Text variant="caption" weight="bold" color="var(--green, #00D68F)" style={{ marginBottom: 4, display: 'block' }}>
            {tt.myStats}
          </Text>
          <div style={{ display: 'flex', gap: 14 }}>
            <Text variant="body" weight="bold" style={{ color: 'var(--green, #00D68F)' }}>✓ {tour.myStats.wins}</Text>
            <Text variant="body" weight="bold" style={{ color: 'var(--red, #FF4D6A)' }}>✗ {tour.myStats.losses}</Text>
            <Text variant="body" weight="bold" color="--color-text-secondary">= {tour.myStats.draws}</Text>
            <Text variant="body" weight="bold" color="--color-accent-gold" style={{ marginLeft: 'auto' }}>
              Points: {tour.myStats.points.toFixed(1)}
            </Text>
          </div>
        </Card>
      )}

      {endDate && (
        <Text variant="caption" color="--color-text-muted" style={{ padding: '0 16px 4px', display: 'block' }}>
          {tt.ends}: {endDate}
        </Text>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px' }}>
        <Button variant="secondary" size="sm" onClick={onView}>
          {tt.leaderboard}
        </Button>
        <Button variant="tertiary" size="sm" onClick={onDonate} style={{ background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)' }}>
          {tt.donateToPrize}
        </Button>
        {!tour.isJoined ? (
          <Button variant="primary" size="sm" fullWidth onClick={onJoin} disabled={joining} style={{ opacity: joining ? 0.6 : 1 }}>
            {joining ? tt.joining : tt.join}
          </Button>
        ) : (
          <Button variant="danger" size="sm" fullWidth onClick={onLeave} style={{ background: 'rgba(255,77,106,0.1)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.2)' }}>
            {tt.leave}
          </Button>
        )}
      </div>
    </Card>
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
          <Heading level={2}>🏆 {tt.leaderboard}</Heading>
          <Button variant="tertiary" size="sm" onClick={onClose}>✕</Button>
        </div>
        {!data && (
          <Text variant="body" style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24 }}>
            {t.common.loading}
          </Text>
        )}
        {data?.players?.map((p: TournamentPlayer, i: number) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Text variant="body" weight="bold" style={{ fontSize: 13, color: i === 0 ? 'var(--accent, #F5C842)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted, #4A5270)', width: 24, textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </Text>
            <Avatar user={p.user} size="s" />
            <div style={{ flex: 1 }}>
              <Text variant="body" weight="bold">{p.user?.firstName}</Text>
              <Text variant="caption" color="--color-text-secondary">{p.wins}W {p.losses}L {p.draws}D</Text>
            </div>
            <Text variant="body" weight="bold" color="--color-accent-gold" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14 }}>
              {p.points?.toFixed(1) ?? '0.0'}
            </Text>
          </div>
        ))}
        {!data?.players?.length && data && (
          <Text variant="body" style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 16 }}>
            {tt.noParticipants}
          </Text>
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
        <Heading level={2} style={{ marginBottom: 8 }}>{tt.donateToPrize}</Heading>
        <Text variant="caption" color="--color-text-secondary" style={{ marginBottom: 16, display: 'block' }}>
          {tt.allCoinsToWinners}
        </Text>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <Button
              key={v}
              variant={amount === v ? 'primary' : 'secondary'}
              size="sm"
              fullWidth
              onClick={() => setAmount(v)}
            >
              {fmtBalance(v)}
            </Button>
          ))}
        </div>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? tt.donateError : `${t.shop.tonTab.buy} ${fmtBalance(amount)} ᚙ`}
        </Button>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: "var(--z-modal, 300)", display: 'flex', alignItems: 'flex-end' };
const modalStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-card, #161927)', borderRadius: '24px 24px 0 0', padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh', overflowY: 'auto' };
const handleBar: React.CSSProperties = { width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' };
