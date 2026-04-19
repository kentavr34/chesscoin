// The 2×2 mode tiles: J.A.R.V.I.S, Батлы, Кубки, Войны.
// Variant: 'classic' = big tiles with progress bar; 'card' = compact; 'minimal' = row list.
const MODES = [
  {
    id: 'jarvis', label: 'J.A.R.V.I.S', sub: 'Игра с AI',
    tone: 'blue', cta: 'Открыть',
    accent: '#4A9EFF', accent2: '#82CFFF',
    progressLabel: 'Гроссмейстер', progress: 0.68,
    Icon: (p) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="22" cy="22" r="18"/>
        <circle cx="22" cy="22" r="9"/>
        <circle cx="22" cy="22" r="3" fill="currentColor"/>
        <path d="M22 4v6M22 34v6M4 22h6M34 22h6"/>
      </svg>
    ),
  },
  {
    id: 'battles', label: 'Батлы', sub: 'Ставки 1 на 1',
    tone: 'gold', cta: 'В бой',
    accent: '#D4A843', accent2: '#F0C85A',
    progressLabel: '7 побед подряд', progress: 0.82,
    Icon: (p) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m14 6 18 18-4 4-18-18zM6 30l8 8M30 14l8-8M30 14l4 4M10 34l4 4"/>
        <path d="m30 28 8 8-4 4-8-8z"/>
      </svg>
    ),
  },
  {
    id: 'cups', label: 'Кубки', sub: 'Турниры',
    tone: 'purple', cta: 'Участвовать',
    accent: '#9B6DFF', accent2: '#C4A8FF',
    progressLabel: '3 активных', progress: 0.45,
    Icon: (p) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 8h16v8a8 8 0 0 1-16 0zM10 8H6v4a4 4 0 0 0 4 4M34 8h4v4a4 4 0 0 1-4 4M17 32h10M22 24v8M15 40h14"/>
      </svg>
    ),
  },
  {
    id: 'wars', label: 'Войны', sub: 'Страны',
    tone: 'green', cta: 'За Россию',
    accent: '#3DBA7A', accent2: '#6FEDB0',
    progressLabel: 'Россия · 2 место', progress: 0.64,
    Icon: (p) => (
      <svg width={p.size} height={p.size} viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 40V6M8 8h20l-3 5 3 5H8"/>
        <circle cx="36" cy="20" r="2" fill="currentColor"/>
      </svg>
    ),
  },
];

function ModeTiles({ variant = 'classic', onPick }) {
  if (variant === 'minimal') return <ModeList onPick={onPick} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {MODES.map((m) => (
        variant === 'card'
          ? <ModeTileCard key={m.id} mode={m} onPick={onPick} />
          : <ModeTileClassic key={m.id} mode={m} onPick={onPick} />
      ))}
    </div>
  );
}

// Classic: icon, label, progress bar, mini-CTA
function ModeTileClassic({ mode, onPick }) {
  const [pressed, setPressed] = React.useState(false);
  const m = mode;
  return (
    <div
      onClick={() => onPick && onPick(m.id)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(155deg,rgba(${hexToRgb(m.accent)},.12),rgba(${hexToRgb(m.accent)},0) 60%),#141018`,
        border: `1px solid rgba(${hexToRgb(m.accent)},.28)`,
        borderRadius: 18, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 150, cursor: 'pointer',
        transform: pressed ? 'scale(.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <div style={{
        color: m.accent2,
        filter: `drop-shadow(0 0 12px rgba(${hexToRgb(m.accent)},.5))`,
        alignSelf: 'center', marginTop: 2,
      }}>
        <m.Icon size={44} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '.85rem', fontWeight: 800, color: '#F4F0E8', letterSpacing: '.01em' }}>{m.label}</div>
        <div style={{ fontSize: '.62rem', color: '#7A7875', marginTop: 2 }}>{m.sub}</div>
      </div>
      <div>
        <div style={{ height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
          <div style={{
            width: `${m.progress * 100}%`, height: '100%',
            background: `linear-gradient(90deg,${m.accent},${m.accent2})`,
            boxShadow: `0 0 8px ${m.accent}`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: '.55rem', color: '#7A7875', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{m.progressLabel}</span>
          <span style={{ fontSize: '.58rem', fontWeight: 800, color: m.accent2, letterSpacing: '.1em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {m.cta} <ChevRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
}

// Card: icon + label only, progress becomes a chip
function ModeTileCard({ mode, onPick }) {
  const m = mode;
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onClick={() => onPick && onPick(m.id)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: 'pointer',
        transform: pressed ? 'scale(.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <div style={{
        color: m.accent2,
        filter: `drop-shadow(0 0 10px rgba(${hexToRgb(m.accent)},.4))`,
      }}>
        <m.Icon size={34} />
      </div>
      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#F4F0E8', marginTop: 4 }}>{m.label}</div>
      <div style={{ fontSize: '.62rem', color: '#7A7875' }}>{m.progressLabel}</div>
    </div>
  );
}

// Minimal: row list
function ModeList({ onPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {MODES.map((m) => (
        <div key={m.id} onClick={() => onPick && onPick(m.id)} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 2px',
          borderBottom: '1px solid rgba(255,255,255,.05)',
          cursor: 'pointer',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `rgba(${hexToRgb(m.accent)},.1)`,
            border: `1px solid rgba(${hexToRgb(m.accent)},.25)`,
            color: m.accent2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <m.Icon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{m.label}</div>
            <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>{m.progressLabel}</div>
          </div>
          <ChevRight size={14} style={{ color: '#7A7875' }} />
        </div>
      ))}
    </div>
  );
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#',''), 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

Object.assign(window, { ModeTiles, MODES, hexToRgb });
