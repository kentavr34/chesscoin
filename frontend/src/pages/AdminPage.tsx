import { useT } from '@/i18n/useT';
/**
 * AdminPage.tsx
 *
 * Панель управления для владельца/админа.
 * Доступна только пользователям с isAdmin = true.
 * Маршрут: /admin
 *
 * Возможности:
 *   — Загрузка новых премиум-аватаров (drag & drop или выбор файла)
 *   — Список всех аватаров с количеством владельцев
 *   — Изменение цены / редкости / активности
 *   — Удаление (soft delete если есть владельцы, hard delete если нет)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { api } from '@/api/client';
import { fmtBalance } from '@/utils/format';

// ── API helpers ───────────────────────────────────────────────────────────────

const adminApi = {
  checkAccess: () =>
    api.get<{ isAdmin: boolean }>('/admin/me'),

  listAvatars: () =>
    api.get<{ items: AdminAvatarItem[] }>('/admin/avatars'),

  uploadAvatar: (formData: FormData) =>
    api.postForm<{ success: boolean; item: AdminAvatarItem }>('/admin/avatars/upload', formData),

  updateAvatar: (id: string, data: Partial<{ name: string; rarity: string; price: string; isActive: boolean }>) =>
    api.patch<{ success: boolean; item: AdminAvatarItem }>(`/admin/avatars/${id}`, data),

  deleteAvatar: (id: string) =>
    api.delete<{ success: boolean; deleted: boolean; message?: string }>(`/admin/avatars/${id}`),
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminAvatarItem {
  id: string;
  name: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  priceCoins: string;
  imageUrl: string | null;
  isActive: boolean;
  ownersCount: number;
  createdAt: string;
}

const RARITY_OPTIONS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
const RARITY_LABEL: Record<string, string> = {
  COMMON: 'Common', RARE: 'Rare', EPIC: 'Epic', LEGENDARY: 'Legendary', // R5: rarity names in English as internal keys
};
const RARITY_COLOR: Record<string, string> = {
  COMMON: '#8B92A8', RARE: '#7B61FF', EPIC: '#F5C842', LEGENDARY: '#FF6B35',
};
const DEFAULT_PRICES: Record<string, string> = {
  COMMON: '750', RARE: '2000', EPIC: '6000', LEGENDARY: '20000',
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminPage: React.FC = () => {
  const t = useT(); // R5: i18n
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [avatars, setAvatars] = useState<AdminAvatarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<'upload' | 'list' | 'users' | 'broadcast' | 'stats' | 'tournament' | 'airdrop'>('stats');
  // Airdrop state
  const [airdropMode, setAirdropMode] = useState<'fixed'|'multiplier'|'proportional'>('fixed');
  const [airdropAmount, setAirdropAmount] = useState('');
  const [airdropMultiplier, setAirdropMultiplier] = useState('1.5');
  const [airdropPool, setAirdropPool] = useState('');
  const [airdropMinBalance, setAirdropMinBalance] = useState('0');
  const [airdropLabel, setAirdropLabel] = useState('');
  const [airdropPreview, setAirdropPreview] = useState<{participants: number; totalAirdrop: string; preview: Array<{name:string;amount:string}>} | null>(null);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [tourName, setTourName] = useState('');
  const [tourType, setTourType] = useState('WORLD');
  const [tourFee, setTourFee] = useState('50000');
  const [tourDays, setTourDays] = useState('7');
  const [tourCreating, setTourCreating] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastBtn, setBroadcastBtn] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('');
  const [channelText, setChannelText] = useState('');
  const [sending, setSending] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Проверяем права доступа
  useEffect(() => {
    api.get('/admin/stats').then((r: Record<string,unknown>) => setStats(r)).catch(() => {});
    api.get('/admin/users').then((r: Record<string,unknown>) => setUsers(r.users ?? [])).catch(() => {});
  }, []);

  const searchUsers = async () => {
    try {
      const r = await api.get(`/admin/users?search=${userSearch}`);
      setUsers(r.users ?? []);
    } catch {}
  };

  const banUser = async (id: string) => {
    try {
      const r = await api.post(`/admin/users/${id}/ban`, {});
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: (r as Record<string,unknown>).isBanned } : u));
      showToast((r as Record<string,unknown>).isBanned ? 'Пользователь заблокирован' : 'Блокировка снята');
    } catch (e: unknown) { showToast((e instanceof Error ? e.message : String(e)), false); }
  };

  const sendBroadcast = async (isChannel = false) => {
    setSending(true);
    try {
      const url = isChannel ? '/admin/channel' : '/admin/broadcast';
      const text = isChannel ? channelText : broadcastText;
      const r = await api.post(url, { text, buttonText: broadcastBtn || undefined, buttonUrl: broadcastUrl || undefined });
      showToast(isChannel ? `✅ Опубликовано в канал` : `✅ Отправлено: ${(r as Record<string,unknown>).sent}, ошибок: ${(r as Record<string,unknown>).failed}`);
      if (!isChannel) { setBroadcastText(''); setBroadcastBtn(''); setBroadcastUrl(''); }
      else setChannelText('');
    } catch (e: unknown) { showToast((e instanceof Error ? e.message : String(e)), false); }
    setSending(false);
  };

  useEffect(() => {
    adminApi.checkAccess()
      .then(r => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadAvatars = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.listAvatars();
      setAvatars(r.items);
    } catch {
      showToast('Ошибка загрузки списка', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadAvatars();
  }, [isAdmin, loadAvatars]);

  // ── Нет доступа ────────────────────────────────────────────────────────────
  if (isAdmin === false) {
    return (
      <PageLayout title="⛔ Нет доступа" backTo="/">
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginBottom: 8 }}>
            Только для администраторов
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)' }}>
            Твой аккаунт не имеет прав администратора.
          </div>
        </div>
      </PageLayout>
    );
  }

  if (isAdmin === null) {
    return (
      <PageLayout title="Admin" backTo="/">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted, #4A5270)' }}>
          Проверка прав...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="🛠 Админ-панель" backTo="/" centered>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(0,214,143,0.15)' : 'rgba(255,77,106,0.15)',
          border: `1px solid ${toast.ok ? '#00D68F' : '#FF4D6A'}`,
          borderRadius: 12, padding: '10px 20px', fontSize: 13,
          color: toast.ok ? '#00D68F' : '#FF4D6A',
          zIndex: 9999, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header info */}
      <div style={{ margin: '8px 18px 0', padding: '12px 16px', background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>👑</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>Администратор</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
            {user?.firstName} · Аватаров в магазине: {avatars.filter(a => a.isActive).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '12px 18px 16px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 2 }}>
        {([['stats', t.admin.stats], ['users', t.admin.users], ['broadcast', t.admin.broadcast], ['tournament', t.admin.tournament], ['airdrop', '🪂 Airdrop'], ['upload', t.admin.avatars], ['list', t.admin.list]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '9px 4px', border: 'none', borderRadius: 8,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            color: tab === key ? 'var(--text-primary, #F0F2F8)' : 'var(--text-secondary, #8B92A8)',
            background: tab === key ? 'var(--bg-input, #232840)' : 'transparent',
            cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <UploadTab
          onSuccess={(item) => {
            showToast(`✅ Аватар «${item.name}» загружен!`);
            setAvatars(prev => [item, ...prev]);
            setTab('list');
          }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {tab === 'list' && (
        <ListTab
          avatars={avatars}
          loading={loading}
          onUpdate={(updated) => {
            setAvatars(prev => prev.map(a => a.id === updated.id ? updated : a));
            showToast('Сохранено');
          }}
          onDelete={(id, deleted) => {
            if (deleted) setAvatars(prev => prev.filter(a => a.id !== id));
            else setAvatars(prev => prev.map(a => a.id === id ? { ...a, isActive: false } : a));
            showToast(deleted ? 'Аватар удалён' : 'Аватар скрыт из магазина');
          }}
          onError={(msg) => showToast(msg, false)}
        />
      )}

      {/* A5: Статистика */}
      {tab === 'stats' && stats && (
        <div style={{ margin: '0 18px' }}>
          {[
            [t.admin.totalUsers, stats.users],
            [t.admin.totalSessions, stats.sessions],
            [t.admin.activeSessions, stats.activeSessions],
            [t.admin.battlesToday, stats.battlesToday],
            [t.admin.emissionPhase, stats.currentPhase],
            [t.admin.reserve, `${Number(stats.platformReserve).toLocaleString()} ᚙ`],
          ].map(([label, val]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #8B92A8)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* A1: Пользователи */}
      {tab === 'users' && (
        <div style={{ margin: '0 18px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} placeholder=t.admin.searchPlaceholder style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit' }} />
            <button onClick={searchUsers} style={{ padding: '10px 16px', background: 'var(--accent, #F5C842)', border: 'none', borderRadius: 12, color: '#0B0D11', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🔍</button>
          </div>
          {users.map((u: Record<string,unknown>) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: u.isBanned ? 'var(--red, #FF4D6A)' : 'var(--text-primary, #F0F2F8)' }}>{u.firstName} @{u.username ?? '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>ID: {u.telegramId} · {Number(u.balance).toLocaleString()} ᚙ · ELO {u.elo}</div>
              </div>
              <button onClick={() => banUser(u.id)} style={{ padding: '5px 10px', background: u.isBanned ? 'rgba(0,214,143,0.1)' : 'rgba(255,77,106,0.1)', color: u.isBanned ? 'var(--green, #00D68F)' : 'var(--red, #FF4D6A)', border: '1px solid currentColor', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                {u.isBanned ? t.admin.unban : t.admin.ban}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* A2+A3: Рассылка */}
      {tab === 'broadcast' && (
        <div style={{ margin: '0 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #8B92A8)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>📢 Рассылка всем игрокам</div>
          <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder=t.admin.broadcastPlaceholder rows={4} style={{ width: '100%', padding: 12, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' as const }} />
          <input value={broadcastBtn} onChange={e => setBroadcastBtn(e.target.value)} placeholder=t.admin.buttonTextPlaceholder style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', marginTop: 8, boxSizing: 'border-box' as const }} />
          <input value={broadcastUrl} onChange={e => setBroadcastUrl(e.target.value)} placeholder=t.admin.buttonUrlPlaceholder style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', marginTop: 8, boxSizing: 'border-box' as const }} />
          <button onClick={() => sendBroadcast(false)} disabled={sending || !broadcastText} style={{ width: '100%', marginTop: 12, padding: '14px', background: sending ? '#2A2F48' : 'var(--accent, #F5C842)', border: 'none', borderRadius: 14, color: sending ? '#8B92A8' : '#0B0D11', fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {sending ? t.admin.sending : t.admin.sendBroadcast}
          </button>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #8B92A8)', margin: '20px 0 8px', textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>📣 Пост в канал</div>
          <textarea value={channelText} onChange={e => setChannelText(e.target.value)} placeholder=t.admin.channelPlaceholder rows={4} style={{ width: '100%', padding: 12, background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' as const }} />
          <button onClick={() => sendBroadcast(true)} disabled={sending || !channelText} style={{ width: '100%', marginTop: 8, padding: '14px', background: sending ? '#2A2F48' : 'rgba(0,152,234,0.15)', border: '1px solid rgba(0,152,234,0.3)', borderRadius: 14, color: sending ? '#8B92A8' : '#0098EA', fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {sending ? t.admin.publishing : t.admin.publish}
          </button>
        </div>
      )}

      {/* A4 / MINOR-02: Создание нестандартного турнира */}
      {tab === 'tournament' && (
        <div style={{ margin: '0 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #8B92A8)', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>🏆 Создать турнир</div>
          {[
            { label: t.admin.tourName, val: tourName, set: setTourName, placeholder: 'ChessCoin Championship 2026' },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>{label}</div>
              <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
          ))}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Тип</div>
            <select value={tourType} onChange={e => setTourType(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}>
              {['WORLD', 'COUNTRY', 'SEASONAL', 'MONTHLY', 'WEEKLY'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Взнос ᚙ</div>
              <input value={tourFee} onChange={e => setTourFee(e.target.value)} type="number"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Дней</div>
              <input value={tourDays} onChange={e => setTourDays(e.target.value)} type="number"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card, #1C2030)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'var(--text-primary, #F0F2F8)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <button
            disabled={tourCreating || !tourName}
            onClick={async () => {
              setTourCreating(true);
              try {
                await api.post('/admin/tournaments', { name: tourName, type: tourType, entryFee: tourFee, durationDays: tourDays });
                showToast(`✅ Турнир «${tourName}» создан!`);
                setTourName('');
              } catch (e: unknown) { showToast((e instanceof Error ? e.message : String(e)), false); }
              setTourCreating(false);
            }}
            style={{ width: '100%', padding: '14px', background: tourCreating || !tourName ? '#2A2F48' : 'var(--accent, #F5C842)', border: 'none', borderRadius: 14, color: tourCreating || !tourName ? '#8B92A8' : '#0B0D11', fontWeight: 700, fontSize: 14, cursor: tourCreating || !tourName ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {tourCreating ? t.admin.creating : t.admin.createTournament}
          </button>
        </div>
      )}
      {/* Airdrop вкладка */}
      {tab === 'airdrop' && (
        <div style={{ padding: '0 18px 32px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🪂 Массовое начисление ᚙ</div>

          {/* Режим */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>РЕЖИМ</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {([['fixed','Фиксировано'],['multiplier','Множитель'],['proportional','Пропорционально']] as const).map(([m, l]) => (
              <button key={m} onClick={() => setAirdropMode(m)} style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: airdropMode === m ? 'rgba(245,200,66,0.15)' : 'var(--bg-card,#1C2030)', color: airdropMode === m ? 'var(--accent,#F5C842)' : 'var(--text-secondary)' }}>{l}</button>
            ))}
          </div>

          {/* Параметры по режиму */}
          {airdropMode === 'fixed' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>СУММА КАЖДОМУ (ᚙ)</div>
              <input value={airdropAmount} onChange={e => setAirdropAmount(e.target.value)} placeholder="например 5000" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          {airdropMode === 'multiplier' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>МНОЖИТЕЛЬ (текущий баланс × X)</div>
              <input value={airdropMultiplier} onChange={e => setAirdropMultiplier(e.target.value)} placeholder="например 1.5" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          {airdropMode === 'proportional' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>ОБЩИЙ ПУЛ (ᚙ)</div>
              <input value={airdropPool} onChange={e => setAirdropPool(e.target.value)} placeholder="например 10000000" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Фильтр и метка */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>МИН. БАЛАНС (ᚙ)</div>
              <input value={airdropMinBalance} onChange={e => setAirdropMinBalance(e.target.value)} placeholder="0" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>НАЗВАНИЕ</div>
              <input value={airdropLabel} onChange={e => setAirdropLabel(e.target.value)} placeholder="Token Launch Airdrop" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-input,#1A1E2E)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Кнопки */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              disabled={airdropLoading}
              onClick={async () => {
                setAirdropLoading(true);
                try {
                  const body = { mode: airdropMode, dryRun: true, minBalance: airdropMinBalance || '0', label: airdropLabel, fixedAmount: airdropAmount, multiplier: airdropMultiplier, totalPool: airdropPool };
                  const r = await fetch('/api/v1/admin/airdrop/execute', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify(body) });
                  const d = await r.json();
                  setAirdropPreview(d);
                } catch (e) { alert('Ошибка') } finally { setAirdropLoading(false); }
              }}
              style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              👁 Предпросмотр
            </button>
            <button
              disabled={airdropLoading || !airdropPreview}
              onClick={async () => {
                if (!confirm(`Начислить ${airdropPreview?.totalAirdrop} ᚙ для ${airdropPreview?.participants} игроков?`)) return;
                setAirdropLoading(true);
                try {
                  const body = { mode: airdropMode, dryRun: false, minBalance: airdropMinBalance || '0', label: airdropLabel, fixedAmount: airdropAmount, multiplier: airdropMultiplier, totalPool: airdropPool };
                  const r = await fetch('/api/v1/admin/airdrop/execute', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify(body) });
                  const d = await r.json();
                  alert(`✅ Airdrop выполнен: ${d.participants} игроков, ${d.totalAirdrop} ᚙ`);
                  setAirdropPreview(null);
                } catch (e) { alert('Ошибка') } finally { setAirdropLoading(false); }
              }}
              style={{ flex: 1, padding: '12px', background: 'rgba(245,200,66,0.15)', color: 'var(--accent,#F5C842)', border: '1px solid rgba(245,200,66,0.3)', borderRadius: 12, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: airdropPreview ? 'pointer' : 'not-allowed', opacity: airdropPreview ? 1 : 0.5 }}>
              🪂 Запустить
            </button>
          </div>

          {/* Предпросмотр */}
          {airdropPreview && (
            <div style={{ background: 'var(--bg-card,#1C2030)', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Участников: {airdropPreview.participants} · Итого: {Number(airdropPreview.totalAirdrop).toLocaleString()} ᚙ
              </div>
              {airdropPreview.preview?.slice(0, 5).map((p: {name:string; amount:string}, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--accent,#F5C842)' }}>+{Number(p.amount).toLocaleString()} ᚙ</span>
                </div>
              ))}
              {airdropPreview.participants > 5 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>...и ещё {airdropPreview.participants - 5} игроков</div>
              )}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
};

// ── Upload Tab ────────────────────────────────────────────────────────────────

const UploadTab: React.FC<{
  onSuccess: (item: AdminAvatarItem) => void;
  onError: (msg: string) => void;
}> = ({ onSuccess, onError }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<string>('COMMON');
  const [price, setPrice] = useState('750');
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { onError('Только изображения'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
    // Предзаполняем имя из filename если пустое
    if (!name) {
      const n = f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      setName(n.charAt(0).toUpperCase() + n.slice(1));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleRarityChange = (r: string) => {
    setRarity(r);
    setPrice(DEFAULT_PRICES[r] ?? '1000');
  };

  const handleUpload = async () => {
    if (!file) { onError('Выбери файл'); return; }
    if (!name.trim()) { onError('Введи название'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      fd.append('rarity', rarity);
      fd.append('price', price);

      const r = await adminApi.uploadAvatar(fd);
      setFile(null);
      setPreview(null);
      setName('');
      setRarity('COMMON');
      setPrice('750');
      onSuccess(r.item);
    } catch (err: unknown) {
      onError((err instanceof Error ? err.message : String(err)) || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Drag & Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent, #F5C842)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 18,
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(245,200,66,0.05)' : 'var(--bg-card, #1C2030)',
          transition: 'all .2s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {preview ? (
          <>
            {/* Предпросмотр в круге */}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              overflow: 'hidden', border: `2px solid ${RARITY_COLOR[rarity]}`,
              boxShadow: `0 0 12px ${RARITY_COLOR[rarity]}44`,
            }}>
              <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)' }}>
              {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent, #F5C842)' }}>
              Нажми чтобы сменить файл
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40 }}>🖼</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>
              Перетащи сюда или нажми
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)' }}>
              PNG, JPG, WebP · до 10 МБ · любой размер
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>
              Сервер автоматически обрежет в квадрат 400×400 WebP
            </div>
          </>
        )}
      </div>

      {/* Название */}
      <div>
        <div style={labelStyle}>Название аватара</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Golden Dragon"
          style={inputStyle}
        />
      </div>

      {/* Редкость */}
      <div>
        <div style={labelStyle}>Редкость</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RARITY_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => handleRarityChange(r)}
              style={{
                flex: 1, padding: '8px 4px', border: `1px solid ${rarity === r ? RARITY_COLOR[r] : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10, background: rarity === r ? `${RARITY_COLOR[r]}18` : 'var(--bg-card, #1C2030)',
                color: rarity === r ? RARITY_COLOR[r] : 'var(--text-secondary, #8B92A8)',
                fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {RARITY_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Цена */}
      <div>
        <div style={labelStyle}>Цена (ᚙ монеты)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['500', '1000', '2000', '5000', '10000', '25000'].map((p) => (
            <button
              key={p}
              onClick={() => setPrice(p)}
              style={{
                flex: 1, padding: '7px 2px', border: `1px solid ${price === p ? 'var(--accent, #F5C842)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, background: price === p ? 'rgba(245,200,66,0.1)' : 'var(--bg-card, #1C2030)',
                color: price === p ? 'var(--accent, #F5C842)' : 'var(--text-secondary, #8B92A8)',
                fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {parseInt(p) >= 1000 ? `${parseInt(p) / 1000}K` : p}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Или введи вручную"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      </div>

      {/* Итоговая карточка предпросмотра */}
      {preview && name && (
        <div style={{ padding: 12, background: 'var(--bg-card, #1C2030)', border: `1px solid ${RARITY_COLOR[rarity]}33`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${RARITY_COLOR[rarity]}`, flexShrink: 0 }}>
            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{name}</div>
            <div style={{ fontSize: 10, color: RARITY_COLOR[rarity], marginTop: 2 }}>{RARITY_LABEL[rarity]}</div>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>
            {fmtBalance(price)} ᚙ
          </div>
        </div>
      )}

      {/* Кнопка загрузки */}
      <button
        onClick={handleUpload}
        disabled={uploading || !file || !name.trim()}
        style={{
          width: '100%', padding: '14px',
          background: uploading || !file || !name.trim()
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, #F5C842, #FFD966)',
          color: uploading || !file || !name.trim() ? 'var(--text-muted, #4A5270)' : '#000',
          border: 'none', borderRadius: 14,
          fontSize: 14, fontWeight: 700, cursor: uploading || !file || !name.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all .2s',
        }}>
        {uploading ? '⏳ Загружаю на S3...' : '⬆️ Загрузить аватар'}
      </button>
    </div>
  );
};

// ── List Tab ──────────────────────────────────────────────────────────────────

const ListTab: React.FC<{
  avatars: AdminAvatarItem[];
  loading: boolean;
  onUpdate: (item: AdminAvatarItem) => void;
  onDelete: (id: string, deleted: boolean) => void;
  onError: (msg: string) => void;
}> = ({ avatars, loading, onUpdate, onDelete, onError }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ name: string; price: string; rarity: string }>({ name: '', price: '', rarity: 'COMMON' });
  const [actionId, setActionId] = useState<string | null>(null);

  const startEdit = (item: AdminAvatarItem) => {
    setEditingId(item.id);
    setEditData({ name: item.name, price: item.priceCoins, rarity: item.rarity });
  };

  const saveEdit = async (id: string) => {
    setActionId(id);
    try {
      const r = await adminApi.updateAvatar(id, {
        name: editData.name,
        price: editData.price,
        rarity: editData.rarity,
      });
      onUpdate(r.item);
      setEditingId(null);
    } catch (err: unknown) {
      onError((err instanceof Error ? err.message : String(err)) || 'Ошибка сохранения');
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (item: AdminAvatarItem) => {
    setActionId(item.id);
    try {
      const r = await adminApi.updateAvatar(item.id, { isActive: !item.isActive });
      onUpdate(r.item);
    } catch (err: unknown) {
      onError((err instanceof Error ? err.message : String(err)));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (item: AdminAvatarItem) => {
    const msg = item.ownersCount > 0
      ? `У аватара «${item.name}» есть ${item.ownersCount} владельцев. Он будет скрыт из магазина, но не удалён с S3. Продолжить?`
      : `Удалить аватар «${item.name}»? Файл будет удалён с S3.`;
    if (!confirm(msg)) return;

    setActionId(item.id);
    try {
      const r = await adminApi.deleteAvatar(item.id);
      onDelete(item.id, r.deleted);
    } catch (err: unknown) {
      onError((err instanceof Error ? err.message : String(err)));
    } finally {
      setActionId(null);
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted, #4A5270)' }}>Загрузка...</div>
  );

  if (avatars.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🖼</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted, #4A5270)' }}>
        Нет аватаров. Загрузи первый!
      </div>
    </div>
  );

  return (
    <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted, #4A5270)', marginBottom: 4 }}>
        Всего: {avatars.length} · Активных: {avatars.filter(a => a.isActive).length}
      </div>

      {avatars.map((item) => {
        const isEditing = editingId === item.id;
        const busy = actionId === item.id;
        const color = RARITY_COLOR[item.rarity];

        return (
          <div key={item.id} style={{
            background: 'var(--bg-card, #1C2030)',
            border: `1px solid ${item.isActive ? `${color}33` : 'rgba(255,255,255,0.05)'}`,
            borderRadius: 16, padding: 12,
            opacity: item.isActive ? 1 : 0.5,
          }}>
            {/* Заголовок */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 12 : 0 }}>
              {/* Круглый превью */}
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${color}`, flexShrink: 0 }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: '#1C2030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color, fontWeight: 600 }}>{RARITY_LABEL[item.rarity]}</span>
                  <span style={{ fontSize: 10, color: 'var(--accent, #F5C842)', fontFamily: 'JetBrains Mono,monospace' }}>{fmtBalance(item.priceCoins)} ᚙ</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted, #4A5270)' }}>👤 {item.ownersCount}</span>
                  {!item.isActive && <span style={{ fontSize: 9, color: '#FF4D6A', fontWeight: 700 }}>СКРЫТ</span>}
                </div>
              </div>

              {/* Кнопки управления */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!isEditing && (
                  <button onClick={() => startEdit(item)} style={iconBtn('#7B61FF')}>✏️</button>
                )}
                <button
                  onClick={() => handleToggleActive(item)}
                  disabled={busy}
                  style={iconBtn(item.isActive ? '#FF9F43' : '#00D68F')}>
                  {item.isActive ? '👁' : '👁‍🗨'}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busy}
                  style={iconBtn('#FF4D6A')}>
                  🗑
                </button>
              </div>
            </div>

            {/* Форма редактирования */}
            {isEditing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))}
                  placeholder={t.admin.tourName}
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {RARITY_OPTIONS.map((r) => (
                    <button key={r} onClick={() => setEditData(d => ({ ...d, rarity: r }))} style={{
                      flex: 1, padding: '6px 2px', border: `1px solid ${editData.rarity === r ? RARITY_COLOR[r] : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8, background: editData.rarity === r ? `${RARITY_COLOR[r]}18` : 'transparent',
                      color: editData.rarity === r ? RARITY_COLOR[r] : 'var(--text-secondary, #8B92A8)',
                      fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {RARITY_LABEL[r].slice(0, 3)}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={editData.price}
                  onChange={(e) => setEditData(d => ({ ...d, price: e.target.value }))}
                  placeholder="Цена ᚙ"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => saveEdit(item.id)}
                    disabled={busy}
                    style={{ flex: 1, padding: '8px', background: 'var(--green, #00D68F)', color: '#000', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {busy ? '...' : '✓ Сохранить'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary, #8B92A8)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #4A5270)',
  letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', boxSizing: 'border-box',
  background: 'var(--bg-card, #13161E)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: 'var(--text-primary, #F0F2F8)',
  fontSize: 13, fontFamily: 'inherit', outline: 'none',
};

const iconBtn = (color: string): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${color}33`,
  background: `${color}11`, color: 'var(--text-primary, #F0F2F8)',
  fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0,
});
