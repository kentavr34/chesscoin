import React, { useEffect, useState, useRef } from 'react';
import { fmtBalance } from '@/utils/format';
import { haptic } from '@/lib/haptic';

type ResultType = 'win' | 'lose' | 'draw';

interface GameResultModalProps {
  result: ResultType;
  earned: string;       // bigint строка — финальный бонус за победу
  commission: string;   // bigint строка — комиссия (только батл)
  pieceCoins?: string;  // bigint строка — монеты за фигуры (только бот-игра)
  botLevelName?: string; // название уровня JARVIS (для share)
  userTelegramId?: string;
  onClose: () => void;
}

const CONFIG = {
  win: {
    emoji: '🏆',
    title: 'Победа!',
    titleColor: '#F5C842',
    glow: 'rgba(245,200,66,0.25)',
    bg: 'linear-gradient(160deg,#1a1c0f 0%,#0B0D11 60%)',
    border: 'rgba(245,200,66,0.3)',
  },
  lose: {
    emoji: '💔',
    title: 'Поражение',
    titleColor: '#FF4D6A',
    glow: 'rgba(255,77,106,0.2)',
    bg: 'linear-gradient(160deg,#1a0b0d 0%,#0B0D11 60%)',
    border: 'rgba(255,77,106,0.25)',
  },
  draw: {
    emoji: '🤝',
    title: 'Ничья',
    titleColor: '#8B92A8',
    glow: 'rgba(139,146,168,0.15)',
    bg: 'linear-gradient(160deg,#12141c 0%,#0B0D11 60%)',
    border: 'rgba(255,255,255,0.12)',
  },
};

const AUTO_CLOSE_SEC = 3;

export const GameResultModal: React.FC<GameResultModalProps> = ({
  result,
  earned,
  commission,
  pieceCoins,
  botLevelName,
  userTelegramId,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SEC);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Анимация появления + haptic
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      if (result === 'win') haptic.win();
      else if (result === 'lose') haptic.lose();
      else haptic.impact('light');
    }, 30);
    return () => clearTimeout(t);
  }, []);

  // Авто-закрытие через 3 сек
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          handleClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const cfg = CONFIG[result];
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
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        transition: 'opacity .22s',
        opacity: visible ? 1 : 0,
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
          transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)',
          position: 'relative',
        }}
      >
        {/* Закрыть */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8B92A8', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >✕</button>

        {/* Таймер авто-закрытия */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          border: `2px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 11, fontWeight: 700, color: '#8B92A8',
        }}>
          {countdown}
        </div>

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
          {cfg.title}
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
                <span style={{ fontSize: 12, color: '#8B92A8' }}>За победу</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: '#F0F2F8',
                }}>
                  +{fmtBalance(earnedBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Бот-игра: монеты за фигуры */}
            {isBotGame && pieceBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8B92A8' }}>За фигуры</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: '#F0F2F8',
                }}>
                  +{fmtBalance(pieceBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Батл-игра: заработано */}
            {!isBotGame && earnedBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8B92A8' }}>Заработано</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: '#F0F2F8',
                }}>
                  +{fmtBalance(earnedBig.toString())} ᚙ
                </span>
              </div>
            )}

            {/* Комиссия (только батл) */}
            {commBig > 0n && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8B92A8' }}>Комиссия стола (10%)</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 14, fontWeight: 700, color: '#FF4D6A',
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
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F2F8' }}>Итого</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 18, fontWeight: 800,
                color: '#F5C842',
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
            textAlign: 'center', fontSize: 13, color: '#8B92A8',
            padding: '8px 0',
          }}>
            Ставки возвращены игрокам
          </div>
        )}

        {/* Кнопка Share (только победа над ботом) */}
        {result === 'win' && botLevelName && userTelegramId && (
          <button
            onClick={() => {
              const total = (earnedBig + pieceBig).toString();
              const shareText = `♟ Я победил J.A.R.V.I.S ${botLevelName} в ChessCoin!\nВыиграл ${fmtBalance(total)} ᚙ\nПопробуй и ты:`;
              const botUrl = `https://t.me/chessgamecoin_bot?start=ref_${userTelegramId}`;
              try {
                (window as any).Telegram?.WebApp?.openTelegramLink?.(
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
            📤 Поделиться победой
          </button>
        )}

        {/* Кнопка в лобби */}
        <button
          onClick={handleClose}
          style={{
            width: '100%', marginTop: 10,
            padding: '12px', background: '#1C2030',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, color: '#F0F2F8',
            fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background .15s',
          }}
        >
          ← В главное меню
        </button>
      </div>
    </div>
  );
};
