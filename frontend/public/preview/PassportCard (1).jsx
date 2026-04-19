// PassportCard — user identity card on Home.
// Three variants: classic (big, gradient bg with texture), card (compact), minimal (flat row).
function PassportCard({ variant = 'classic', user, onTopup }) {
  const { name, elo, rank, jarvisRank, balance, avatar } = user;
  if (variant === 'minimal') return <PassportMinimal user={user} onTopup={onTopup} />;
  if (variant === 'card')    return <PassportCompact user={user} onTopup={onTopup} />;
  return <PassportClassic user={user} onTopup={onTopup} />;
}

// ── Classic: big passport with chessboard texture + gold radial ─────────────
function PassportClassic({ user, onTopup }) {
  const { name, elo, rank, jarvisRank, balance } = user;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 20, padding: '18px 18px 16px',
      background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.18),rgba(212,168,67,0) 55%),linear-gradient(180deg,#120E04 0%,#0E0E14 100%)',
      border: '1px solid rgba(212,168,67,.28)',
      boxShadow: '0 6px 36px rgba(0,0,0,.55),inset 0 0 0 .5px rgba(212,168,67,.06)',
    }}>
      {/* chessboard texture @ 2% */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(45deg,#fff 25%,transparent 25%),linear-gradient(-45deg,#fff 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#fff 75%),linear-gradient(-45deg,transparent 75%,#fff 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        opacity: .02, pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <PassportAvatar size={72} initials={user.initials} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '1.08rem', fontWeight: 700, color: '#F4F0E8',
            letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: '.66rem', color: '#7A7875', letterSpacing: '.1em', fontWeight: 700, textTransform: 'uppercase' }}>ELO</span>
            <span style={{ fontSize: '.95rem', fontWeight: 900, color: '#D4A843', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 10px rgba(212,168,67,.35)' }}>{elo}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip tone="gold">Звание · {rank}</Chip>
            <Chip tone="blue">J.A.R.V.I.S · {jarvisRank}</Chip>
          </div>
        </div>
      </div>
      <div style={{
        position: 'relative', marginTop: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        background: 'rgba(0,0,0,.35)',
        border: '1px solid rgba(212,168,67,.15)',
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontSize: '.52rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>Баланс</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Coin size={20} />
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F0C85A', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 14px rgba(212,168,67,.35)' }}>
              {formatK(balance)}
            </span>
          </div>
        </div>
        <div onClick={onTopup} style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
          color: '#0D0D12', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(212,168,67,.35)', cursor: 'pointer',
        }}><PlusIcon size={18} stroke={2.5} /></div>
      </div>
    </div>
  );
}

// ── Card: compact rectangle, no texture ────────────────────────────────────
function PassportCompact({ user, onTopup }) {
  return (
    <div style={{
      borderRadius: 18, padding: 14,
      background: '#141018', border: '1px solid rgba(212,168,67,.22)',
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <PassportAvatar size={58} initials={user.initials} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: '.78rem', fontWeight: 900, color: '#D4A843', fontVariantNumeric: 'tabular-nums' }}>ELO {user.elo}</span>
          <span style={{ color: 'rgba(255,255,255,.1)' }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums' }}>
            <Coin size={14} />{formatK(user.balance)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
          <Chip tone="gold">{user.rank}</Chip>
          <Chip tone="blue">{user.jarvisRank}</Chip>
        </div>
      </div>
      <div onClick={onTopup} style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
        color: '#0D0D12', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 14px rgba(212,168,67,.3)', cursor: 'pointer', flexShrink: 0,
      }}><PlusIcon size={17} stroke={2.5} /></div>
    </div>
  );
}

// ── Minimal: flat row, heavy on typography ─────────────────────────────────
function PassportMinimal({ user, onTopup }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 2px' }}>
      <PassportAvatar size={48} initials={user.initials} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.95rem', fontWeight: 700, color: '#F4F0E8' }}>{user.name}</div>
        <div style={{ fontSize: '.62rem', color: '#7A7875', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
          {user.rank} · ELO {user.elo}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Coin size={18} />
          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(212,168,67,.3)' }}>
            {formatK(user.balance)}
          </span>
        </div>
        <div onClick={onTopup} style={{
          fontSize: '.6rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: '#D4A843', cursor: 'pointer', marginTop: 2,
        }}>+ Пополнить</div>
      </div>
    </div>
  );
}

// Passport avatar with conic-gradient gold ring.
function PassportAvatar({ size = 72, initials }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      padding: 3,
      background: 'conic-gradient(from 220deg,#F0C85A,#A07830,#F0C85A,#D4A843,#FCE49A,#F0C85A)',
      flexShrink: 0, boxShadow: '0 0 18px rgba(212,168,67,.25)',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%',
        background: '#141018',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 800,
        color: '#F0C85A', letterSpacing: '.02em',
      }}>{initials}</div>
    </div>
  );
}

function formatK(n) {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
}

Object.assign(window, { PassportCard, PassportAvatar, formatK });
