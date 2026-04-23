import React, { useEffect, useState, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { nationsApi, clanBattlesApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { Nation, ClanWar, ClanMemberData, ClanBattle } from '@/types';
import { useT } from '@/i18n/useT';

const showToast = (text: string, type: 'error' | 'info' = 'error') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

type Tab = 'clan' | 'wars' | 'battles' | 'members' | 'ranking';

export const NationsPage: React.FC = () => {
  const t = useT();
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('ranking');
  const [nations, setNations] = useState<Nation[]>([]);
  const [myClan, setMyClan] = useState<any>(null);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [activeWar, setActiveWar] = useState<ClanWar | null>(null);
  const [members, setMembers] = useState<ClanMemberData[]>([]);
  const [wars, setWars] = useState<ClanWar[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [battles, setBattles] = useState<ClanBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const [showWarChallenge, setShowWarChallenge] = useState(false);
  const [showBattleChallenge, setShowBattleChallenge] = useState(false);
  const [showJoinBattle, setShowJoinBattle] = useState<ClanBattle | null>(null);
  const [showJoin, setShowJoin] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, myRes, warsRes, battlesRes] = await Promise.all([
        nationsApi.list(),
        nationsApi.getMy(),
        nationsApi.getWars(),
        clanBattlesApi.list().catch(() => ({ battles: [] })),
      ]);
      setNations(listRes.clans);
      setMyClan(myRes.clan);
      setMyMembership(myRes.membership);
      setActiveWar(myRes.activeWar);
      setWars(warsRes.wars);
      setBattles(battlesRes.battles ?? []);

      if (myRes.clan && myRes.membership?.role === 'COMMANDER') {
        const cRes = await nationsApi.getChallenges();
        setChallenges(cRes.challenges);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!myClan) return;
    const res = await nationsApi.getMembers();
    setMembers(res.members);
  }, [myClan]);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab]);

  const handleLeave = async () => {
    if (!confirm(t.nations.leaveConfirm)) return;
    await nationsApi.leave();
    await load();
    setTab('ranking');
  };

  const handleApprove = async (memberId: string, approve: boolean) => {
    await nationsApi.approveMember(memberId, approve);
    await loadMembers();
  };

  const handleKick = async (targetUserId: string) => {
    if (!confirm(t.nations.kickConfirm)) return;
    await nationsApi.kickMember(targetUserId);
    await loadMembers();
  };

  const handleAcceptWar = async (warId: string) => {
    await nationsApi.acceptWar(warId);
    await load();
  };

  const isLeader = myMembership?.role === 'COMMANDER';
  const pendingMembers = members.filter(m => m.isPending);
  const activeMembers = members.filter(m => !m.isPending);

  return (
    <PageLayout title={t.nations.title} backTo="/" centered>
      {/* Мой клан — шапка */}
      {myClan && myMembership && (
        <div style={clanHeroStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 44 }}>{myClan.flag}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>{myClan.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 3 }}>
                {isLeader ? t.nations.leader : t.nations.fighter} · {t.nations.fightersCount(myClan._count?.members ?? 0)}
              </div>
            </div>
            <button onClick={handleLeave} style={leaveBtn}>{t.nations.leave}</button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <Stat val={fmtBalance(myClan.treasury ?? '0')} lbl={t.nations.treasury} color="var(--accent, #F5C842)" />
            <Stat val={myClan.totalWarWins ?? 0} lbl={t.nations.wins} color="var(--green, #00D68F)" />
            <Stat val={myClan.totalWarLosses ?? 0} lbl={t.nations.losses} color="var(--red, #FF4D6A)" />
            <Stat val={myClan.elo ?? 1000} lbl="ELO" color="#9B85FF" />
          </div>

          {/* Активная война */}
          {activeWar && !activeWar.isPending && (
            <div style={warBannerStyle}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--red, #FF4D6A)', letterSpacing: '.08em', marginBottom: 8 }}>
                {t.nations.activeWar}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>{activeWar.attackerClan.flag}</span>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>
                    {activeWar.attackerWins}:{activeWar.defenderWins}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                    {fmtBalance(activeWar.prize ?? '0')} ᚙ {t.nations.atStake}
                  </div>
                </div>
                <span style={{ fontSize: 24 }}>{activeWar.defenderClan.flag}</span>
              </div>
              {activeWar.endAt && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', textAlign: 'center', marginTop: 6 }}>
                  {t.nations.endsAt(new Date(activeWar.endAt).toLocaleDateString())}
                </div>
              )}
            </div>
          )}

          {/* Вызовы войны (для лидера) */}
          {isLeader && challenges.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {challenges.map(ch => (
                <div key={ch.id} style={challengeCardStyle}>
                  <span style={{ fontSize: 22 }}>{ch.attackerClan.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red, #FF4D6A)' }}>{t.nations.warChallenge}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)' }}>{ch.attackerClan.name} · {t.nations.treasuryLabel} {fmtBalance(ch.attackerClan.treasury ?? '0')} ᚙ</div>
                  </div>
                  <button onClick={() => handleAcceptWar(ch.id)} style={acceptWarBtn}>{t.nations.accept}</button>
                </div>
              ))}
            </div>
          )}

          {/* Кнопки действий */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setShowContribute(true)} style={secBtn}>{t.nations.contribute}</button>
            {isLeader && !activeWar && (
              <button onClick={() => setShowWarChallenge(true)} style={{ ...secBtn, background: 'rgba(255,77,106,0.1)', borderColor: 'rgba(255,77,106,0.3)', color: 'var(--red, #FF4D6A)' }}>
                {t.nations.declareWar}
              </button>
            )}
            <button
              onClick={() => setShowBattleChallenge(true)}
              style={{ ...secBtn, background: 'rgba(123,97,255,0.1)', borderColor: 'rgba(123,97,255,0.3)', color: '#7B61FF' }}
            >
              {t.nations.battle}
            </button>
            <button onClick={() => setTab('members')} style={secBtn}>{t.nations.fighters}</button>
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div style={segStyle}>
        {myClan && <button style={segBtn(tab === 'clan')} onClick={() => setTab('clan')}>{t.nations.tabs.clan}</button>}
        <button style={segBtn(tab === 'battles')} onClick={() => setTab('battles')}>{t.nations.tabs.battles}</button>
        <button style={segBtn(tab === 'wars')} onClick={() => setTab('wars')}>{t.nations.tabs.wars}</button>
        {myClan && <button style={segBtn(tab === 'members')} onClick={() => setTab('members')}>{t.nations.tabs.members}</button>}
        <button style={segBtn(tab === 'ranking')} onClick={() => setTab('ranking')}>{t.nations.tabs.ranking}</button>
      </div>

      {/* Список войн */}
      {tab === 'wars' && (
        <>
          <div style={secStyle}>{t.nations.activeWars}</div>
          {wars.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32, fontSize: 13 }}>
              {t.nations.noActiveWars}
            </div>
          )}
          {wars.map(war => (
            <div key={war.id} style={warCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>{war.attackerClan.flag}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary, #F0F2F8)', fontWeight: 600 }}>{war.attackerClan.name}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>
                    {war.attackerWins}:{war.defenderWins}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--accent, #F5C842)', fontWeight: 700 }}>
                    {fmtBalance(war.prize ?? '0')} ᚙ
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>{war.defenderClan.flag}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary, #F0F2F8)', fontWeight: 600 }}>{war.defenderClan.name}</div>
                </div>
              </div>
              {war.endAt && (
                <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', textAlign: 'center' }}>
                  {t.nations.untilDate(new Date(war.endAt).toLocaleDateString())}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Клановые сражения */}
      {tab === 'battles' && (
        <>
          <div style={{ margin: '0 18px 12px', padding: '12px 14px', background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7B61FF', marginBottom: 4 }}>{t.nations.howBattlesWork}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {t.nations.battlesDesc}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px 10px' }}>
            <div style={secStyle}>{t.nations.activeBattles(battles.length)}</div>
            {myClan && (
              <button onClick={() => setShowBattleChallenge(true)} style={{ padding: '7px 14px', background: '#7B61FF', color: '#fff', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.nations.newChallenge}
              </button>
            )}
          </div>

          {battles.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: '24px 0', fontSize: 13 }}>
              {t.nations.noBattles}
            </div>
          )}

          {battles.map(b => {
            const myClid = myMembership?.clanId;
            const isParticipant = myClid === b.challengerClanId || myClid === b.defenderClanId;
            const isJoined = !!b.myContribution;
            const chWinRate = b.totalGames > 0 ? Math.round((b.challengerWins / b.totalGames) * 100) : 0;
            const defWinRate = b.totalGames > 0 ? Math.round((b.defenderWins / b.totalGames) * 100) : 0;
            const timeLeft = b.endAt ? Math.max(0, new Date(b.endAt).getTime() - Date.now()) : null;
            const hours = timeLeft != null ? Math.floor(timeLeft / 3600000) : null;
            const days  = hours != null ? Math.floor(hours / 24) : null;
            const timeStr = days != null
              ? days > 0 ? `${days}d ${hours! % 24}h` : `${hours}h`
              : '—';

            return (
              <div key={b.id} style={{ margin: '0 18px 12px', background: 'var(--bg-card, #13161E)', border: '1px solid rgba(123,97,255,0.2)', borderRadius: 18, overflow: 'hidden' }}>
                {/* Статус */}
                <div style={{ background: 'rgba(123,97,255,0.08)', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: b.status === 'IN_PROGRESS' ? 'var(--green, #00D68F)' : '#FF9F43', letterSpacing: '.07em' }}>
                    {b.status === 'IN_PROGRESS' ? t.nations.inProgress : t.nations.waiting}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
                    {b.status === 'IN_PROGRESS' && timeLeft != null ? `⏰ ${timeStr}` : t.nations.duration(Math.floor(b.duration / 3600))}
                  </span>
                </div>

                {/* Клубы и счёт */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 8px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 26 }}>{b.challengerClan.flag}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginTop: 4 }}>{b.challengerClan.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: 'var(--accent, #F5C842)', marginTop: 6 }}>{b.challengerWins}</div>
                    {b.totalGames > 0 && <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>{chWinRate}%</div>}
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 4 }}>vs</div>
                    <div style={{ fontSize: 10, color: 'var(--accent, #F5C842)', fontWeight: 700 }}>{fmtBalance(b.pool)} ᚙ</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 4 }}>
                      {b.activeGames}/{b.maxSimultaneous} {t.nations.games}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
                      {b._count?.contributions ?? 0} {t.nations.players}
                    </div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 26 }}>{b.defenderClan.flag}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginTop: 4 }}>{b.defenderClan.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: 'var(--accent, #F5C842)', marginTop: 6 }}>{b.defenderWins}</div>
                    {b.totalGames > 0 && <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>{defWinRate}%</div>}
                  </div>
                </div>

                {/* Win-rate bars */}
                {b.totalGames > 0 && (
                  <div style={{ display: 'flex', height: 4, margin: '0 14px 12px', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${chWinRate}%`, background: '#7B61FF' }} />
                    <div style={{ flex: 1, background: 'var(--border, rgba(255,255,255,0.07))' }} />
                    <div style={{ width: `${defWinRate}%`, background: 'var(--accent, #F5C842)' }} />
                  </div>
                )}

                {/* Действие */}
                {isParticipant && !isJoined && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <button onClick={() => setShowJoinBattle(b)} style={{ width: '100%', padding: '10px', background: '#7B61FF', color: '#fff', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t.nations.joinBattle}
                    </button>
                  </div>
                )}
                {isJoined && (
                  <div style={{ padding: '0 14px 12px', fontSize: 11, color: 'var(--green, #00D68F)', textAlign: 'center' }}>
                    {t.nations.participating} · {t.nations.betAmount(fmtBalance(b.myContribution!.amount))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Список участников */}
      {tab === 'members' && myClan && (
        <>
          {pendingMembers.length > 0 && isLeader && (
            <>
              <div style={{ ...secStyle, color: '#FF9F43' }}>{t.nations.pendingApproval(pendingMembers.length)}</div>
              {pendingMembers.map(m => (
                <div key={m.id} style={memberCardStyle}>
                  <Avatar user={m.user} size="s" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{m.user?.firstName ?? t.nations.player}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>
                      ELO {m.user?.elo ?? '?'} · {t.nations.contribution}: {fmtBalance(m.pendingContribution ?? '0')} ᚙ
                    </div>
                  </div>
                  <button onClick={() => handleApprove(m.id, true)} style={approveBtn}>✓</button>
                  <button onClick={() => handleApprove(m.id, false)} style={rejectBtn}>✕</button>
                </div>
              ))}
            </>
          )}

          <div style={secStyle}>{t.nations.clanFighters(activeMembers.length)}</div>
          {activeMembers.map((m, i) => (
            <div key={m.id} style={memberCardStyle}>
              <span style={{ fontSize: 11, color: i < 3 ? 'var(--accent, #F5C842)' : 'var(--text-muted, #4A5270)', width: 20, flexShrink: 0 }}>
                {i + 1}
              </span>
              <Avatar user={m.user} size="s" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{m.user?.firstName ?? t.nations.player}</span>
                  {m.role === 'COMMANDER' && <span style={{ fontSize: 10, color: 'var(--accent, #F5C842)' }}>👑</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                  ELO {m.user?.elo ?? '?'} · {m.warWins}W/{m.warLosses}L · {t.nations.contribution} {fmtBalance(m.contribution ?? '0')} ᚙ
                </div>
              </div>
              {isLeader && m.userId !== user?.id && !m.isPending && (
                <button onClick={() => handleKick(m.userId)} style={kickBtn}>✕</button>
              )}
            </div>
          ))}
        </>
      )}

      {/* Рейтинг */}
      {tab === 'ranking' && (
        <>
          <div style={secStyle}>{t.nations.ranking}</div>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24 }}>{t.common.loading}</div>}
          {nations.map((n, i) => (
            <div key={n.id} style={nationRowStyle}>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? 'var(--accent, #F5C842)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted, #4A5270)', width: 20 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 24 }}>{n.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{n.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                  {t.nations.fightersCount(n._count?.members ?? n.memberCount ?? 0)} · ELO {n.elo ?? n.avgElo ?? 1000}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
                  {n.elo ?? n.avgElo ?? 1000}
                </div>
                {n.id !== (myClan?.id) && !myClan && (
                  <button onClick={() => setShowJoin(n.id)} style={joinBtn}>{t.nations.join}</button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Модалы */}
      {showContribute && myClan && (
        <ContributeModal
          clanName={myClan.name}
          clanFlag={myClan.flag}
          onClose={() => setShowContribute(false)}
          onSuccess={() => { setShowContribute(false); load(); }}
        />
      )}
      {showWarChallenge && (
        <WarChallengeModal
          nations={nations.filter(n => n.id !== myClan?.id)}
          onClose={() => setShowWarChallenge(false)}
          onSuccess={() => { setShowWarChallenge(false); load(); }}
        />
      )}
      {showJoin && (
        <JoinClanModal
          clanId={showJoin}
          clan={nations.find(n => n.id === showJoin)}
          onClose={() => setShowJoin(null)}
          onSuccess={() => { setShowJoin(null); load(); setTab('clan'); }}
        />
      )}
      {showBattleChallenge && myClan && (
        <BattleChallengeModal
          myClan={myClan}
          nations={nations.filter(n => n.id !== myClan.id)}
          onClose={() => setShowBattleChallenge(false)}
          onSuccess={() => { setShowBattleChallenge(false); load(); setTab('battles'); }}
        />
      )}
      {showJoinBattle && (
        <JoinBattleModal
          battle={showJoinBattle}
          myClanId={myMembership?.clanId ?? ''}
          onClose={() => setShowJoinBattle(null)}
          onSuccess={() => { setShowJoinBattle(null); load(); }}
        />
      )}
    </PageLayout>
  );
};

// ─── Sub-modals ───────────────────────────────────────────────────────────────
const ContributeModal: React.FC<{ clanName: string; clanFlag: string; onClose: () => void; onSuccess: () => void }> = ({ clanName, clanFlag, onClose, onSuccess }) => {
  const t = useT();
  const [amount, setAmount] = useState('10000');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await nationsApi.contribute(amount);
      onSuccess();
    } catch (e: unknown) { showToast((e as Error).message ?? t.common.error); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{t.nations.contributeTitle(clanFlag, clanName)}</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 16 }}>
          {t.nations.contributeDesc}
        </div>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={inputStyle}
          min="1000"
          placeholder={t.nations.amount}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <button key={v} onClick={() => setAmount(v)} style={chipBtn(amount === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? t.nations.sending : t.nations.contributeBtn(fmtBalance(amount))}
        </button>
      </div>
    </div>
  );
};

const WarChallengeModal: React.FC<{ nations: Nation[]; onClose: () => void; onSuccess: () => void }> = ({ nations, onClose, onSuccess }) => {
  const t = useT();
  const [targetId, setTargetId] = useState('');
  const [duration, setDuration] = useState(86400);
  const [loading, setLoading] = useState(false);
  const DURATIONS = [{ v: 3600, l: t.nations.dur1h }, { v: 86400, l: t.nations.dur1d }, { v: 604800, l: t.nations.dur1w }, { v: 2592000, l: t.nations.dur1m }];
  const handleSubmit = async () => {
    if (!targetId) { showToast(t.nations.selectCountry); return; }
    setLoading(true);
    try {
      await nationsApi.challengeWar(targetId, duration);
      onSuccess();
    } catch (e: unknown) { showToast((e as Error).message ?? t.common.error); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--red, #FF4D6A)' }}>{t.nations.declareWarTitle}</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 16 }}>{t.nations.warStakeDesc}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.nations.selectEnemy}</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nations.map(n => (
            <button key={n.id} onClick={() => setTargetId(n.id)} style={{ ...nationSelectBtn, ...(targetId === n.id ? nationSelectBtnActive : {}) }}>
              <span style={{ fontSize: 20 }}>{n.flag}</span>
              <span>{n.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>ELO {n.elo ?? 1000}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.nations.warDuration}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {DURATIONS.map(d => (
            <button key={d.v} onClick={() => setDuration(d.v)} style={chipBtn(duration === d.v)}>{d.l}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={{ ...goldBtnFull, background: 'rgba(255,77,106,0.15)', color: 'var(--red, #FF4D6A)', border: '1px solid rgba(255,77,106,0.3)' }}>
          {loading ? t.nations.sendingChallenge : t.nations.challengeBtn}
        </button>
      </div>
    </div>
  );
};

const JoinClanModal: React.FC<{ clanId: string; clan?: Nation; onClose: () => void; onSuccess: () => void }> = ({ clanId, clan, onClose, onSuccess }) => {
  const t = useT();
  const [contribution, setContribution] = useState('0');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await nationsApi.join(clanId, Number(contribution));
      if (res.pending) showToast(t.nations.joinPending, 'info');
      onSuccess();
    } catch (e: unknown) { showToast((e as Error).message ?? t.common.error); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48 }}>{clan?.flag}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{clan?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 4 }}>
            {t.nations.fightersCount(clan?._count?.members ?? 0)} · ELO {clan?.elo ?? 1000}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 12 }}>
          {t.nations.optionalContribution}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['0', '10000', '50000', '100000'].map(v => (
            <button key={v} onClick={() => setContribution(v)} style={chipBtn(contribution === v)}>
              {v === '0' ? t.nations.noContribution : fmtBalance(v)}
            </button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? t.nations.joining : t.nations.joinClan}
        </button>
      </div>
    </div>
  );
};

const BattleChallengeModal: React.FC<{
  myClan: Record<string,unknown> | null;
  nations: Nation[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ myClan, nations, onClose, onSuccess }) => {
  const t = useT();
  const [targetId, setTargetId]   = useState('');
  const [duration, setDuration]   = useState(86400);
  const [bet, setBet]             = useState('10000');
  const [loading, setLoading]     = useState(false);

  const DURATIONS = [
    { v: 3600,    l: t.nations.durShort1h },
    { v: 86400,   l: t.nations.durShort1d },
    { v: 604800,  l: t.nations.durShort1w },
    { v: 2592000, l: t.nations.durShort1m },
  ];

  const handleSubmit = async () => {
    if (!targetId) { showToast(t.nations.selectCountry); return; }
    setLoading(true);
    try {
      await clanBattlesApi.challenge(targetId, duration, bet);
      onSuccess();
    } catch (e: unknown) { showToast((e as Error).message ?? t.common.error); }
    finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#7B61FF', marginBottom: 4 }}>{t.nations.teamBattle}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 16, whiteSpace: 'pre-line' }}>
          {t.nations.battleDesc}
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.nations.opponent}</div>
        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nations.map(n => (
            <button key={n.id} onClick={() => setTargetId(n.id)}
              style={{ ...nationSelectBtn, ...(targetId === n.id ? nationSelectBtnActive : {}) }}>
              <span style={{ fontSize: 20 }}>{n.flag}</span>
              <span>{n.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>ELO {n.elo ?? 1000}</span>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.nations.durationLabel}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {DURATIONS.map(d => (
            <button key={d.v} onClick={() => setDuration(d.v)} style={chipBtn(duration === d.v)}>{d.l}</button>
          ))}
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t.nations.yourBet}</div>
        <input
          type="number" value={bet}
          onChange={e => setBet(e.target.value)}
          style={{ ...inputStyle, marginBottom: 8 }}
          min="1000" placeholder={t.nations.betPlaceholder}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['5000', '10000', '50000', '100000'].map(v => (
            <button key={v} onClick={() => setBet(v)} style={chipBtn(bet === v)}>{fmtBalance(v)}</button>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={loading}
          style={{ ...goldBtnFull, background: '#7B61FF', color: '#fff' }}>
          {loading ? t.nations.challengeSending : t.nations.challengeSubmit}
        </button>
      </div>
    </div>
  );
};

const JoinBattleModal: React.FC<{
  battle: ClanBattle;
  myClanId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ battle, myClanId, onClose, onSuccess }) => {
  const t = useT();
  const [bet, setBet]     = useState('10000');
  const [loading, setLoading] = useState(false);

  const myClan = myClanId === battle.challengerClanId ? battle.challengerClan : battle.defenderClan;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await clanBattlesApi.join(battle.id, bet);
      onSuccess();
    } catch (e: unknown) { showToast((e as Error).message ?? t.common.error); }
    finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>{myClan.flag} ⚔️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#7B61FF' }}>{t.nations.joinBattleTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 4 }}>
            {t.nations.pool}: {fmtBalance(battle.pool)} ᚙ · {battle._count?.contributions ?? 0} {t.nations.participants}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 12 }}>
          {t.nations.joinBattleDesc}
        </div>
        <input
          type="number" value={bet}
          onChange={e => setBet(e.target.value)}
          style={{ ...inputStyle, marginBottom: 8 }}
          min="1000" placeholder={t.nations.betInputPlaceholder}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['5000', '10000', '50000', '100000'].map(v => (
            <button key={v} onClick={() => setBet(v)} style={chipBtn(bet === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading}
          style={{ ...goldBtnFull, background: '#7B61FF', color: '#fff' }}>
          {loading ? t.nations.joiningBattle : t.nations.joinBattleBtn(fmtBalance(bet))}
        </button>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Stat: React.FC<{ val: string | number; lbl: string; color: string }> = ({ val, lbl, color }) => (
  <div>
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color }}>{val}</div>
    <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginTop: 2 }}>{lbl}</div>
  </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const clanHeroStyle: React.CSSProperties = {
  margin: '6px 18px', padding: 18,
  background: 'linear-gradient(135deg,#1A2015,#101A12)',
  border: '1px solid rgba(0,214,143,0.15)', borderRadius: 22, overflow: 'hidden',
};
const warBannerStyle: React.CSSProperties = {
  background: 'rgba(255,77,106,0.08)',
  border: '1px solid rgba(255,77,106,0.2)',
  borderRadius: 14, padding: '12px 14px', marginBottom: 8,
};
const challengeCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'rgba(255,77,106,0.06)', border: '1px solid rgba(255,77,106,0.2)',
  borderRadius: 14, padding: '10px 12px', marginBottom: 8,
};
const warCardStyle: React.CSSProperties = {
  margin: '0 18px 10px', background: 'var(--bg-card, #1C2030)',
  border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16,
};
const memberCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
};
const nationRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
};
const segStyle: React.CSSProperties = {
  display: 'flex', margin: '0 18px 10px',
  background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: 3, overflowX: 'auto',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '8px 6px', border: 'none', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  color: active ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)',
  background: active ? 'var(--bg-input, #232840)' : 'transparent',
  cursor: 'pointer', transition: 'all .2s',
});
const secStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--text-muted, #4A5270)', padding: '16px 18px 8px',
};
const secBtn: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--bg-input, #232840)', color: 'var(--text-primary, #F0F2F8)',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const leaveBtn: React.CSSProperties = {
  padding: '6px 12px', background: 'rgba(255,77,106,0.1)', color: 'var(--red, #FF4D6A)',
  border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10,
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const acceptWarBtn: React.CSSProperties = {
  padding: '6px 14px', background: 'var(--green, #00D68F)', color: 'var(--bg, #0B0D11)',
  border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const joinBtn: React.CSSProperties = {
  marginTop: 4, padding: '4px 10px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)',
  border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
};
const kickBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,77,106,0.1)',
  border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red, #FF4D6A)',
  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const approveBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,214,143,0.1)',
  border: '1px solid rgba(0,214,143,0.2)', color: 'var(--green, #00D68F)',
  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const rejectBtn: React.CSSProperties = { ...kickBtn };
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)', zIndex: "var(--z-modal, 300)", display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-card, #161927)', borderRadius: '24px 24px 0 0',
  padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)',
  maxHeight: '85vh', overflowY: 'auto',
};
const handleBar: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--bg-card, #1C2030)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)',
  fontSize: 15, fontFamily: 'inherit', marginBottom: 10,
};
const chipBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '7px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid',
  background: active ? 'rgba(245,200,66,0.12)' : 'var(--bg-input, #232840)',
  color: active ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
  borderColor: active ? 'rgba(245,200,66,0.3)' : 'var(--border, rgba(255,255,255,0.07))',
  fontFamily: 'inherit',
});
const goldBtnFull: React.CSSProperties = {
  width: '100%', padding: '13px', background: 'var(--accent, #F5C842)', color: 'var(--bg, #0B0D11)',
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const nationSelectBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-primary, #F0F2F8)', fontSize: 13,
};
const nationSelectBtnActive: React.CSSProperties = {
  background: 'rgba(245,200,66,0.08)', borderColor: 'rgba(245,200,66,0.3)', color: 'var(--accent, #F5C842)',
};
const closeBtnStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%', background: 'var(--border, rgba(255,255,255,0.07))',
  border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary, #8B92A8)', fontSize: 16,
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
