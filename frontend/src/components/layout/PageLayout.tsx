import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  logo?: boolean;
  backTo?: string;
  rightAction?: React.ReactNode;
  noScroll?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  logo,
  backTo,
  rightAction,
  noScroll,
}) => {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#0B0D11', overflow: 'hidden',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px 8px',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        flexShrink: 0,
      }}>
        {backTo ? (
          <button onClick={() => navigate(backTo)} style={tbaBtnStyle}>←</button>
        ) : (
          <div style={{ width: 36 }} />
        )}
        {logo ? (
          <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 15, fontWeight: 800, color: '#F5C842' }}>
            ChessCoin
          </span>
        ) : (
          <span style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 13, fontWeight: 700, color: '#F0F2F8' }}>
            {title}
          </span>
        )}
        <div style={{ minWidth: 36 }}>
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
  width: 36, height: 36,
  borderRadius: 11,
  background: '#1C2030',
  border: '1px solid rgba(255,255,255,0.13)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 18, cursor: 'pointer', color: '#8B92A8',
  transition: 'all .18s',
  fontFamily: 'inherit',
};
