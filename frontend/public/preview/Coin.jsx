// Inline coin. Always paired with a number.
function Coin({ size = 14, style }) {
  return <img src="../../assets/coin.svg" width={size} height={size}
              style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} alt="" />;
}
function Amount({ value, size = 14, glow = true, tone = 'gold' }) {
  const colors = { gold: '#D4A843', green: '#6FEDB0', red: '#EF4444', muted: '#C8C0E0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 900,
      color: colors[tone], fontVariantNumeric: 'tabular-nums',
      textShadow: glow && tone === 'gold' ? '0 0 12px rgba(212,168,67,.35)' : 'none',
    }}>
      {tone === 'gold' && <Coin size={size} />}
      {value}
    </span>
  );
}
Object.assign(window, { Coin, Amount });
