function PlayerBar({ name, elo, initials, tone, time, capturedCount = 0, active, dir = 'top' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#141018',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 14,
    }}>
      <Avatar initials={initials} tone={tone} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#F4F0E8' }}>{name}</div>
        <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>
          ELO {elo}{capturedCount > 0 && ` · +${capturedCount}`}
        </div>
      </div>
      <div style={{
        padding: '8px 12px', borderRadius: 10,
        background: active ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'rgba(255,255,255,.05)',
        border: active ? 'none' : '1px solid rgba(255,255,255,.08)',
        color: active ? '#0D0D12' : '#F4F0E8',
        fontSize: '1rem', fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        minWidth: 72, textAlign: 'center',
        boxShadow: active ? '0 0 18px rgba(212,168,67,.35)' : 'none',
      }}>{time}</div>
    </div>
  );
}
Object.assign(window, { PlayerBar });
