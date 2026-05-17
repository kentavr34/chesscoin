/**
 * ShareSessionButton — PR-2
 *
 * Кнопка «Поделиться партией» по shareToken. Открывает Telegram WebApp Share
 * (если есть) либо копирует deep-link. Одна и та же ссылка работает на всех
 * стадиях (WAITING / IN_PROGRESS / FINISHED) — рендерит SharePage в Mini App.
 */

import React from 'react';
import { IcoShare } from '@/components/icons/UiIcons';

const showToast = (text: string, type: 'info' | 'error' = 'info') => {
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));
};

interface Props {
  shareToken: string | null | undefined;
  label?: string;
  compact?: boolean;
  color?: string;
}

// PR-2: формат deep-link. Бот должен принимать ?startapp=share_<token>
// и роутить Mini App на /share/<token>. Для копирования просто URL Mini App.
function buildShareUrl(token: string): string {
  return `https://t.me/ChessCoinBot/app?startapp=share_${token}`;
}

export const ShareSessionButton: React.FC<Props> = ({ shareToken, label = 'Поделиться', compact = false, color = '#82CFFF' }) => {
  if (!shareToken) return null;

  const handleShare = async () => {
    const url = buildShareUrl(shareToken);
    const text = 'Партия в ChessCoin — смотри или поддержи донатом';

    // 1) Telegram WebApp Share (если открыто внутри Telegram)
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        return;
      }
    } catch {}

    // 2) Web Share API (мобильный браузер)
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'ChessCoin', text, url });
        return;
      }
    } catch {}

    // 3) Fallback — копирование в буфер
    try {
      await navigator.clipboard.writeText(url);
      showToast('Ссылка скопирована', 'info');
    } catch {
      showToast('Не удалось скопировать ссылку', 'error');
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleShare}
        title={label}
        style={{
          width: 32, height: 32, padding: 0,
          borderRadius: '50%',
          background: 'rgba(74,158,255,.08)',
          border: '.5px solid rgba(74,158,255,.25)',
          color,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IcoShare size={14} color={color} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        background: 'rgba(74,158,255,.08)',
        border: '.5px solid rgba(74,158,255,.3)',
        color,
        fontSize: '.7rem', fontWeight: 800,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      <IcoShare size={13} color={color} />
      {label}
    </button>
  );
};

export { buildShareUrl };
