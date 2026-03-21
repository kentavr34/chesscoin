import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { applyThemeToCss, getActiveTheme, THEMES } from '@/lib/theme';
import { useT } from '@/i18n/useT';

// Применяем тему при первом рендере
if (typeof window !== 'undefined') {
  const key = getActiveTheme();
  applyThemeToCss(THEMES[key]);
}

// ── InfoPopup ─────────────────────────────────────────────────────────────────
// Показывается при первом входе на страницу (один раз, затем сохраняется флаг)
interface InfoSlide { icon: string; title: string; desc: string; }

interface InfoPopupProps {
  infoKey: string;                // ключ для localStorage, напр. 'battles' или 'wars'
  slides: InfoSlide[];
  onClose: () => void;
}

export const InfoPopup: React.FC<InfoPopupProps> = ({ slides, onClose }) => {
  const [idx, setIdx] = useState(0);
  const t = useT();
  const isLast = idx === slides.length - 1;
  const slide = slides[idx];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 360,
        background: '#161927',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, padding: '28px 24px 22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
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

        {/* Icon */}
        <div style={{ textAlign: 'center', fontSize: 52, lineHeight: 1, marginBottom: 16 }}>
          {slide.icon}
        </div>

        {/* Title */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 17, fontWeight: 800, color: '#F5C842',
          letterSpacing: '-.02em', marginBottom: 12,
        }}>
          {slide.title}
        </div>

        {/* Desc */}
        <div style={{
          textAlign: 'center', fontSize: 13, color: '#8B92A8',
          lineHeight: 1.7, marginBottom: 24,
        }}>
          {slide.desc}
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {slides.map((_, i) => (
              <div
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? 18 : 6, height: 6, borderRadius: 3,
                  background: i === idx ? '#F5C842' : 'rgba(255,255,255,0.15)',
                  transition: 'all .2s', cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}

        {/* Button */}
        <button
          onClick={() => isLast ? onClose() : setIdx(idx + 1)}
          style={{
            width: '100%', padding: '13px',
            background: '#F5C842', borderRadius: 14,
            border: 'none', color: '#0B0D11',
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'opacity .15s',
          }}
        >
          {isLast ? t.home.letsGo : `${t.home.next}`}
        </button>
      </div>
    </div>
  );
};

// Хук: показать InfoPopup если ещё не видел
export const useInfoPopup = (infoKey: string, slides: InfoSlide[]) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(`info_seen_${infoKey}`);
    if (!seen && slides.length > 0) {
      // Небольшая задержка чтобы страница успела загрузиться
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, [infoKey]);

  const close = () => {
    localStorage.setItem(`info_seen_${infoKey}`, '1');
    setShow(false);
  };

  return { show, close, open: () => setShow(true) };
};

// ── PageLayout ────────────────────────────────────────────────────────────────
interface PageLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  logo?: boolean;
  backTo?: string;
  rightAction?: React.ReactNode;
  noScroll?: boolean;
  centered?: boolean;  // заголовок по центру
  onBack?: () => void;  // кастомная кнопка назад
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children, title, logo, backTo, rightAction, noScroll, centered, onBack,
}) => {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg, #0B0D11)', overflow: 'hidden',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: centered ? 'space-between' : 'space-between',
        padding: '14px 18px 8px',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        flexShrink: 0,
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))',
        position: 'relative',
      }}>
        {/* Левая часть */}
        {backTo || onBack ? (
          <button onClick={() => onBack ? onBack() : navigate(backTo!)} style={tbaBtnStyle}>←</button>
        ) : (
          <div style={{ width: 36 }} />
        )}

        {/* Центр */}
        {logo ? (
          <span style={{
            fontFamily: "'Unbounded',sans-serif",
            fontSize: 15, fontWeight: 800,
            color: 'var(--gold, #F5C842)',
            ...(centered ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } : {}),
          }}>
            ChessCoin
          </span>
        ) : (
          <span style={{
            fontFamily: "'Unbounded',sans-serif",
            fontSize: 15, fontWeight: 800,
            color: 'var(--accent, #F5C842)',
            ...(centered ? { position: 'absolute', left: '50%', transform: 'translateX(-50%)' } : {}),
          }}>
            {title}
          </span>
        )}

        {/* Правая часть */}
        <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>
          {rightAction}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: noScroll ? 'hidden' : 'auto',
        overflowX: 'hidden',
        paddingBottom: noScroll ? 82 : 90,
        scrollbarWidth: 'none',
      }}>
        {children}
      </div>

      <BottomNav />
    </div>
  );
};

const tbaBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 11,
  background: 'var(--bg-input, #1C2030)',
  border: '1px solid var(--border, rgba(255,255,255,0.13))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary, #8B92A8)',
  transition: 'all .18s', fontFamily: 'inherit',
};
