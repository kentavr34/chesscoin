function ListRow({ avatar, name, sub, right, onClick, last }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: pressed ? 'rgba(255,255,255,.03)' : '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 16, cursor: onClick ? 'pointer' : 'default',
        marginBottom: last ? 0 : 8,
        transition: 'background .12s',
      }}>
      {avatar}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub && <div style={{ fontSize: '.7rem', color: '#7A7875', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Avatar({ initials, tone = 'gold', size = 38, online }) {
  const bgs = {
    gold:   'linear-gradient(135deg,#F0C85A,#A07830)',
    purple: 'linear-gradient(135deg,#9B6DFF,#4A9EFF)',
    green:  'linear-gradient(135deg,#3DBA7A,#1f6d47)',
    neutral:'linear-gradient(135deg,#2a2530,#1a1520)',
  };
  const ring = tone === 'gold' ? '0 0 0 2px rgba(212,168,67,.4)' : '0 0 0 1px rgba(255,255,255,.08)';
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bgs[tone], boxShadow: ring,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 800,
        color: tone === 'gold' ? '#0D0D12' : '#F4F0E8',
      }}>{initials}</div>
      {online && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: '50%',
          background: '#3DBA7A', border: '2px solid #0D0D12',
          boxShadow: '0 0 6px #3DBA7A',
        }} />
      )}
    </div>
  );
}

Object.assign(window, { ListRow, Avatar });
