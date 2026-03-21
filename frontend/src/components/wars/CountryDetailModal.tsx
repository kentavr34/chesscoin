import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { BattleCard } from '@/components/ui/BattleCard';
import { warsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

const toast = (text: string, type: 'error' | 'success' | 'info' = 'error') =>
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));

// COUNTRY DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
export const CountryDetailModal: React.FC<{
  countryId: string;
  activeWarId?: string | null;
  onClose: () => void;
  onJoined: () => void;
}> = ({ countryId, activeWarId, onClose, onJoined }) => {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useUserStore();
  const warsInfo = useInfoPopup('wars', t.wars.info as Parameters<typeof import("@/components/layout/PageLayout").InfoPopup>[0]["slides"]);
  const [data, setData] = useState<{ country: import("@/types").Country; members: Record<string,unknown>[]; isCommander: boolean } | null>(null);
  const [joining, setJoining] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);

  useEffect(() => {
    warsApi.country(countryId).then(setData).catch(console.error);
  }, [countryId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await warsApi.join(countryId);
      toast(t.wars.joined, 'success');
      onJoined();
      onClose();
    } catch (e: unknown) {
      toast(e.message ?? t.common.error);
    } finally {
      setJoining(false);
    }
  };

  const handleChallenge = async (opponentUserId: string) => {
    if (!activeWarId) {
      toast(t.wars.noActiveWar, 'info');
      return;
    }
    setChallenging(opponentUserId);
    try {
      const r = await warsApi.challenge(activeWarId, opponentUserId);
      toast(t.wars.challengeSent, 'success');
      navigate(`/game/${r.sessionId}`);
      onClose();
    } catch (e: unknown) {
      // W2: понятное сообщение при лимите батлов
      const msg = e.error === 'WAR_BATTLES_LIMIT' || e.message?.includes('лимит')
        ? '⚔️ Идёт 10 сражений — дождись завершения одного из них'
        : e.message ?? t.common.error;
      toast(msg, 'info');
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
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary, #F0F2F8)' }}>{c?.nameRu ?? '...'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>{c?.nameEn ?? ''}</div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {c && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <StatBox label="Казна" value={`${fmtBalance(c.treasury)} ᚙ`} color="var(--accent, #F5C842)" />
            <StatBox label="Побед" value={String(c.wins)} color="var(--green, #00D68F)" />
            <StatBox label="Бойцов" value={`${c.memberCount} / ${c.maxMembers}`} color="#7B61FF" />
          </div>
        )}

        {c?.activeWar && (
          <div style={{ padding: '10px 14px', background: 'rgba(245,77,66,0.08)', border: '1px solid rgba(245,77,66,0.2)', borderRadius: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red, #FF4D6A)', marginBottom: 4 }}>⚔️ ИДЁТ ВОЙНА</div>
            <div style={{ fontSize: 12, color: 'var(--text-primary, #C8CDDF)' }}>
              {c.activeWar.attackerCountry?.nameRu} vs {c.activeWar.defenderCountry?.nameRu}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
              {c.activeWar.attackerWins} : {c.activeWar.defenderWins}
            </div>
          </div>
        )}

        {!isMine && (
          <button onClick={handleJoin} disabled={joining} style={{ ...goldBtnFull, marginBottom: 14, opacity: joining ? 0.6 : 1 }}>
            {joining ? t.common.loading : `🏴 ${t.wars.joinCountry}`}
          </button>
        )}
        {isMine && (
          <div style={{ padding: '8px 12px', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, marginBottom: 12, fontSize: 12, color: 'var(--green, #00D68F)', fontWeight: 600 }}>
            ✓ Вы боец этой страны
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #8B92A8)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
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
                <span style={{ fontSize: 13, color: 'var(--text-muted, #4A5270)', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              )}
              <div
                onClick={() => { navigate(`/profile/${m.userId}`); onClose(); }}
                style={{ cursor: 'pointer' }}
              >
                <Avatar user={m.user} size="s" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: m.isCommander ? 'var(--accent, #F5C842)' : 'var(--text-primary, #F0F2F8)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  onClick={() => { navigate(`/profile/${m.userId}`); onClose(); }}
                >
                  {m.isCommander && <span style={{ fontSize: 10, color: 'var(--accent, #F5C842)', marginRight: 4 }}>ГЛАВКОМ</span>}
                  {m.user?.firstName} {m.user?.lastName ?? ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>
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
            <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24, fontSize: 13 }}>Нет бойцов</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
