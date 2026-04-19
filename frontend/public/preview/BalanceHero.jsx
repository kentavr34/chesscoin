function BalanceHero({ balance, ton, delta }) {
  return (
    <div style={{
      borderRadius: 20, padding: '18px 20px',
      background: 'radial-gradient(120% 140% at 0% 0%,rgba(212,168,67,.18),rgba(212,168,67,0) 55%),#120E04',
      border: '1px solid rgba(212,168,67,.28)',
      boxShadow: '0 6px 36px rgba(0,0,0,.55),inset 0 0 0 .5px rgba(212,168,67,.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C8C0E0', opacity: .8 }}>Баланс</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <Coin size={32} />
        <div style={{
          fontSize: '2rem', fontWeight: 900, color: '#F0C85A',
          letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums',
          textShadow: '0 0 18px rgba(212,168,67,.4)', lineHeight: 1,
        }}>{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: '.74rem', color: '#7A7875', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span>≈ {ton} TON</span>
        <span style={{ color: 'rgba(255,255,255,.1)' }}>·</span>
        <span style={{ color: '#6FEDB0', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+{delta} сегодня</span>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <PressButton primary style={{ flex: 1 }}>
          <ArrowDownIcon size={14} stroke={2.2} /> Пополнить
        </PressButton>
        <PressButton style={{ flex: 1 }}>
          <ArrowUpIcon size={14} stroke={2.2} /> Вывод
        </PressButton>
      </div>
    </div>
  );
}

function PressButton({ children, primary, style, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  const base = {
    fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer', border: 'none',
    padding: '10px 14px', borderRadius: 10, fontSize: '.82rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'transform .15s cubic-bezier(.34,1.56,.64,1),opacity .15s,box-shadow .15s',
    transform: pressed ? 'scale(.96)' : 'scale(1)',
    opacity: pressed ? .9 : 1,
    ...style,
  };
  const tone = primary ? {
    background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
    color: '#0D0D12',
    boxShadow: pressed ? '0 0 8px rgba(212,168,67,.15)' : '0 0 20px rgba(212,168,67,.35),0 0 48px rgba(212,168,67,.1)',
  } : {
    background: 'rgba(255,255,255,.06)',
    color: '#F4F0E8',
    border: '1px solid rgba(255,255,255,.1)',
  };
  return (
    <button onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
            onClick={onClick}
            style={{ ...base, ...tone }}>
      {children}
    </button>
  );
}

Object.assign(window, { BalanceHero, PressButton });
