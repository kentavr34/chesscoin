import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { BattleCard } from '@/components/ui/BattleCard';
import { warsApi } from '@/api';
import { fmtBalance } from '@/utils/format';
import { useT } from '@/i18n/useT';

const toast = (text: string, type: 'error' | 'success' | 'info' = 'error') =>
  window.dispatchEvent(new CustomEvent('chesscoin:toast', { detail: { text, type } }));

// DECLARE WAR MODAL
// ─────────────────────────────────────────────────────────────────────────────
const DURATIONS = [
  { label: '1 час', value: 3600 },
  { label: '12 часов', value: 43200 },
  { label: '24 часа', value: 86400 },
  { label: '7 дней', value: 604800 },
];

export const DeclareWarModal: React.FC<{
  myCountryId: string;
  onClose: () => void;
  onDeclared: () => void;
}> = ({ myCountryId, onClose, onDeclared }) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [duration, setDuration] = useState(86400);
  const [loading, setLoading] = useState(false);
  const t = useT();

  useEffect(() => {
    warsApi.countries('alpha').then(r => setCountries(r.countries.filter((c: Record<string,unknown>) => c.id !== myCountryId)));
  }, [myCountryId]);

  const filtered = countries.filter(c =>
    c.nameRu.toLowerCase().includes(search.toLowerCase()) ||
    c.nameEn.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeclare = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await warsApi.declare(selected, duration);
      toast(t.wars.warDeclared, 'success');
      onDeclared();
      onClose();
    } catch (e: unknown) {
      toast(e.message ?? t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={handleBar} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent, #F5C842)' }}>⚔️ Объявить войну</div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <input
          placeholder={t.wars.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />

        <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, marginBottom: 4, cursor: 'pointer',
                background: selected === c.id ? 'rgba(245,200,66,0.12)' : 'var(--bg-card, #1C2030)',
                border: `1px solid ${selected === c.id ? 'rgba(245,200,66,0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <span style={{ fontSize: 22 }}>{c.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F2F8)' }}>{c.nameRu}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary, #8B92A8)' }}>Бойцов: {c.memberCount} • Побед: {c.wins}</div>
              </div>
              {selected === c.id && <span style={{ color: 'var(--accent, #F5C842)', fontSize: 16 }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B92A8)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Длительность
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {DURATIONS.map(d => (
            <button key={d.value} onClick={() => setDuration(d.value)} style={chipBtn(duration === d.value)}>
              {d.label}
            </button>
          ))}
        </div>

        <button onClick={handleDeclare} disabled={!selected || loading} style={{ ...goldBtnFull, opacity: !selected || loading ? 0.5 : 1 }}>
          {loading ? t.wars.declareModal.declaring : t.wars.declareModal.btn}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
