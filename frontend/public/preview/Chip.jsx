function Chip({ children, tone = 'gold', dot, onClick }) {
  const tones = {
    gold:   { bg: 'rgba(212,168,67,.12)',  bd: 'rgba(212,168,67,.3)',  fg: '#F0C85A' },
    purple: { bg: 'rgba(155,109,255,.1)',  bd: 'rgba(155,109,255,.3)', fg: '#C4A8FF' },
    green:  { bg: 'rgba(61,186,122,.1)',   bd: 'rgba(61,186,122,.3)',  fg: '#6FEDB0' },
    blue:   { bg: 'rgba(74,158,255,.1)',   bd: 'rgba(74,158,255,.3)',  fg: '#82CFFF' },
    neutral:{ bg: 'rgba(255,255,255,.04)', bd: 'rgba(255,255,255,.08)',fg: '#C8C0E0' },
  };
  const t = tones[tone] || tones.gold;
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: t.bg, border: `1px solid ${t.bd}`, color: t.fg,
      padding: '4px 10px', borderRadius: 9999,
      fontSize: '.7rem', fontWeight: 700, letterSpacing: '.04em',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg, boxShadow: `0 0 6px ${t.fg}` }} />}
      {children}
    </span>
  );
}
Object.assign(window, { Chip });
