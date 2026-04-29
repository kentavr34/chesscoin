import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useT } from '@/i18n/useT';

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

  // Touch swipe
  const touchStart = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && !isLast) setIdx(i => i + 1);
    else if (dx > 0 && idx > 0) setIdx(i => i - 1);
    else if (dx < 0 && isLast) onClose();
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: "var(--z-modal, 300)",
        background: 'rgba(0,0,0,.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <style>{`@keyframes info-pop{ from{opacity:0;transform:scale(.88)} to{opacity:1;transform:scale(1)} }`}</style>
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%', maxWidth: 340,
          background: 'linear-gradient(160deg,#12151E,#0E111A)',
          border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 28,
          padding: '36px 24px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,.75)',
          animation: 'info-pop .35s cubic-bezier(.2,.9,.3,1.05) both',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', position: 'relative',
          userSelect: 'none',
        }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,.06)',
            border: '.5px solid rgba(255,255,255,.1)',
            color: '#9A9490', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >✕</button>

        {/* Icon в круге */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(245,200,66,.09)',
          border: '1.5px solid rgba(245,200,66,.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, fontSize: 32, lineHeight: 1,
        }}>
          {slide.icon}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '1.18rem', fontWeight: 900,
          color: '#EAE2CC', letterSpacing: '-.02em',
          marginBottom: 10, lineHeight: 1.2,
        }}>
          {slide.title}
        </div>

        {/* Desc — светлее и крупнее */}
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '.84rem', color: '#9A9490',
          lineHeight: 1.65, marginBottom: 24,
          maxWidth: 280,
        }} dangerouslySetInnerHTML={{ __html: slide.desc }} />

        {/* Dots */}
        {slides.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {slides.map((_, i) => (
              <div
                key={i}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                  background: i === idx ? '#F5C842' : 'rgba(255,255,255,.12)',
                  transition: 'all .2s', cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}

        {/* Swipe hint */}
        {slides.length > 1 && (
          <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.2)', marginBottom: 12, letterSpacing: '.06em' }}>
            ← свайп →
          </div>
        )}

        {/* Button */}
        <button
          onClick={() => isLast ? onClose() : setIdx(idx + 1)}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg,#2A1E08,#4A3810)',
            border: '.5px solid rgba(212,168,67,.42)',
            borderRadius: 14,
            color: '#F0C85A',
            fontFamily: 'Inter, sans-serif',
            fontSize: '.9rem', fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 4px 22px rgba(212,168,67,.15)',
          }}
        >
          {isLast ? t.home.letsGo : t.home.next}
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
    return undefined;
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
  leftAction?: React.ReactNode;
  noScroll?: boolean;
  centered?: boolean;  // заголовок по центру
  onBack?: () => void;  // кастомная кнопка назад
  noHeader?: boolean;  // скрыть шапку полностью
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children, title, logo, backTo, rightAction, leftAction, noScroll, centered = true, onBack, noHeader,
}) => {
  const navigate = useNavigate();

  return (
    <div className="no-scrollbar" style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {!noHeader && <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px var(--space-l) 16px',
        paddingTop: 'max(28px, calc(env(safe-area-inset-top, 0px) + 18px))',
        flexShrink: 0,
        position: 'relative', zIndex: 'var(--z-header)',
      }}>
        {/* Левая часть */}
        <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-start', zIndex: 2 }}>
          {backTo || onBack ? (
            <button onClick={() => onBack ? onBack() : navigate(backTo!)} style={tbaBtnStyle}>←</button>
          ) : leftAction ?? null}
        </div>

        {/* Центр */}
        <div style={{
          flex: 1, textAlign: centered ? 'center' : 'left',
          padding: '0 12px', overflow: 'hidden', zIndex: 1,
          ...(centered ? { position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', padding: '0 50px' } : {})
        }}>
          {logo ? (
            <span className="ui-heading-1" style={{ fontSize: 16, color: 'var(--gold)' }}>
              ChessCoin
            </span>
          ) : (
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '1.25rem', fontWeight: 900,
              color: '#EAE2CC',
              whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block',
              letterSpacing: '-.02em',
            }}>
              {title}
            </span>
          )}
        </div>

        {/* Правая часть */}
        <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end', zIndex: 2 }}>
          {rightAction}
        </div>
      </div>}

      <div className="no-scrollbar" style={{
        flex: 1,
        overflowY: noScroll ? 'hidden' : 'auto',
        overflowX: 'hidden',
        paddingBottom: `max(82px, calc(var(--space-l, 16px) * 6 + env(safe-area-inset-bottom, 0px)))`,
        position: 'relative', zIndex: 'var(--z-base)',
      }}>
        {children}
      </div>

      <BottomNav />
    </div>
  );
};

const tbaBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 'var(--radius-m)',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)',
  transition: 'all .2s', outline: 'none',
};
