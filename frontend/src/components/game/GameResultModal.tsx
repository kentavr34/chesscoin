import React, { useEffect, useState } from 'react';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';
import { sound } from '@/lib/sound';
import { useT } from '@/i18n/useT';

type ResultType = 'win' | 'lose' | 'draw';

interface GameResultModalProps {
  result: ResultType;
  earned: string;       // bigint строка — финальный бонус за победу
  commission: string;   // bigint строка — комиссия (только батл)
  pieceCoins?: string;  // bigint строка — монеты за фигуры (только бот-игра)
  botLevelName?: string; // название уровня JARVIS (для share)
  userTelegramId?: string;
  onClose: () => void;
  onRematch?: () => void;
  sessionId?: string;  // для батла — кнопка сохранить партию
  isBattle?: boolean;
}

const RESULT_META = {
  win:  { emoji: '🏆', titleColor: 'var(--accent, #F5C842)', glow: 'rgba(245,200,66,0.25)', bg: 'linear-gradient(160deg,#1a1c0f 0%,#0B0D11 60%)', border: 'rgba(245,200,66,0.3)' },
  lose: { emoji: '💔', titleColor: 'var(--red, #FF4D6A)', glow: 'rgba(255,77,106,0.2)',  bg: 'linear-gradient(160deg,#1a0b0d 0%,#0B0D11 60%)', border: 'rgba(255,77,106,0.25)' },
  draw: { emoji: '🤝', titleColor: 'var(--text-secondary, #8B92A8)', glow: 'rgba(139,146,168,0.15)', bg: 'linear-gradient(160deg,#12141c 0%,#0B0D11 60%)', border: 'rgba(255,255,255,0.12)' },
};

