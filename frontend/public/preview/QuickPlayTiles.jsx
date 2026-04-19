function QuickPlayTiles({ onPlay }) {
  const tiles = [
    { bet: 50, time: '3+0', label: 'Блиц' },
    { bet: 100, time: '5+0', label: 'Быстрые', hot: true },
    { bet: 250, time: '10+0', label: 'Классика' },
    { bet: 500, time: '15+10', label: 'Премиум' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {tiles.map((t) => (
        <Tile key={t.bet} {...t} onPlay={onPlay} />
      ))}
    </div>
  );
}

function Tile({ bet, time, label, hot, onPlay }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      onClick={() => onPlay && onPlay(bet)}
      style={{
        background: hot
          ? 'linear-gradient(145deg,rgba(212,168,67,.18),rgba(212,168,67,.04) 60%),#141018'
          : '#141018',
        border: hot ? '1px solid rgba(212,168,67,.35)' : '1px solid rgba(255,255,255,.08)',
        borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: 110, cursor: 'pointer',
        transform: pressed ? 'scale(.97)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
        position: 'relative',
      }}>
      {hot && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: '.48rem', fontWeight: 800, letterSpacing: '.14em',
          color: '#F0C85A', textTransform: 'uppercase',
        }}>HOT</div>
      )}
      <div>
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <ClockIcon size={13} style={{ color: '#7A7875' }} />
          <span style={{ fontSize: '.76rem', color: '#C8C0E0', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Coin size={18} />
        <span style={{
          fontSize: '1.1rem', fontWeight: 900, color: hot ? '#F0C85A' : '#F4F0E8',
          letterSpacing: '-.01em', fontVariantNumeric: 'tabular-nums',
          textShadow: hot ? '0 0 12px rgba(212,168,67,.4)' : 'none',
        }}>{bet}</span>
      </div>
    </div>
  );
}

Object.assign(window, { QuickPlayTiles });
