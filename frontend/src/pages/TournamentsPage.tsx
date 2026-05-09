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
import {
  TOURNAMENT_TYPE_ICON, IcoTrophy,
  IcoLeaderboard, IcoDonate, IcoLock, IcoCheck, IcoSwords, IcoFlag,
} from '@/components/icons/TournamentIcons';

const showToast = (text: string, type: 'error' | 'info' = 'error') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

const TYPE_COLORS: Record<string, string> = {
  WORLD: '#F0C85A', COUNTRY: '#3DBA7A', WEEKLY: '#D4A843',
  MONTHLY: '#F0C85A', SEASONAL: '#C8A843', YEARLY: '#F0C85A',
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  REGISTRATION: { label: 'Регистрация', color: '#3DBA7A', bg: 'rgba(61,186,122,.12)', border: 'rgba(61,186,122,.3)' },
  IN_PROGRESS:  { label: 'Идёт',        color: '#F0C85A', bg: 'rgba(240,200,90,.12)',  border: 'rgba(240,200,90,.3)' },
  FINISHED:     { label: 'Завершён',    color: '#5A5248', bg: 'rgba(90,82,72,.12)',    border: 'rgba(90,82,72,.25)' },
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
    const sock = getSocket();

    const onMatch = (d: unknown) => {
      const data = d as { opponentName?: string; sessionId?: string };
      load(); // refresh match list
      window.dispatchEvent(new CustomEvent('chesscoin:toast', {
        detail: {
          text: tt.tournamentMatch(data.opponentName ?? ''),
          type: 'info',
          actionLabel: tt.play,
          onAction: () => {
            if (data.sessionId) navigate(`/game/${data.sessionId}`);
          },
        },
      }));
    };

    const onFinished = (d: unknown) => {
      setTournamentFinish(d as { tournamentName?: string; prize?: string; place?: number });
    };

    sock.on('tournament:match', onMatch);
    sock.on('tournament:finished', onFinished);

    // T7: listen for tournament finish event from useSocket (window CustomEvent fallback)
    const finishHandler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data) setTournamentFinish(data);
    };
    window.addEventListener('chesscoin:tournament:finished', finishHandler);

    return () => {
      sock.off('tournament:match', onMatch);
      sock.off('tournament:finished', onFinished);
      window.removeEventListener('chesscoin:tournament:finished', finishHandler);
    };
  }, []);

  useEffect(() => { load(); }, []);

  const handleJoin = async (tour: TournamentFull) => {
    // Подтверждение со ставкой и предупреждением о невозврате
    const fee = BigInt(tour.entryFee || '0');
    const message = fee > 0n
      ? `Взнос: ${fmtBalance(tour.entryFee)} ᚙ\n\nВзнос идёт в призовой фонд и НЕ возвращается при выходе из турнира.`
      : `Бесплатное участие.\n\nПосле вступления вы не сможете выйти после старта турнира.`;
    const ok = await confirm({
      title: `Вступить в "${tour.name}"?`,
      message,
      okLabel: fee > 0n ? `Внести ${fmtBalance(tour.entryFee)} ᚙ` : 'Вступить',
      cancelLabel: 'Отмена',
    });
    if (!ok) return;

    setJoiningId(tour.id);
    try {
      await tournamentsApi.join(tour.id);
      await load();
    } catch (e: unknown) {
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340, background: 'linear-gradient(135deg,#141018,#0F0E18)', borderRadius: 20, padding: 28, border: '.5px solid rgba(245,200,66,0.35)', textAlign: 'center', boxShadow: '0 0 60px rgba(245,200,66,0.12)' }}>
            <div style={{ color: '#F0C85A', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <IcoTrophy size={56} />
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F0C85A', marginBottom: 8 }}>
              {tournamentFinish.tournamentName ?? tt.title}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3DBA7A', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              +{tournamentFinish.prize ? `${Number(tournamentFinish.prize).toLocaleString()} ᚙ` : '—'}
            </div>
            {tournamentFinish.place && (
              <div style={{ fontSize: '0.78rem', color: '#7A7875', marginBottom: 24, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                {tournamentFinish.place} {t.common.place}
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
                <div style={{ color: '#F0C85A', flexShrink: 0 }}>
                  <IcoTrophy size={20} />
                </div>
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
                    style={{ padding: '7px 14px', borderRadius: 9, border: '.5px solid rgba(212,168,67,.35)', background: 'rgba(212,168,67,.12)', color: '#F0C85A', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
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
        <div style={{ textAlign: 'center', color: '#5A5248', padding: 32, fontSize: '0.82rem' }}>
          {t.common.loading}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#5A5248', padding: 32, fontSize: '0.82rem' }}>
          {filter === 'joined' ? tt.noJoined : tt.noActive}
        </div>
      )}

      {typeOrder.map(type => {
        const items = grouped[type];
        if (!items?.length) return null;
        const SectionIcon = TOURNAMENT_TYPE_ICON[type] ?? IcoTrophy;
        return (
          <div key={type}>
            <div style={{ ...LABEL_STYLE, padding: '14px 18px 8px', display: 'flex', alignItems: 'center', gap: 6, color: TYPE_COLORS[type] ?? '#D4A843' }}>
              <SectionIcon size={12} />
              <span>{items[0].typeLabel}</span>
            </div>
            {items.map(item => {
              const activeMatch = myMatches.find(m => m.tournamentId === item.id || m.tournament?.id === item.id || m.tournament?.name === item.name);
              return (
                <TournamentCard
                  key={item.id}
                  tour={item}
                  activeMatch={activeMatch}
                  onJoin={() => handleJoin(item)}
                  onLeave={() => handleLeave(item.id)}
                  onView={() => setSelected(item.id)}
                  onDonate={() => setDonateModal(item.id)}
                  onPlayMatch={() => activeMatch?.sessionId && navigate(`/game/${activeMatch.sessionId}`)}
                  joining={joiningId === item.id}
                />
              );
            })}
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
  tour: TournamentFull;
  activeMatch?: ActiveMatch;
  onJoin: () => void;
  onLeave: () => void;
  onView: () => void;
  onDonate: () => void;
  onPlayMatch: () => void;
  joining: boolean;
}> = ({ tour, activeMatch, onJoin, onLeave, onView, onDonate, onPlayMatch, joining }) => {
  const t = useT();
  const tt = t.tournaments;
  const color = TYPE_COLORS[tour.type] ?? '#F0C85A';
  const TypeIcon = TOURNAMENT_TYPE_ICON[tour.type] ?? IcoTrophy;
  const endDate = tour.endAt ? new Date(tour.endAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : null;
  const statusCfg = STATUS_CFG[tour.status] ?? STATUS_CFG.REGISTRATION;
  const canJoin = tour.status === 'REGISTRATION';
  const isFinished = tour.status === 'FINISHED';

  const matchOpponent = activeMatch
    ? (activeMatch.player1?.userId === activeMatch.myUserId ? activeMatch.player2?.user : activeMatch.player1?.user)
    : null;

  return (
    <div style={{
      margin: '0 16px 10px',
      background: 'linear-gradient(160deg,#141018 0%,#0F0E18 100%)',
      borderRadius: 18,
      border: tour.isJoined
        ? `.5px solid rgba(61,186,122,.25)`
        : `.5px solid rgba(212,168,67,.15)`,
      overflow: 'hidden',
      opacity: isFinished ? 0.7 : 1,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        background: `linear-gradient(135deg,${color}14,transparent)`,
        borderBottom: '.5px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Type icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `${color}14`,
            border: `.5px solid ${color}30`,
            color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TypeIcon size={22} />
          </div>

          {/* Name + period */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tour.name}
            </div>
            {tour.period && (
              <div style={{ fontSize: '0.65rem', color: '#5A5248', marginTop: 2 }}>
                {tour.period}
              </div>
            )}
          </div>

          {/* Badges: status + joined */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '.06em',
              color: statusCfg.color, background: statusCfg.bg,
              border: `.5px solid ${statusCfg.border}`,
              padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase',
            }}>
              {statusCfg.label}
            </div>
            {tour.isJoined && (
              <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#3DBA7A', background: 'rgba(61,186,122,.1)', padding: '2px 7px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IcoCheck size={9} /> Участник
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 14px', gap: 8, borderBottom: '.5px solid rgba(255,255,255,.04)' }}>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.playersLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.82rem', fontWeight: 700, color: '#EAE2CC' }}>
            {tour.currentPlayers.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.entryFeeLabel}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.82rem', fontWeight: 700, color: '#F0C85A' }}>
            {tour.entryFee === '0' ? 'Бесплатно' : `${fmtBalance(tour.entryFee)} ᚙ`}
          </div>
        </div>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>{tt.prizePool}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.82rem', fontWeight: 700, color: '#F0C85A' }}>
            {fmtBalance(tour.totalPool ?? tour.prizePool)} ᚙ
          </div>
        </div>
      </div>

      {/* ── Активный матч → PLAY NOW ── */}
      {tour.isJoined && activeMatch?.sessionId && (
        <button
          onClick={onPlayMatch}
          style={{
            width: '100%', padding: '11px 16px',
            background: 'linear-gradient(135deg,rgba(61,186,122,.18),rgba(61,186,122,.08))',
            border: 'none', borderBottom: '.5px solid rgba(61,186,122,.2)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10,
            color: '#3DBA7A',
          }}
        >
          <IcoSwords size={20} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#3DBA7A' }}>
              Играть матч — Раунд {activeMatch.round}
            </div>
            {matchOpponent && (
              <div style={{ fontSize: '0.68rem', color: '#5A9E75', marginTop: 1 }}>
                vs {matchOpponent.firstName}
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3DBA7A' }}>›</span>
        </button>
      )}

      {/* Мои статы (если участник) */}
      {tour.isJoined && tour.myStats && !activeMatch?.sessionId && (
        <div style={{ margin: '8px 12px', background: 'rgba(61,186,122,.05)', border: '.5px solid rgba(61,186,122,.15)', borderRadius: 10, padding: '7px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3DBA7A' }}>{tour.myStats.wins}В</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FF5B5B' }}>{tour.myStats.losses}П</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7A7875' }}>{tour.myStats.draws}Н</span>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#F0C85A', fontFamily: "'JetBrains Mono',monospace" }}>
              {tour.myStats.points.toFixed(1)} pts
            </span>
          </div>
        </div>
      )}

      {endDate && (
        <div style={{ fontSize: '0.65rem', color: '#5A5248', padding: '4px 14px 0' }}>
          До {endDate}
        </div>
      )}

      {/* Actions: главная кнопка (Вступить/Выйти) + 2 иконки справа (Лидеры, Донат) */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', alignItems: 'stretch', gap: 7 }}>
        {/* Главная CTA */}
        <div style={{ flex: 1 }}>
        {!tour.isJoined ? (
          canJoin ? (
            <button
              onClick={onJoin}
              disabled={joining}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: 11,
                background: joining ? 'rgba(212,168,67,.08)' : 'linear-gradient(135deg,#2A1E08,#4A3810)',
                color: '#F0C85A',
                border: '.5px solid rgba(212,168,67,.4)',
                fontSize: '0.85rem', fontWeight: 800, cursor: joining ? 'default' : 'pointer',
                opacity: joining ? 0.7 : 1, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              {joining ? (
                <>Вступаем…</>
              ) : (
                <>
                  <IcoTrophy size={16} />
                  <span>{tt.join}{tour.entryFee !== '0' ? ` · ${fmtBalance(tour.entryFee)} ᚙ` : ''}</span>
                </>
              )}
            </button>
          ) : (
            <div style={{
              padding: '11px 14px', borderRadius: 11,
              background: 'rgba(90,82,72,.08)', border: '.5px solid rgba(90,82,72,.2)',
              color: '#5A5248', fontSize: '0.78rem', fontWeight: 600,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {isFinished ? <><IcoFlag size={13} /> Турнир завершён</> : <><IcoLock size={13} /> Регистрация закрыта</>}
            </div>
          )
        ) : (
          tour.status === 'REGISTRATION' ? (
            <button
              onClick={onLeave}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: 11,
                background: 'rgba(255,91,91,.07)', color: '#FF5B5B',
                border: '.5px solid rgba(255,91,91,.2)',
                fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {tt.leave}
            </button>
          ) : (
            <div style={{
              padding: '11px 14px', borderRadius: 11,
              background: 'rgba(61,186,122,.06)', border: '.5px solid rgba(61,186,122,.18)',
              color: '#3DBA7A', fontSize: '0.74rem', fontWeight: 700,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {isFinished ? <><IcoFlag size={13} /> Участвовал</> : <><IcoCheck size={11} /> Матчи назначаются автоматически</>}
            </div>
          )
        )}
        </div>

        {/* Иконки-кнопки справа: Лидерборд + Донат */}
        <button
          onClick={onView}
          title={tt.leaderboard}
          style={{
            width: 44, flexShrink: 0,
            borderRadius: 11,
            border: '.5px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
            color: '#9A9490', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IcoLeaderboard size={18} />
        </button>
        <button
          onClick={onDonate}
          title="Донат в призовой фонд"
          style={{
            width: 44, flexShrink: 0,
            borderRadius: 11,
            background: 'rgba(212,168,67,.07)', color: '#D4A843',
            border: '.5px solid rgba(212,168,67,.2)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IcoDonate size={18} />
        </button>
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
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#E8E3DB', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoLeaderboard size={18} /> {tt.leaderboard}
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: '.5px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#7A7875', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}
            aria-label="Закрыть"
          >×</button>
        </div>
        {!data && (
          <div style={{ textAlign: 'center', color: '#5A5248', padding: 24, fontSize: '0.82rem' }}>
            {t.common.loading}
          </div>
        )}
        {data?.players?.map((p: TournamentPlayer, i: number) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.82rem', fontWeight: 800, color: i === 0 ? '#F0C85A' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#5A5248', width: 24, textAlign: 'center' }}>
              {i + 1}
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
          <div style={{ textAlign: 'center', color: '#5A5248', padding: 16, fontSize: '0.82rem' }}>
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
  background: 'rgba(0,0,0,.82)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  zIndex: 300,
  display: 'flex', alignItems: 'flex-end',
  // iOS safe-area: не прижимаем боттом-шит к системной панели жестов
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};
const modalStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(180deg,#100C18,#0A080E)',
  borderRadius: '22px 22px 0 0',
  // +8px к нижнему паддингу, чтобы кнопки «Донат»/Закрыть не съедались home-indicator'ом
  padding: '16px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
  borderTop: '.5px solid rgba(212,168,67,.18)',
  maxHeight: '85vh',
  overflowY: 'auto',
};
