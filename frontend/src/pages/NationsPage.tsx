import React, { useEffect, useState, useCallback } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { useUserStore } from '@/store/useUserStore';
import { nationsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { Nation, ClanWar, ClanMemberData } from '@/types';

type Tab = 'clan' | 'wars' | 'members' | 'ranking';

export const NationsPage: React.FC = () => {
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('ranking');
  const [nations, setNations] = useState<Nation[]>([]);
  const [myClan, setMyClan] = useState<any>(null);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [activeWar, setActiveWar] = useState<ClanWar | null>(null);
  const [members, setMembers] = useState<ClanMemberData[]>([]);
  const [wars, setWars] = useState<ClanWar[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContribute, setShowContribute] = useState(false);
  const [showWarChallenge, setShowWarChallenge] = useState(false);
  const [showJoin, setShowJoin] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, myRes, warsRes] = await Promise.all([
        nationsApi.list(),
        nationsApi.getMy(),
        nationsApi.getWars(),
      ]);
      setNations(listRes.clans);
      setMyClan(myRes.clan);
      setMyMembership(myRes.membership);
      setActiveWar(myRes.activeWar);
      setWars(warsRes.wars);

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
    if (!confirm('Выйти из клана? Ваш взнос будет возвращён.')) return;
    await nationsApi.leave();
    await load();
    setTab('ranking');
  };

  const handleApprove = async (memberId: string, approve: boolean) => {
    await nationsApi.approveMember(memberId, approve);
    await loadMembers();
  };

  const handleKick = async (targetUserId: string) => {
    if (!confirm('Исключить бойца из клана?')) return;
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
    <PageLayout title="Сборные" backTo="/">
      {/* Мой клан — шапка */}
      {myClan && myMembership && (
        <div style={clanHeroStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 44 }}>{myClan.flag}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F0F2F8' }}>{myClan.name}</div>
              <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 3 }}>
                {isLeader ? '👑 Лидер' : '⚔️ Боец'} · {myClan._count?.members ?? 0} из {myClan.maxMembers ?? 100}
              </div>
            </div>
            <button onClick={handleLeave} style={leaveBtn}>Выйти</button>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            <Stat val={fmtBalance(myClan.treasury ?? '0')} lbl="Казна ᚙ" color="#F5C842" />
            <Stat val={myClan.totalWarWins ?? 0} lbl="Побед" color="#00D68F" />
            <Stat val={myClan.totalWarLosses ?? 0} lbl="Поражений" color="#FF4D6A" />
            <Stat val={myClan.elo ?? 1000} lbl="ELO" color="#9B85FF" />
          </div>

          {/* Активная война */}
          {activeWar && !activeWar.isPending && (
            <div style={warBannerStyle}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#FF4D6A', letterSpacing: '.08em', marginBottom: 8 }}>
                ⚔️ АКТИВНАЯ ВОЙНА
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>{activeWar.attackerClan.flag}</span>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: '#F0F2F8' }}>
                    {activeWar.attackerWins}:{activeWar.defenderWins}
                  </div>
                  <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>
                    💰 {fmtBalance(activeWar.prize ?? '0')} ᚙ на кону
                  </div>
                </div>
                <span style={{ fontSize: 24 }}>{activeWar.defenderClan.flag}</span>
              </div>
              {activeWar.endAt && (
                <div style={{ fontSize: 10, color: '#8B92A8', textAlign: 'center', marginTop: 6 }}>
                  Завершится: {new Date(activeWar.endAt).toLocaleDateString('ru-RU')}
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#FF4D6A' }}>⚔️ Вызов войны!</div>
                    <div style={{ fontSize: 11, color: '#8B92A8' }}>{ch.attackerClan.name} · Казна {fmtBalance(ch.attackerClan.treasury ?? '0')} ᚙ</div>
                  </div>
                  <button onClick={() => handleAcceptWar(ch.id)} style={acceptWarBtn}>Принять</button>
                </div>
              ))}
            </div>
          )}

          {/* Кнопки действий */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setShowContribute(true)} style={secBtn}>💰 Взнос</button>
            {isLeader && !activeWar && (
              <button onClick={() => setShowWarChallenge(true)} style={{ ...secBtn, background: 'rgba(255,77,106,0.1)', borderColor: 'rgba(255,77,106,0.3)', color: '#FF4D6A' }}>
                ⚔️ Объявить войну
              </button>
            )}
            <button onClick={() => setTab('members')} style={secBtn}>👥 Бойцы</button>
          </div>
        </div>
      )}

      {/* Вкладки */}
      <div style={segStyle}>
        {!myClan && <button style={segBtn(tab === 'ranking')} onClick={() => setTab('ranking')}>🌍 Рейтинг</button>}
        {myClan && <button style={segBtn(tab === 'clan')} onClick={() => setTab('clan')}>🏰 Мой клан</button>}
        <button style={segBtn(tab === 'wars')} onClick={() => setTab('wars')}>⚔️ Войны</button>
        {myClan && <button style={segBtn(tab === 'members')} onClick={() => setTab('members')}>👥 Бойцы</button>}
        <button style={segBtn(tab === 'ranking')} onClick={() => setTab('ranking')}>🏆 Топ</button>
      </div>

      {/* Список войн */}
      {tab === 'wars' && (
        <>
          <div style={secStyle}>Активные клановые войны</div>
          {wars.length === 0 && (
            <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 13 }}>
              Нет активных войн
            </div>
          )}
          {wars.map(war => (
            <div key={war.id} style={warCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>{war.attackerClan.flag}</div>
                  <div style={{ fontSize: 11, color: '#F0F2F8', fontWeight: 600 }}>{war.attackerClan.name}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 800, color: '#F0F2F8' }}>
                    {war.attackerWins}:{war.defenderWins}
                  </div>
                  <div style={{ fontSize: 10, color: '#F5C842', fontWeight: 700 }}>
                    💰 {fmtBalance(war.prize ?? '0')} ᚙ
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>{war.defenderClan.flag}</div>
                  <div style={{ fontSize: 11, color: '#F0F2F8', fontWeight: 600 }}>{war.defenderClan.name}</div>
                </div>
              </div>
              {war.endAt && (
                <div style={{ fontSize: 10, color: '#4A5270', textAlign: 'center' }}>
                  До {new Date(war.endAt).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Список участников */}
      {tab === 'members' && myClan && (
        <>
          {pendingMembers.length > 0 && isLeader && (
            <>
              <div style={{ ...secStyle, color: '#FF9F43' }}>⏳ Ожидают одобрения ({pendingMembers.length})</div>
              {pendingMembers.map(m => (
                <div key={m.id} style={memberCardStyle}>
                  <Avatar user={m.user} size="s" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{m.user?.firstName ?? 'Игрок'}</div>
                    <div style={{ fontSize: 10, color: '#8B92A8' }}>
                      ELO {m.user?.elo ?? '?'} · Взнос: {fmtBalance(m.pendingContribution ?? '0')} ᚙ
                    </div>
                  </div>
                  <button onClick={() => handleApprove(m.id, true)} style={approveBtn}>✓</button>
                  <button onClick={() => handleApprove(m.id, false)} style={rejectBtn}>✕</button>
                </div>
              ))}
            </>
          )}

          <div style={secStyle}>Бойцы клана ({activeMembers.length})</div>
          {activeMembers.map((m, i) => (
            <div key={m.id} style={memberCardStyle}>
              <span style={{ fontSize: 11, color: i < 3 ? '#F5C842' : '#4A5270', width: 20, flexShrink: 0 }}>
                {i + 1}
              </span>
              <Avatar user={m.user} size="s" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{m.user?.firstName ?? 'Игрок'}</span>
                  {m.role === 'COMMANDER' && <span style={{ fontSize: 10, color: '#F5C842' }}>👑</span>}
                </div>
                <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>
                  ELO {m.user?.elo ?? '?'} · {m.warWins}W/{m.warLosses}L · Взнос {fmtBalance(m.contribution ?? '0')} ᚙ
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
          <div style={secStyle}>Рейтинг сборных</div>
          {loading && <div style={{ textAlign: 'center', color: '#4A5270', padding: 24 }}>Загрузка...</div>}
          {nations.map((n, i) => (
            <div key={n.id} style={nationRowStyle}>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#F5C842' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#4A5270', width: 20 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 24 }}>{n.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{n.name}</div>
                <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>
                  {n._count?.members ?? n.memberCount ?? 0} бойцов · ELO {n.elo ?? n.avgElo ?? 1000}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: '#F0F2F8' }}>
                  {n.elo ?? n.avgElo ?? 1000}
                </div>
                {n.id !== (myClan?.id) && !myClan && (
                  <button onClick={() => setShowJoin(n.id)} style={joinBtn}>Вступить</button>
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
    </PageLayout>
  );
};

// ─── Sub-modals ───────────────────────────────────────────────────────────────
const ContributeModal: React.FC<{ clanName: string; clanFlag: string; onClose: () => void; onSuccess: () => void }> = ({ clanName, clanFlag, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('10000');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await nationsApi.contribute(amount);
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#F0F2F8', marginBottom: 16 }}>
          {clanFlag} Взнос в казну {clanName}
        </div>
        <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 16 }}>
          Ваш взнос укрепляет казну клана. При победе в войне — получите пропорциональную долю приза.
        </div>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={inputStyle}
          min="1000"
          placeholder="Сумма ᚙ"
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <button key={v} onClick={() => setAmount(v)} style={chipBtn(amount === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? 'Отправляем...' : `Внести ${fmtBalance(amount)} ᚙ`}
        </button>
      </div>
    </div>
  );
};

const WarChallengeModal: React.FC<{ nations: Nation[]; onClose: () => void; onSuccess: () => void }> = ({ nations, onClose, onSuccess }) => {
  const [targetId, setTargetId] = useState('');
  const [duration, setDuration] = useState(86400);
  const [loading, setLoading] = useState(false);
  const DURATIONS = [{ v: 3600, l: '1 час' }, { v: 86400, l: '1 день' }, { v: 604800, l: '1 неделя' }, { v: 2592000, l: '1 месяц' }];
  const handleSubmit = async () => {
    if (!targetId) { alert('Выберите страну'); return; }
    setLoading(true);
    try {
      await nationsApi.challengeWar(targetId, duration);
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#FF4D6A', marginBottom: 4 }}>⚔️ Объявить клановую войну</div>
        <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 16 }}>На кону будет казна обоих кланов!</div>
        <div style={{ fontSize: 10, color: '#4A5270', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Выберите врага</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nations.map(n => (
            <button key={n.id} onClick={() => setTargetId(n.id)} style={{ ...nationSelectBtn, ...(targetId === n.id ? nationSelectBtnActive : {}) }}>
              <span style={{ fontSize: 20 }}>{n.flag}</span>
              <span>{n.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8B92A8' }}>ELO {n.elo ?? 1000}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#4A5270', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Время войны</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {DURATIONS.map(d => (
            <button key={d.v} onClick={() => setDuration(d.v)} style={chipBtn(duration === d.v)}>{d.l}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={{ ...goldBtnFull, background: 'rgba(255,77,106,0.15)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.3)' }}>
          {loading ? 'Отправляем вызов...' : '⚔️ Бросить вызов!'}
        </button>
      </div>
    </div>
  );
};

const JoinClanModal: React.FC<{ clanId: string; clan?: Nation; onClose: () => void; onSuccess: () => void }> = ({ clanId, clan, onClose, onSuccess }) => {
  const [contribution, setContribution] = useState('0');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await nationsApi.join(clanId, Number(contribution));
      if (res.pending) alert('Ваша заявка отправлена на рассмотрение лидера клана');
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48 }}>{clan?.flag}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F0F2F8' }}>{clan?.name}</div>
          <div style={{ fontSize: 11, color: '#8B92A8', marginTop: 4 }}>
            {clan?._count?.members ?? 0} бойцов · ELO {clan?.elo ?? 1000}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 12 }}>
          Необязательный взнос в казну клана при вступлении (повышает приоритет одобрения):
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['0', '10000', '50000', '100000'].map(v => (
            <button key={v} onClick={() => setContribution(v)} style={chipBtn(contribution === v)}>
              {v === '0' ? 'Без взноса' : fmtBalance(v)}
            </button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? 'Вступаем...' : 'Вступить в клан'}
        </button>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Stat: React.FC<{ val: string | number; lbl: string; color: string }> = ({ val, lbl, color }) => (
  <div>
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color }}>{val}</div>
    <div style={{ fontSize: 10, color: '#4A5270', marginTop: 2 }}>{lbl}</div>
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
  margin: '0 18px 10px', background: '#1C2030',
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
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, padding: 3, overflowX: 'auto',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '8px 6px', border: 'none', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  color: active ? '#F0F2F8' : '#8B92A8',
  background: active ? '#232840' : 'transparent',
  cursor: 'pointer', transition: 'all .2s',
});
const secStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
  textTransform: 'uppercase', color: '#4A5270', padding: '16px 18px 8px',
};
const secBtn: React.CSSProperties = {
  padding: '8px 12px', background: '#232840', color: '#F0F2F8',
  border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10,
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const leaveBtn: React.CSSProperties = {
  padding: '6px 12px', background: 'rgba(255,77,106,0.1)', color: '#FF4D6A',
  border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10,
  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const acceptWarBtn: React.CSSProperties = {
  padding: '6px 14px', background: '#00D68F', color: '#0B0D11',
  border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const joinBtn: React.CSSProperties = {
  marginTop: 4, padding: '4px 10px', background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
};
const kickBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,77,106,0.1)',
  border: '1px solid rgba(255,77,106,0.2)', color: '#FF4D6A',
  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
};
const approveBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,214,143,0.1)',
  border: '1px solid rgba(0,214,143,0.2)', color: '#00D68F',
  fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
};
const rejectBtn: React.CSSProperties = { ...kickBtn };
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%', background: '#161927', borderRadius: '24px 24px 0 0',
  padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)',
  maxHeight: '85vh', overflowY: 'auto',
};
const handleBar: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#F0F2F8',
  fontSize: 15, fontFamily: 'inherit', marginBottom: 10,
};
const chipBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '7px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
  cursor: 'pointer', border: '1px solid',
  background: active ? 'rgba(245,200,66,0.12)' : '#232840',
  color: active ? '#F5C842' : '#8B92A8',
  borderColor: active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)',
  fontFamily: 'inherit',
});
const goldBtnFull: React.CSSProperties = {
  width: '100%', padding: '13px', background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
const nationSelectBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#F0F2F8', fontSize: 13,
};
const nationSelectBtnActive: React.CSSProperties = {
  background: 'rgba(245,200,66,0.08)', borderColor: 'rgba(245,200,66,0.3)', color: '#F5C842',
};
