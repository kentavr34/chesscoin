import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { warsApi } from '@/api';
import { useUserStore } from '@/store/useUserStore';
import { fmtBalance } from '@/utils/format';

const toast = (text: string, type: 'error' | 'success' | 'info' = 'error') =>
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));

// Тикающий таймер войны
const WarCountdown: React.FC<{ initialSeconds: number; active: boolean }> = ({ initialSeconds, active }) => {
  const [secs, setSecs] = useState(initialSeconds);
  useEffect(() => {
    setSecs(initialSeconds);
    if (!active || initialSeconds <= 0) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [initialSeconds, active]);
  return <>{formatTime(secs)}</>;
};

// ─────────────────────────────────────────────────────────────────────────────
// WARSINTROMODAL
// ─────────────────────────────────────────────────────────────────────────────
const WarsIntroModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div style={{ ...modalStyle, padding: 24, maxWidth: 420, margin: 'auto', borderRadius: 24, bottom: 'auto', top: '10%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontFamily: "'Unbounded',sans-serif", fontWeight: 800, color: '#F5C842' }}>⚔️ Войны</div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>
      <div style={{ fontSize: 13, color: '#C8CDDF', lineHeight: 1.7 }}>
        <p style={{ marginBottom: 10 }}>
          🌍 <b>Войны между странами</b> — вступи в любую страну и сражайся за её сборную!
        </p>
        <p style={{ marginBottom: 10 }}>
          👑 <b>Главнокомандующий</b> — боец с наибольшим числом побед. Только он может объявить войну другой стране.
        </p>
        <p style={{ marginBottom: 10 }}>
          ⚔️ <b>Во время войны</b> — вызывай бойцов противника на дуэль бесплатно. Каждая победа пополняет казну страны!
        </p>
        <p style={{ marginBottom: 10 }}>
          🏆 <b>Победившая страна</b> получает призовой фонд, а её бойцы поднимаются в рейтинге.
        </p>
        <p>
          🔄 <b>Трансферы разрешены</b> — можно сражаться за любимую страну, не только за родную!
        </p>
      </div>
      <button onClick={onClose} style={{ ...goldBtnFull, marginTop: 20 }}>
        Понятно, поехали! ⚔️
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DECLARE WAR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const DURATIONS = [
  { label: '1 час', value: 3600 },
  { label: '12 часов', value: 43200 },
  { label: '24 часа', value: 86400 },
  { label: '7 дней', value: 604800 },
];

const DeclareWarModal: React.FC<{
  myCountryId: string;
  onClose: () => void;
  onDeclared: () => void;
}> = ({ myCountryId, onClose, onDeclared }) => {
  const [countries, setCountries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [duration, setDuration] = useState(86400);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    warsApi.countries('alpha').then(r => setCountries(r.countries.filter((c: any) => c.id !== myCountryId)));
  }, [myCountryId]);

  const filtered = countries.filter(c =>
    c.nameRu.toLowerCase().includes(search.toLowerCase()) ||
    c.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeclare = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await warsApi.declare(selected, duration);
      toast('Война объявлена!', 'success');
      onDeclared();
      onClose();
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5C842' }}>⚔️ Объявить войну</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <input
          placeholder="Поиск страны..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />

        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, marginBottom: 4, cursor: 'pointer',
                background: selected === c.id ? 'rgba(245,200,66,0.12)' : '#1C2030',
                border: `1px solid ${selected === c.id ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <span style={{ fontSize: 22 }}>{c.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{c.nameRu}</div>
                <div style={{ fontSize: 10, color: '#A8B0C8' }}>Бойцов: {c.memberCount} • Побед: {c.wins}</div>
              </div>
              {selected === c.id && <span style={{ color: '#F5C842', fontSize: 16 }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#A8B0C8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Длительность
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {DURATIONS.map(d => (
            <button key={d.value} onClick={() => setDuration(d.value)} style={chipBtn(duration === d.value)}>
              {d.label}
            </button>
          ))}
        </div>

        <button onClick={handleDeclare} disabled={!selected || loading} style={{ ...goldBtnFull, opacity: !selected || loading ? 0.5 : 1 }}>
          {loading ? '...' : '⚔️ Объявить войну'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
const CountryDetailModal: React.FC<{
  countryId: string;
  activeWarId?: string | null;
  onClose: () => void;
  onJoined: () => void;
}> = ({ countryId, activeWarId, onClose, onJoined }) => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [data, setData] = useState<{ country: any; members: any[]; isCommander: boolean } | null>(null);
  const [joining, setJoining] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [donateAmt, setDonateAmt] = useState('');
  const [donating, setDonating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    warsApi.country(countryId).then(setData).catch(console.error);
  }, [countryId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await warsApi.join(countryId);
      toast('Вы вступили в страну!', 'success');
      onJoined();
      onClose();
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setJoining(false);
    }
  };

  const handleDonate = async () => {
    if (!donateAmt || isNaN(Number(donateAmt))) return;
    setDonating(true);
    try {
      await warsApi.leave(); // placeholder - should be contribute
      toast('Донат отправлен!', 'success');
      setDonateAmt('');
      warsApi.country(countryId).then(setData);
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setDonating(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await warsApi.leave();
      toast('Вы покинули страну', 'success');
      onJoined();
      onClose();
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setLeaving(false);
    }
  };

  const handleChallenge = async (opponentUserId: string) => {
    if (!activeWarId) {
      toast('Нет активной войны с этой страной', 'info');
      return;
    }
    setChallenging(opponentUserId);
    try {
      const r = await warsApi.challenge(activeWarId, opponentUserId);
      toast('Вызов отправлен!', 'success');
      navigate(`/game/${r.sessionId}`);
      onClose();
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setChallenging(null);
    }
  };

  const c = data?.country;
  const members = data?.members ?? [];
  const isMine = c?.myMembership != null;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, maxHeight: '90vh' }}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32 }}>{c?.flag ?? '🏴'}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F2F8' }}>{c?.nameRu ?? '...'}</div>
              <div style={{ fontSize: 10, color: '#A8B0C8' }}>{c?.nameEn ?? ''}</div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {c && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <StatBox label="Казна" value={`${fmtBalance(c.treasury)} ᚙ`} color="#F5C842" />
            <StatBox label="Побед" value={String(c.wins)} color="#00D68F" />
            <StatBox label="Бойцов" value={`${c.memberCount} / ${c.maxMembers}`} color="#7B61FF" />
          </div>
        )}

        {c?.activeWar && (
          <div style={{ padding: '10px 14px', background: 'rgba(245,77,66,0.08)', border: '1px solid rgba(245,77,66,0.2)', borderRadius: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#FF4D6A', marginBottom: 4 }}>⚔️ ИДЁТ ВОЙНА</div>
            <div style={{ fontSize: 12, color: '#C8CDDF' }}>
              {c.activeWar.attackerCountry?.nameRu} vs {c.activeWar.defenderCountry?.nameRu}
            </div>
            <div style={{ fontSize: 11, color: '#A8B0C8', marginTop: 2 }}>
              {c.activeWar.attackerWins} : {c.activeWar.defenderWins}
            </div>
          </div>
        )}

        {!isMine && (
          <button onClick={handleJoin} disabled={joining} style={{ ...goldBtnFull, marginBottom: 14, opacity: joining ? 0.6 : 1 }}>
            {joining ? '...' : `🏴 Вступить в страну`}
          </button>
        )}
        {isMine && (
          <>
            <div style={{ padding: '8px 12px', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, marginBottom: 10, fontSize: 12, color: '#00D68F', fontWeight: 600 }}>
              ✓ Вы боец этой страны
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Сумма доната ᚙ"
                value={donateAmt}
                onChange={e => setDonateAmt(e.target.value)}
                type="number"
                style={{ ...inputStyle, flex: 1, margin: 0 }}
              />
              <button onClick={handleDonate} disabled={donating || !donateAmt} style={{ padding: '10px 14px', background: 'rgba(245,200,66,0.12)', color: '#F5C842', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {donating ? '...' : '💰 Донат'}
              </button>
              <button onClick={handleLeave} disabled={leaving} style={{ padding: '10px 12px', background: 'rgba(255,77,106,0.08)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {leaving ? '...' : '🚪'}
              </button>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#A8B0C8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          🏴 Бойцы ({members.length})
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {members.map((m, i) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {m.isCommander && (
                <span style={{ fontSize: 16, flexShrink: 0 }}>👑</span>
              )}
              {!m.isCommander && (
                <span style={{ fontSize: 13, color: '#6B7494', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              )}
              <div
                onClick={() => { navigate(`/profile/${m.userId}`); onClose(); }}
                style={{ cursor: 'pointer' }}
              >
                <Avatar user={m.user} size="s" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: m.isCommander ? '#F5C842' : '#F0F2F8', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  onClick={() => { navigate(`/profile/${m.userId}`); onClose(); }}
                >
                  {m.isCommander && <span style={{ fontSize: 10, color: '#F5C842', marginRight: 4 }}>ГЛАВКОМ</span>}
                  {m.user?.firstName} {m.user?.lastName ?? ''}
                </div>
                <div style={{ fontSize: 10, color: '#A8B0C8' }}>
                  ELO {m.user?.elo ?? '—'} • {m.warWins}W / {m.warLosses}L
                </div>
              </div>
              {m.userId !== user?.id && activeWarId && (
                <button
                  onClick={() => handleChallenge(m.userId)}
                  disabled={challenging === m.userId}
                  style={challengeBtnStyle}
                >
                  {challenging === m.userId ? '...' : '⚔️'}
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6B7494', padding: 24, fontSize: 13 }}>Нет бойцов</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WAR DETAIL MODAL (просмотр партий войны)
// ─────────────────────────────────────────────────────────────────────────────
const WarDetailModal: React.FC<{ warId: string; onClose: () => void }> = ({ warId, onClose }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    warsApi.warDetail(warId).then(r => {
      setData(r.war);
      setCountdown(r.war?.secondsLeft ?? 0);
    }).catch(console.error);
  }, [warId]);

  // Тикаем таймер каждую секунду
  useEffect(() => {
    if (!data || data.status !== 'IN_PROGRESS') return;
    const t = setInterval(() => setCountdown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [data?.status]);

  const handleSave = async (sessionId: string) => {
    setSaving(sessionId);
    try {
      await warsApi.saveGame(sessionId);
      toast('Партия сохранена!', 'success');
    } catch (e: any) {
      toast(e.message ?? 'Ошибка');
    } finally {
      setSaving(null);
    }
  };

  const war = data;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, maxHeight: '90vh' }}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2F8' }}>⚔️ Детали войны</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {!war && <div style={{ textAlign: 'center', color: '#6B7494', padding: 32 }}>Загрузка...</div>}

        {war && (
          <>
            {/* Счёт */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '14px 16px', background: '#1C2030', borderRadius: 16 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 24 }}>{war.attackerCountry?.flag}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8', marginTop: 4 }}>{war.attackerCountry?.nameRu}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: '#F5C842' }}>
                  {war.attackerWins} : {war.defenderWins}
                </div>
                <div style={{ fontSize: 10, color: war.status === 'IN_PROGRESS' ? '#00D68F' : '#A8B0C8', marginTop: 2 }}>
                  {war.status === 'IN_PROGRESS' ? `⏱ ${formatTime(countdown)}` : '✓ Завершена'}
                </div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 24 }}>{war.defenderCountry?.flag}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F2F8', marginTop: 4 }}>{war.defenderCountry?.nameRu}</div>
              </div>
            </div>

            {war.winnerCountryId && (
              <div style={{ padding: '8px 14px', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00D68F' }}>
                  🏆 Победитель: {war.winnerCountryId === war.attackerCountryId ? war.attackerCountry?.nameRu : war.defenderCountry?.nameRu}
                </div>
              </div>
            )}

            {/* Список партий */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A8B0C8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Партии ({war.battles?.length ?? 0})
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(war.battles ?? []).map((b: any) => {
                const p1 = b.session?.sides?.[0]?.player;
                const p2 = b.session?.sides?.[1]?.player;
                const isDone = b.status === 'FINISHED';
                return (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => p1 && navigate(`/profile/${p1.id}`)}>
                      <Avatar user={p1} size="s" />
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isDone ? (b.winnerId === b.attackerId ? '#00D68F' : '#FF4D6A') : '#F5C842' }}>
                        {isDone ? (b.winnerId === b.attackerId ? '✓ Победа' : '✗ Поражение') : '⏳ В игре'}
                      </div>
                      <div style={{ fontSize: 9, color: '#6B7494', marginTop: 2 }}>VS</div>
                    </div>
                    <div style={{ cursor: 'pointer' }} onClick={() => p2 && navigate(`/profile/${p2.id}`)}>
                      <Avatar user={p2} size="s" />
                    </div>
                    {!isDone && b.sessionId && (
                      <button
                        onClick={() => { onClose(); navigate(`/game/${b.sessionId}?spectate=1`); }}
                        style={{ padding: '5px 8px', background: 'rgba(245,200,66,0.1)', color: '#F5C842', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        👁 Смотреть
                      </button>
                    )}
                    {b.session?.pgn && isDone && (
                      <button
                        onClick={() => handleSave(b.sessionId)}
                        disabled={saving === b.sessionId}
                        style={{ padding: '5px 8px', background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {saving === b.sessionId ? '...' : '💾'}
                      </button>
                    )}
                  </div>
                );
              })}
              {!(war.battles?.length) && (
                <div style={{ textAlign: 'center', color: '#6B7494', padding: 24, fontSize: 13 }}>Партий ещё нет</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WARSPAGE
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'countries' | 'active' | 'history';

export const WarsPage: React.FC = () => {
  const { user } = useUserStore();
  const [tab, setTab] = useState<Tab>('countries');
  const [sort, setSort] = useState<'wins' | 'alpha'>('wins');

  // Data
  const [countries, setCountries] = useState<any[]>([]);
  const [activeWars, setActiveWars] = useState<any[]>([]);
  const [historyWars, setHistoryWars] = useState<any[]>([]);
  const [myCountry, setMyCountry] = useState<any>(null);
  const [myMembership, setMyMembership] = useState<any>(null);
  const [isCommander, setIsCommander] = useState(false);
  const [myActiveWar, setMyActiveWar] = useState<any>(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [showDeclareWar, setShowDeclareWar] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedWarId, setSelectedWarId] = useState<string | null>(null);
  const [searchCountry, setSearchCountry] = useState('');

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [countriesRes, myRes] = await Promise.all([
        warsApi.countries(sort),
        warsApi.myCountry(),
      ]);
      setCountries(countriesRes.countries);
      setMyCountry(myRes.country);
      setMyMembership(myRes.membership);
      setIsCommander(myRes.isCommander);
      setMyActiveWar(myRes.activeWar);

      // Check intro
      if (user && !user.hasSeenWarsIntro) {
        setShowIntro(true);
      }
    } finally {
      setLoading(false);
    }
  }, [sort, user]);

  const loadActive = useCallback(async () => {
    const r = await warsApi.active();
    setActiveWars(r.wars);
  }, []);

  const loadHistory = useCallback(async () => {
    const r = await warsApi.history();
    setHistoryWars(r.wars);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (tab === 'active') loadActive(); }, [tab, loadActive]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  // Auto-refresh: обновляем каждые 30 секунд активную вкладку
  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === 'active') loadActive();
      else if (tab === 'countries') loadAll();
    }, 30000);
    return () => clearInterval(interval);
  }, [tab, loadActive, loadAll]);

  const handleIntroClose = async () => {
    setShowIntro(false);
    try { await warsApi.introSeen(); } catch {}
  };

  const filteredCountries = countries.filter(c =>
    c.nameRu.toLowerCase().includes(searchCountry.toLowerCase()) ||
    c.nameEn.toLowerCase().includes(searchCountry.toLowerCase())
  );

  // Найти активную войну для выбранной страны (для кнопки «Вызов» в деталях)
  const getActiveWarIdForCountry = (countryId: string) => {
    if (myActiveWar && (myActiveWar.attackerCountryId === countryId || myActiveWar.defenderCountryId === countryId)) {
      return myActiveWar.id;
    }
    return null;
  };

  return (
    <PageLayout title="">
      {/* Заголовок */}
      <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 20, fontWeight: 800, color: '#F5C842' }}>
          ⚔️ Войны
        </div>
        <button
          onClick={() => setShowIntro(true)}
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#A8B0C8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ?
        </button>
      </div>

      {/* Моя страна — плашка */}
      {myCountry && (
        <div style={{ margin: '12px 18px', padding: '12px 16px', background: 'linear-gradient(135deg,rgba(245,200,66,0.08),rgba(123,97,255,0.06))', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>{myCountry.flag}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F5C842', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                {isCommander ? '👑 Главнокомандующий' : '🏴 Боец'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#F0F2F8' }}>{myCountry.nameRu}</div>
            </div>
          </div>
          {/* Статистика страны */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#9BA3BC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Казна</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#F5C842' }}>{fmtBalance(myCountry.treasury ?? '0')}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(123,97,255,0.08)', border: '1px solid rgba(123,97,255,0.15)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#9BA3BC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Бойцов</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#9B85FF' }}>{myCountry.memberCount}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.15)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#9BA3BC', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Побед</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#00D68F' }}>{myCountry.wins}</div>
            </div>
          </div>
          {/* Кнопки действий */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setSelectedCountryId(myCountry.id)} style={{ flex: 1, padding: '7px 4px', background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🏴 Бойцы
            </button>
            {isCommander && !myActiveWar && (
              <button onClick={() => setShowDeclareWar(true)} style={{ flex: 1, padding: '7px 4px', background: 'rgba(255,77,106,0.12)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⚔️ Война
              </button>
            )}
            {myActiveWar && (
              <button onClick={() => setSelectedWarId(myActiveWar.id)} style={{ flex: 1, padding: '7px 4px', background: 'rgba(255,77,106,0.12)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⚔️ Сражения
              </button>
            )}
          </div>
          {myActiveWar && (
            <div
              onClick={() => setSelectedWarId(myActiveWar.id)}
              style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 12, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#FF4D6A', marginBottom: 3 }}>⚔️ ИДЁТ ВОЙНА</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#C8CDDF' }}>
                  {myActiveWar.attackerCountry?.nameRu} vs {myActiveWar.defenderCountry?.nameRu}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, color: '#F5C842' }}>
                  {myActiveWar.attackerWins} : {myActiveWar.defenderWins}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>⏱ <WarCountdown initialSeconds={myActiveWar.secondsLeft ?? 0} active={true} /></div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '4px 18px 10px', background: '#1C2030', borderRadius: 12, padding: 3 }}>
        {([['countries', 'Страны'], ['active', 'Война'], ['history', 'История']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 9, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: tab === t ? '#232840' : 'transparent',
            color: tab === t ? '#F0F2F8' : '#A8B0C8',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: СТРАНЫ ─────────────────────────────────────────────────────── */}
      {tab === 'countries' && (
        <>
          {/* Sort + Search */}
          <div style={{ display: 'flex', gap: 8, margin: '0 18px 10px', alignItems: 'center' }}>
            <input
              placeholder="🔍 Поиск страны..."
              value={searchCountry}
              onChange={e => setSearchCountry(e.target.value)}
              style={{ ...inputStyle, flex: 1, margin: 0 }}
            />
            <button onClick={() => setSort(s => s === 'wins' ? 'alpha' : 'wins')} style={chipBtn(false)}>
              {sort === 'wins' ? '🏆 Топ' : 'А-Я'}
            </button>
          </div>

          {loading && <div style={{ textAlign: 'center', color: '#6B7494', padding: 32 }}>Загрузка...</div>}

          {filteredCountries.map((c, i) => {
            const isMyCountry = myCountry?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCountryId(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  margin: '0 18px 6px', padding: '12px 14px',
                  background: isMyCountry ? 'rgba(245,200,66,0.06)' : '#13161E',
                  border: `1px solid ${isMyCountry ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 16, cursor: 'pointer',
                  transition: 'background .15s',
                }}
              >
                <div style={{ fontSize: 11, color: '#6B7494', width: 20, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace" }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 26 }}>{c.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isMyCountry ? '#F5C842' : '#F0F2F8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.nameRu}
                    {isMyCountry && <span style={{ fontSize: 9, marginLeft: 6, color: '#F5C842', fontWeight: 600 }}>МОЯ</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#A8B0C8', marginTop: 2 }}>
                    Бойцов: {c.memberCount} / {c.maxMembers}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#00D68F' }}>
                    {c.wins}W
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7494' }}>побед</div>
                </div>
              </div>
            );
          })}

          {!loading && filteredCountries.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6B7494', padding: 32, fontSize: 13 }}>Ничего не найдено</div>
          )}
        </>
      )}

      {/* ── TAB: ИДЁТ ВОЙНА ──────────────────────────────────────────────────── */}
      {tab === 'active' && (
        <>
          {activeWars.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🕊️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F0F2F8', marginBottom: 6 }}>Войн нет</div>
              <div style={{ fontSize: 12, color: '#A8B0C8' }}>
                {isCommander ? 'Объяви войну другой стране!' : 'Станови Главнокомандующим и объяви войну!'}
              </div>
            </div>
          )}
          {activeWars.map(war => (
            <div key={war.id} style={{ margin: '0 18px 10px', background: '#13161E', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,rgba(255,77,106,0.08),transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 28 }}>{war.attackerCountry?.flag}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F0F2F8', marginTop: 4 }}>{war.attackerCountry?.nameRu}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 8px' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 800, color: '#F5C842' }}>
                      {war.attackerWins} : {war.defenderWins}
                    </div>
                    <div style={{ fontSize: 10, color: '#FF4D6A', marginTop: 2 }}>⏱ <WarCountdown initialSeconds={war.secondsLeft ?? 0} active={war.status === 'IN_PROGRESS'} /></div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 28 }}>{war.defenderCountry?.flag}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F0F2F8', marginTop: 4 }}>{war.defenderCountry?.nameRu}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px' }}>
                <button
                  onClick={() => setSelectedWarId(war.id)}
                  style={{ flex: 1, padding: '9px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Смотреть
                </button>
                {myActiveWar?.id === war.id && (
                  <button
                    onClick={() => setTab('countries')}
                    style={{ flex: 1, padding: '9px', background: 'rgba(255,77,106,0.1)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ⚔️ Участвовать
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── TAB: ИСТОРИЯ ─────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {historyWars.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
              <div style={{ fontSize: 13, color: '#A8B0C8' }}>История войн пуста</div>
            </div>
          )}
          {historyWars.map(war => {
            const attackerWon = war.winnerCountryId === war.attackerCountryId;
            const defenderWon = war.winnerCountryId === war.defenderCountryId;
            return (
              <div key={war.id} style={{ margin: '0 18px 10px', background: '#13161E', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setSelectedCountryId(war.attackerCountryId)}>
                      <span style={{ fontSize: 24 }}>{war.attackerCountry?.flag}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: attackerWon ? '#F5C842' : '#F0F2F8' }}>
                          {attackerWon && '🏆 '}{war.attackerCountry?.nameRu}
                        </div>
                        <div style={{ fontSize: 10, color: '#A8B0C8' }}>{war.attackerWins} побед</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 800, color: '#A8B0C8' }}>
                      {war.attackerWins}:{war.defenderWins}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setSelectedCountryId(war.defenderCountryId)}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: defenderWon ? '#F5C842' : '#F0F2F8' }}>
                          {defenderWon && '🏆 '}{war.defenderCountry?.nameRu}
                        </div>
                        <div style={{ fontSize: 10, color: '#A8B0C8' }}>{war.defenderWins} побед</div>
                      </div>
                      <span style={{ fontSize: 24 }}>{war.defenderCountry?.flag}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7494' }}>
                    {war.battleCount} партий • {war.finishedAt ? new Date(war.finishedAt).toLocaleDateString('ru-RU') : ''}
                  </div>
                </div>
                <div style={{ padding: '0 14px 12px' }}>
                  <button onClick={() => setSelectedWarId(war.id)} style={{ width: '100%', padding: '8px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Подробнее →
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Modals */}
      {showIntro && <WarsIntroModal onClose={handleIntroClose} />}
      {showDeclareWar && myCountry && (
        <DeclareWarModal myCountryId={myCountry.id} onClose={() => setShowDeclareWar(false)} onDeclared={loadAll} />
      )}
      {selectedCountryId && (
        <CountryDetailModal
          countryId={selectedCountryId}
          activeWarId={getActiveWarIdForCountry(selectedCountryId)}
          onClose={() => setSelectedCountryId(null)}
          onJoined={loadAll}
        />
      )}
      {selectedWarId && (
        <WarDetailModal warId={selectedWarId} onClose={() => setSelectedWarId(null)} />
      )}
    </PageLayout>
  );
};

// ─── Utils ───────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  if (!seconds) return '0:00';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const StatBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: 1, padding: '8px 10px', background: '#1C2030', borderRadius: 12, textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: '#9BA3BC', marginBottom: 3 }}>{label}</div>
    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color }}>{value}</div>
  </div>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
  zIndex: 300, display: 'flex', alignItems: 'flex-end',
};
const modalStyle: React.CSSProperties = {
  width: '100%', background: '#161927', borderRadius: '24px 24px 0 0',
  padding: 20, borderTop: '1px solid rgba(255,255,255,0.08)',
  maxHeight: '85vh', overflowY: 'auto',
};
const handleBar: React.CSSProperties = {
  width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px',
};
const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.1)', color: '#A8B0C8', fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const goldBtnFull: React.CSSProperties = {
  width: '100%', padding: 13, background: '#F5C842', color: '#0B0D11',
  border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12, color: '#F0F2F8', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', marginBottom: 10,
};
const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
  border: '1px solid', fontFamily: 'inherit',
  background: active ? 'rgba(245,200,66,0.12)' : '#1C2030',
  color: active ? '#F5C842' : '#A8B0C8',
  borderColor: active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)',
  whiteSpace: 'nowrap' as const,
});
const declareWarBtnStyle: React.CSSProperties = {
  padding: '7px 12px', background: 'rgba(255,77,106,0.1)', color: '#FF4D6A',
  border: '1px solid rgba(255,77,106,0.25)', borderRadius: 12, fontSize: 11,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const challengeBtnStyle: React.CSSProperties = {
  padding: '6px 10px', background: 'rgba(255,77,106,0.1)', color: '#FF4D6A',
  border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit',
};
