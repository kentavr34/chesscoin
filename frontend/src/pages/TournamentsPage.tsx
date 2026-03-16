import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Avatar } from '@/components/ui/Avatar';
import { tournamentsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import type { TournamentFull } from '@/types';

const showToast = (text: string, type: 'error' | 'info' = 'error') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

const TYPE_ICONS: Record<string, string> = {
  WORLD: '🌍', COUNTRY: '🏴', WEEKLY: '📅', MONTHLY: '🗓️', SEASONAL: '🌸', YEARLY: '🏆',
};
const TYPE_COLORS: Record<string, string> = {
  WORLD: '#F5C842', COUNTRY: '#00D68F', WEEKLY: '#9B85FF',
  MONTHLY: '#FF9F43', SEASONAL: '#FF6B9D', YEARLY: '#F5C842',
};

type TFilter = 'all' | 'joined';

export const TournamentsPage: React.FC = () => {
  const [tournaments, setTournaments] = useState<TournamentFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [donateModal, setDonateModal] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await tournamentsApi.list();
      setTournaments(res.tournaments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleJoin = async (id: string) => {
    setJoiningId(id);
    try {
      await tournamentsApi.join(id);
      await load();
    } catch (e: any) {
      showToast(e.message ?? 'Ошибка вступления');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (id: string) => {
    if (!confirm('Выйти из турнира? Взнос не возвращается!')) return;
    try {
      await tournamentsApi.leave(id);
      await load();
    } catch (e: any) {
      showToast(e.message ?? 'Ошибка');
    }
  };

  const filtered = filter === 'joined' ? tournaments.filter(t => t.isJoined) : tournaments;
  const grouped = filtered.reduce<Record<string, TournamentFull[]>>((acc, t) => {
    (acc[t.type] = acc[t.type] ?? []).push(t);
    return acc;
  }, {});
  const typeOrder = ['WORLD', 'YEARLY', 'SEASONAL', 'MONTHLY', 'WEEKLY', 'COUNTRY'];

  return (
    <PageLayout title="Турниры" backTo="/">
      <div style={segStyle}>
        <button style={segBtn(filter === 'all')} onClick={() => setFilter('all')}>🏆 Все</button>
        <button style={segBtn(filter === 'joined')} onClick={() => setFilter('joined')}>⚔️ Мои</button>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#4A5270', padding: 32 }}>Загрузка...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#4A5270', padding: 32, fontSize: 13 }}>
          {filter === 'joined' ? 'Вы не участвуете в турнирах' : 'Нет активных турниров'}
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
            {items.map(t => (
              <TournamentCard
                key={t.id}
                t={t}
                onJoin={() => handleJoin(t.id)}
                onLeave={() => handleLeave(t.id)}
                onView={() => setSelected(t.id)}
                onDonate={() => setDonateModal(t.id)}
                joining={joiningId === t.id}
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
  t: TournamentFull; onJoin: () => void; onLeave: () => void;
  onView: () => void; onDonate: () => void; joining: boolean;
}> = ({ t, onJoin, onLeave, onView, onDonate, joining }) => {
  const color = TYPE_COLORS[t.type] ?? '#F5C842';
  const icon = TYPE_ICONS[t.type] ?? '🏆';
  const endDate = t.endAt ? new Date(t.endAt).toLocaleDateString('ru-RU') : null;

  return (
    <div style={{ margin: '0 18px 10px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', background: `linear-gradient(135deg,${color}12,transparent)`, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color }}>{t.name}</div>
            {t.period && <div style={{ fontSize: 10, color: '#8B92A8', marginTop: 2 }}>Период: {t.period}</div>}
          </div>
          {t.isJoined && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#00D68F', background: 'rgba(0,214,143,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              ✓ Участник
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', padding: '10px 16px', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#4A5270' }}>Участники</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: '#F0F2F8', marginTop: 2 }}>
            {t.currentPlayers.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4A5270' }}>Взнос</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: '#F5C842', marginTop: 2 }}>
            {fmtBalance(t.entryFee)} ᚙ
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#4A5270' }}>Призовой фонд</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>
            {fmtBalance(t.totalPool ?? t.prizePool)} ᚙ
          </div>
        </div>
      </div>

      {t.isJoined && t.myStats && (
        <div style={{ margin: '0 14px 10px', padding: '8px 12px', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 10, color: '#00D68F', fontWeight: 700, marginBottom: 4 }}>Мои результаты</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontSize: 13, color: '#00D68F' }}>✓ {t.myStats.wins}</span>
            <span style={{ fontSize: 13, color: '#FF4D6A' }}>✗ {t.myStats.losses}</span>
            <span style={{ fontSize: 13, color: '#8B92A8' }}>= {t.myStats.draws}</span>
            <span style={{ fontSize: 13, color: '#F5C842', marginLeft: 'auto' }}>Очки: {t.myStats.points.toFixed(1)}</span>
          </div>
        </div>
      )}

      {endDate && <div style={{ padding: '0 16px 4px', fontSize: 10, color: '#4A5270' }}>До: {endDate}</div>}

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px' }}>
        <button onClick={onView} style={viewBtn}>Топ-лист</button>
        <button onClick={onDonate} style={donateBtn}>💸 Донат</button>
        {!t.isJoined ? (
          <button onClick={onJoin} disabled={joining} style={{ ...joinBtnStyle, opacity: joining ? 0.6 : 1 }}>
            {joining ? '...' : `Вступить`}
          </button>
        ) : (
          <button onClick={onLeave} style={leaveBtnStyle}>Выйти</button>
        )}
      </div>
    </div>
  );
};

const TournamentDetailModal: React.FC<{ tournamentId: string; onClose: () => void }> = ({ tournamentId, onClose }) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    tournamentsApi.get(tournamentId).then(r => setData(r.tournament)).catch(console.error);
  }, [tournamentId]);
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F2F8' }}>🏆 Лидерборд</div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        {!data && <div style={{ textAlign: 'center', color: '#4A5270', padding: 24 }}>Загрузка...</div>}
        {data?.players?.map((p: any, i: number) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#F5C842' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#4A5270', width: 24, textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <Avatar user={p.user} size="s" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F2F8' }}>{p.user?.firstName}</div>
              <div style={{ fontSize: 10, color: '#8B92A8' }}>{p.wins}W {p.losses}L {p.draws}D</div>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#F5C842' }}>
              {p.points?.toFixed(1) ?? '0.0'}
            </span>
          </div>
        ))}
        {!data?.players?.length && data && (
          <div style={{ textAlign: 'center', color: '#4A5270', padding: 16 }}>Нет участников</div>
        )}
      </div>
    </div>
  );
};

