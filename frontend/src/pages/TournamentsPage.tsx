import React, { useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { useUserStore } from '@/store/useUserStore';
import { tournamentsApi, type TournamentItem } from '@/api';
import { fmtBalance } from '@/utils/format';

export const TournamentsPage: React.FC = () => {
  const { user, setUser } = useUserStore();
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    tournamentsApi.list()
      .then((r) => setTournaments(r.tournaments))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleJoin = async (t: TournamentItem) => {
    if (joining || t.isJoined) return;
    setJoining(t.id);
    try {
      await tournamentsApi.join(t.id);
      showToast('✅ Вы вступили в турнир!');
      load();
    } catch (e: any) {
      const msg: Record<string, string> = {
        INSUFFICIENT_BALANCE: 'Недостаточно монет',
        ALREADY_JOINED: 'Вы уже участвуете',
        TOURNAMENT_FULL: 'Турнир заполнен',
        REGISTRATION_CLOSED: 'Регистрация закрыта',
      };
      showToast('❌ ' + (msg[e?.message] ?? 'Ошибка'));
    } finally {
      setJoining(null);
    }
  };

  const statusLabel: Record<string, string> = {
    REGISTRATION: 'Регистрация',
    IN_PROGRESS: 'Идёт',
    FINISHED: 'Завершён',
  };
  const statusColor: Record<string, string> = {
    REGISTRATION: '#F5C842',
    IN_PROGRESS: '#00D68F',
    FINISHED: '#4A5270',
  };

  return (
    <PageLayout backTo="/" logo={false}>
      <div style={{ padding: '12px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 18, fontWeight: 800, color: '#F0F2F8' }}>
          🏆 Турниры
        </div>
        <div style={{ fontSize: 11, color: '#8B92A8' }}>Баланс: {fmtBalance(user?.balance ?? '0')} ᚙ</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#4A5270', padding: 48, fontSize: 13 }}>Загрузка...</div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F2F8', marginBottom: 8 }}>Нет активных турниров</div>
          <div style={{ fontSize: 12, color: '#8B92A8' }}>Скоро появятся новые турниры. Следите за обновлениями!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 18px 24px' }}>
          {tournaments.map((t) => (
            <div key={t.id} style={cardStyle}>
              {/* Статус */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: statusColor[t.status] ?? '#8B92A8', background: `${statusColor[t.status] ?? '#8B92A8'}18`, padding: '3px 8px', borderRadius: 6 }}>
                  {statusLabel[t.status] ?? t.status}
                </span>
                <span style={{ fontSize: 10, color: '#4A5270' }}>
                  {t.currentPlayers} / {t.maxPlayers} игроков
                </span>
              </div>

              {/* Название */}
              <div style={{ fontSize: 17, fontWeight: 800, color: '#F0F2F8', marginBottom: 4 }}>{t.name}</div>
              {t.description && (
                <div style={{ fontSize: 12, color: '#8B92A8', marginBottom: 10, lineHeight: 1.5 }}>{t.description}</div>
              )}

              {/* Призовой фонд */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={infoChip}>
                  <div style={{ fontSize: 9, color: '#4A5270', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Приз</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 800, color: '#F5C842' }}>
                    {fmtBalance(t.prizePool)} ᚙ
                  </div>
                </div>
                <div style={infoChip}>
                  <div style={{ fontSize: 9, color: '#4A5270', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Взнос</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 800, color: BigInt(t.entryFee) > 0n ? '#9B85FF' : '#00D68F' }}>
                    {BigInt(t.entryFee) > 0n ? fmtBalance(t.entryFee) + ' ᚙ' : 'Бесплатно'}
                  </div>
                </div>
              </div>

              {/* Прогресс игроков */}
              <div style={{ height: 3, background: '#232840', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(t.currentPlayers / t.maxPlayers) * 100}%`, background: 'linear-gradient(90deg,#7B61FF,#9B85FF)', borderRadius: 2, transition: 'width .3s' }} />
              </div>

              {/* Кнопка */}
              {t.status === 'REGISTRATION' && (
                <button
                  onClick={() => handleJoin(t)}
                  disabled={t.isJoined || joining === t.id || t.currentPlayers >= t.maxPlayers}
                  style={joinBtnStyle(t.isJoined, joining === t.id)}
                >
                  {t.isJoined ? '✓ Вы участвуете' : joining === t.id ? 'Регистрация...' : t.currentPlayers >= t.maxPlayers ? 'Мест нет' : '→ Вступить'}
                </button>
              )}
              {t.status === 'IN_PROGRESS' && t.isJoined && (
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#00D68F', padding: '10px 0 0' }}>⚔ Вы участвуете в этом турнире</div>
              )}
              {t.startAt && t.status === 'REGISTRATION' && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#4A5270', marginTop: 8 }}>
                  Старт: {new Date(t.startAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#232840', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#F0F2F8', zIndex: 500, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </PageLayout>
  );
};

const cardStyle: React.CSSProperties = {
  background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
  padding: '18px 16px',
};
const infoChip: React.CSSProperties = {
  flex: 1,
  background: '#232840',
  borderRadius: 12,
  padding: '8px 12px',
};
const joinBtnStyle = (joined: boolean, loading: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '13px',
  background: joined ? 'rgba(0,214,143,0.1)' : loading ? '#232840' : '#7B61FF',
  border: `1px solid ${joined ? 'rgba(0,214,143,0.3)' : loading ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
  borderRadius: 14,
  color: joined ? '#00D68F' : '#F0F2F8',
  fontSize: 14,
  fontWeight: 700,
  cursor: joined || loading ? 'default' : 'pointer',
  fontFamily: 'inherit',
  opacity: loading ? 0.6 : 1,
  transition: 'all .15s',
});
