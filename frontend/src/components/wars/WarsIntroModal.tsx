import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { BattleCard } from '@/components/ui/BattleCard';
import { warsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

const toast = (text: string, type: 'error' | 'success' | 'info' = 'error') =>
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));

// ─────────────────────────────────────────────────────────────────────────────
// WARSINTROMODAL
// ─────────────────────────────────────────────────────────────────────────────
export const WarsIntroModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div style={{ ...modalStyle, padding: 24, maxWidth: 420, margin: 'auto', borderRadius: 24, bottom: 'auto', top: '10%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontFamily: "'Unbounded',sans-serif", fontWeight: 800, color: 'var(--accent, #F5C842)' }}>⚔️ Войны</div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary, #C8CDDF)', lineHeight: 1.7 }}>
        <p style={{ marginBottom: 10 }}>
          🌍 <b>Войны между странами</b> — вступи в любую страну и сражайся за её сборную!
        </p>
        <p style={{ marginBottom: 10 }}>
          👑 <b>Главнокомандующий</b> — боец с наибольшим числом побед. Только он может объявить войну другой стране.
        </p>
        <p style={{ marginBottom: 10 }}>
          ⚔️ <b>Во время войны</b> — вызывай бойцов противника на дуэль бесплатно. Каждая победа пополняет казну страны!
        </p>
        <p style={{ marginBottom: 10 }}>
          🏆 <b>Победившая страна</b> получает призовой фонд, а её бойцы поднимаются в рейтинге.
        </p>
        <p>
          🔄 <b>Трансферы разрешены</b> — можно сражаться за любимую страну, не только за родную!
        </p>
      </div>
      <button onClick={onClose} style={{ ...goldBtnFull, marginTop: 20 }}>
        Понятно, поехали! ⚔️
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