const DonateModal: React.FC<{ tournamentId: string; onClose: () => void; onSuccess: () => void }> = ({ tournamentId, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('10000');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try { await tournamentsApi.donate(tournamentId, amount); onSuccess(); }
    catch (e: any) { showToast(e.message ?? 'Ошибка'); }
    finally { setLoading(false); }
  };
  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#F0F2F8', marginBottom: 8 }}>💸 Донат в кассу</div>
        <div style={{ fontSize: 11, color: '#8B92A8', marginBottom: 16 }}>Все монеты идут победителям турнира!</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['10000', '50000', '100000', '500000'].map(v => (
            <button key={v} onClick={() => setAmount(v)} style={chipBtn(amount === v)}>{fmtBalance(v)}</button>
          ))}
        </div>
        <button onClick={handleSubmit} disabled={loading} style={goldBtnFull}>
          {loading ? '...' : `Задонатить ${fmtBalance(amount)} ᚙ`}
        </button>
      </div>
    </div>
  );
};

const segStyle: React.CSSProperties = { display: 'flex', margin: '4px 18px 10px', background: '#1C2030', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3 };
const segBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: 8, border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: active ? '#F0F2F8' : '#8B92A8', background: active ? '#232840' : 'transparent', cursor: 'pointer' });
const secStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#7B8299', padding: '16px 18px 8px' };
const viewBtn: React.CSSProperties = { padding: '8px 12px', background: '#232840', color: '#F0F2F8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const donateBtn: React.CSSProperties = { padding: '8px 12px', background: 'rgba(123,97,255,0.12)', color: '#9B85FF', border: '1px solid rgba(123,97,255,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const joinBtnStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const leaveBtnStyle: React.CSSProperties = { flex: 1, padding: '8px 12px', background: 'rgba(255,77,106,0.1)', color: '#FF4D6A', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 300, display: 'flex', alignItems: 'flex-end' };
const modalStyle: React.CSSProperties = { width: '100%', background: '#161927', borderRadius: '24px 24px 0 0', padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh', overflowY: 'auto' };
const handleBar: React.CSSProperties = { width: 36, height: 4, background: '#2A2F48', borderRadius: 2, margin: '0 auto 16px' };
const closeBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8B92A8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const chipBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '7px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(245,200,66,0.12)' : '#232840', color: active ? '#F5C842' : '#8B92A8', borderColor: active ? 'rgba(245,200,66,0.3)' : 'rgba(255,255,255,0.07)', fontFamily: 'inherit' });
const goldBtnFull: React.CSSProperties = { width: '100%', padding: '13px', background: '#F5C842', color: '#0B0D11', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