export const GameResultModal: React.FC<GameResultModalProps> = ({
  result,
  earned,
  commission,
  pieceCoins,
  botLevelName,
  userTelegramId,
  onClose,
  onRematch,
  sessionId,
  isBattle,
}) => {
  const [gameSaved, setGameSaved] = React.useState(false);
  const t = useT();
  const [visible, setVisible] = useState(false);

  // Анимация появления + haptic + sound
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      if (result === 'win') { haptic.win(); sound.win(); }
      else if (result === 'lose') { haptic.lose(); sound.lose(); }
      else { haptic.impact('light'); sound.draw(); }
    }, 30);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const cfg = RESULT_META[result];
  const titles = { win: t.gameResult.win, lose: t.gameResult.lose, draw: t.gameResult.draw };
  const earnedBig = BigInt(earned || '0');
  const commBig   = BigInt(commission || '0');
  const pieceBig  = BigInt(pieceCoins || '0');
  const isBotGame = pieceCoins !== undefined;
  // Для бот-игры: итого = победный бонус + монеты за фигуры
  // Для батла: итого = earned - комиссия
  const netBig    = isBotGame ? earnedBig + pieceBig : earnedBig - commBig;
  const showCoins = earnedBig > 0n || pieceBig > 0n;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: "var(--z-overlay, 200)",
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 320,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 24,
          padding: '28px 24px 22px',
          boxShadow: `0 0 60px ${cfg.glow}, 0 20px 60px rgba(0,0,0,0.5)`,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), opacity .22s',
          position: 'relative',
        }}
      >
        {/* Закрыть */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--border, rgba(255,255,255,0.07))',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary, #8B92A8)', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >✕</button>

        {/* Эмодзи */}
        <div style={{ textAlign: 'center', fontSize: 56, lineHeight: 1, marginBottom: 12 }}>
          {cfg.emoji}
        </div>

        {/* Заголовок */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 24, fontWeight: 800,
          color: cfg.titleColor,
          letterSpacing: '-.02em',
          marginBottom: 20,
          textShadow: `0 0 24px ${cfg.glow}`,
        }}>
          {titles[result]}
        </div>

        {/* Разбивка монет */}
        {showCoins && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Бот-игра: бонус за победу */}
            {isBotGame && earnedBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>{t.gameResult.forWin}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)',
                }}>
                  +{fmtBalance(earnedBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Бот-игра: монеты за фигуры */}
            {isBotGame && pieceBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>{t.gameResult.forPieces}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)',
                }}>
                  +{fmtBalance(pieceBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Батл-игра: заработано */}
            {!isBotGame && earnedBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>{t.gameResult.earned}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)',
                }}>
                  +{fmtBalance(earnedBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Комиссия (только батл) */}
            {commBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #8B92A8)' }}>{t.gameResult.commission}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: 'var(--red, #FF4D6A)',
                }}>
                  −{fmtBalance(commBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Разделитель */}
            {(commBig > 0n || (isBotGame && earnedBig > 0n && pieceBig > 0n)) && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '2px 0' }} />
            )}

            {/* Итого */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F2F8)' }}>{t.gameResult.total}</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 18, fontWeight: 800,
                color: 'var(--accent, #F5C842)',
                textShadow: '0 0 12px rgba(245,200,66,0.5)',
              }}>
                +{fmtBalance(netBig.toString())} ᚙ
              </span>
            </div>
          </div>
        )}

        {/* Draw — нет начислений */}
        {result === 'draw' && (
          <div style={{
            textAlign: 'center', fontSize: 13, color: 'var(--text-secondary, #8B92A8)',
            padding: '8px 0',
          }}>
            {t.gameResult.drawMsg}
          </div>
        )}

        {/* Кнопка Share (только победа над ботом) */}
        {result === 'win' && botLevelName && userTelegramId && (
          <button
            onClick={() => {
              const total = (earnedBig + pieceBig).toString();
              const shareText = `♟ I beat J.A.R.V.I.S ${botLevelName} in ChessCoin!\nWon ${fmtBalance(total)} ᚙ\nTry it too:`;
              const botUrl = `https://t.me/chessgamecoin_bot?start=ref_${userTelegramId}`;
              try {
                window.Telegram?.WebApp?.openTelegramLink?.(
                  `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(shareText)}`
                );
              } catch {}
            }}
            style={{
              width: '100%', marginTop: 14,
              padding: '11px', background: 'rgba(123,97,255,0.12)',
              border: '1px solid rgba(123,97,255,0.25)',
              borderRadius: 14, color: '#9B85FF',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t.gameResult.shareWin}
          </button>
        )}

        {/* Кнопка Реванш (только бот-игра) */}
        {botLevelName && onRematch && (
          <button
            onClick={onRematch}
            style={{
              width: '100%', marginTop: 10,
              padding: '12px', background: 'transparent',
              border: '1px solid rgba(245,200,66,0.4)',
              borderRadius: 14, color: 'var(--accent, #F5C842)',
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s',
            }}
          >
            ⚔️ Rematch
          </button>
        )}

        {/* Кнопка Сохранить партию — только для батла */}
        {isBattle && sessionId && (
          <button
            onClick={async () => {
              if (gameSaved) return;
              try {
                const { warsApi } = await import('@/api');
                await warsApi.saveGame(sessionId);
                setGameSaved(true);
              } catch {}
            }}
            style={{
              width: '100%', marginTop: 10,
              padding: '11px', borderRadius: 14,
              background: gameSaved ? 'rgba(0,214,143,0.1)' : 'rgba(123,97,255,0.1)',
              border: `1px solid ${gameSaved ? 'rgba(0,214,143,0.25)' : 'rgba(123,97,255,0.25)'}`,
              color: gameSaved ? 'var(--green, #00D68F)' : '#9B85FF',
              fontSize: 13, fontWeight: 600,
              cursor: gameSaved ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {gameSaved ? '✓ Game saved' : '💾 Save game'}
          </button>
        )}

        {/* Кнопка в лобби */}
        <button
          onClick={handleClose}
          style={{
            width: '100%', marginTop: 10,
            padding: '12px', background: 'var(--bg-card, #1C2030)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: 14, color: 'var(--text-primary, #F0F2F8)',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background .15s',
          }}
        >
          {t.gameResult.backToMenu}
        </button>
      </div>
    </div>
  );
};
