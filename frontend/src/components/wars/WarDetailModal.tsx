import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { BattleCard } from '@/components/ui/BattleCard';
import { warsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

const toast = (text: string, type: 'error' | 'success' | 'info' = 'error') =>
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));

// WAR DETAIL MODAL (просмотр партий войны)
// ─────────────────────────────────────────────────────────────────────────────
export const WarDetailModal: React.FC<{ warId: string; onClose: () => void }> = ({ warId, onClose }) => {
  const t = useT();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    warsApi.warDetail(warId).then(r => setData(r.war)).catch(console.error);
  }, [warId]);

  const handleSave = async (sessionId: string) => {
    setSaving(sessionId);
    try {
      await warsApi.saveGame(sessionId);
      toast(t.wars.battleSaved, 'success');
    } catch (e: unknown) {
      toast(e.message ?? t.common.error);
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
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>⚔️ Детали войны</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {!war && <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 32 }}>Загрузка...</div>}

        {war && (
          <>
            {/* Счёт */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '14px 16px', background: 'var(--bg-card, #1C2030)', borderRadius: 16 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 24 }}>{war.attackerCountry?.flag}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginTop: 4 }}>{war.attackerCountry?.nameRu}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 800, color: 'var(--accent, #F5C842)' }}>
                  {war.attackerWins} : {war.defenderWins}
                </div>
                <div style={{ fontSize: 10, color: war.status === 'IN_PROGRESS' ? 'var(--green, #00D68F)' : 'var(--text-secondary, #8B92A8)', marginTop: 2 }}>
                  {war.status === 'IN_PROGRESS' ? `⏱ ${formatTime(war.secondsLeft)}` : '✓ Завершена'}
                </div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 24 }}>{war.defenderCountry?.flag}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)', marginTop: 4 }}>{war.defenderCountry?.nameRu}</div>
              </div>
            </div>

            {war.winnerCountryId && (
              <div style={{ padding: '8px 14px', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', borderRadius: 12, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green, #00D68F)' }}>
                  🏆 Победитель: {war.winnerCountryId === war.attackerCountryId ? war.attackerCountry?.nameRu : war.defenderCountry?.nameRu}
                </div>
              </div>
            )}

            {/* Список партий */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #8B92A8)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
              Партии ({war.battles?.length ?? 0})
            </div>
            {/* W4/W6: единый BattleCard компонент */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {(war.battles ?? []).map((b) => {
                const p1 = b.session?.sides?.[0]?.player;
                const p2 = b.session?.sides?.[1]?.player;
                const isDone = b.status === 'FINISHED';
                const winner = isDone
                  ? (b.winnerId === b.attackerId ? 'player1' : b.winnerId === b.defenderId ? 'player2' : 'draw')
                  : null;
                return (
                  <BattleCard
                    key={b.id}
                    player1={p1 ? { ...p1, countryFlag: war.attackerCountry?.flag } : null}
                    player2={p2 ? { ...p2, countryFlag: war.defenderCountry?.flag } : null}
                    status={isDone ? 'FINISHED' : 'IN_PROGRESS'}
                    winner={winner as "player1" | "player2" | "draw" | null}
                    spectatorCount={b.spectatorCount}
                    sessionId={b.sessionId}
                    onSpectate={!isDone && b.sessionId ? () => { onClose(); navigate(`/game/${b.sessionId}?spectate=1`); } : undefined}
                    onSave={b.session?.pgn && isDone ? () => handleSave(b.sessionId) : undefined}
                    saving={saving === b.sessionId}
                  />
                );
              })}
              {!(war.battles?.length) && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted, #4A5270)', padding: 24, fontSize: 13 }}>Партий ещё нет</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
