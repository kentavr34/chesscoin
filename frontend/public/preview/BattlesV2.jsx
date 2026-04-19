// BattlesV2 — public chess battles list with tabs, live + waiting sections,
// empty state, FAB, and Create Battle bottom sheet.
//
// Parent App mounts this without ScreenWrap so we control the header + tabs.

function BattlesV2() {
  const [tab, setTab]           = React.useState('public'); // public | private | challenges
  const [mode, setMode]         = React.useState('list');   // list | empty
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <BattlesHeader tab={tab} onTab={setTab} />
      <BattlesStateSwitcher mode={mode} onMode={setMode} onOpen={() => setModalOpen(true)} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '2px .85rem 100px' }} className="cc-scroll">
        {mode === 'list' ? <BattlesList /> : <BattlesEmpty onCreate={() => setModalOpen(true)} />}
      </div>

      <BattleFab onClick={() => setModalOpen(true)} />
      {modalOpen && <CreateBattleModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ── Header + tabs + meta strip ──────────────────────────────────────────────
function BattlesHeader({ tab, onTab }) {
  const tabs = [
    { id: 'public',     label: 'Публичные' },
    { id: 'private',    label: 'Приватные' },
    { id: 'challenges', label: 'Вызовы', badge: 3 },
  ];
  return (
    <div style={{
      flexShrink: 0, padding: '10px .85rem 8px',
      background: 'linear-gradient(180deg,#0D0D12,#0B0B10)',
      borderBottom: '1px solid rgba(255,255,255,.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em' }}>Батлы</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconSlot><SearchIcon size={18} /></IconSlot>
          <IconSlot><DotsIcon size={18} /></IconSlot>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 3, padding: 3,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 10,
      }}>
        {tabs.map((t) => (
          <div key={t.id} onClick={() => onTab(t.id)} style={{
            flex: 1, position: 'relative',
            textAlign: 'center', padding: '7px 0', borderRadius: 8,
            fontSize: '.76rem', fontWeight: 800, letterSpacing: '.02em', cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
            color: tab === t.id ? '#0D0D12' : '#7A7875',
            transition: 'background .2s, color .2s',
          }}>
            {t.label}
            {t.badge && (
              <span style={{
                position: 'absolute', top: 3, right: 10,
                minWidth: 15, height: 15, padding: '0 4px',
                borderRadius: 9999, background: '#EF4444',
                fontSize: '.56rem', fontWeight: 900, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 0 2px #141018',
              }}>{t.badge}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between',
        fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875',
      }}>
        <span>Твой ELO · <span style={{ color: '#C4A8FF' }}>1820</span></span>
        <span>Баланс · <span style={{ color: '#F0C85A' }}><Coin size={10} /> 12.5K</span></span>
      </div>
    </div>
  );
}

function BattlesStateSwitcher({ mode, onMode, onOpen }) {
  return (
    <div style={{
      padding: '8px .85rem 0', display: 'flex', gap: 4,
      flexShrink: 0,
    }}>
      {[
        { id: 'list',  label: 'Заполнен' },
        { id: 'empty', label: 'Пустой' },
        { id: 'modal', label: 'Модалка' },
      ].map((o) => {
        const active = mode === o.id || (o.id === 'modal' && false);
        return (
          <div key={o.id} onClick={() => o.id === 'modal' ? onOpen() : onMode(o.id)} style={{
            flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 8,
            fontSize: '.58rem', fontWeight: 800, letterSpacing: '.06em', cursor: 'pointer',
            background: active ? 'rgba(212,168,67,.1)' : 'rgba(255,255,255,.03)',
            border: active ? '1px solid rgba(212,168,67,.3)' : '1px solid rgba(255,255,255,.06)',
            color: active ? '#F0C85A' : '#7A7875',
          }}>{o.label}</div>
        );
      })}
    </div>
  );
}

// ── Filled list ────────────────────────────────────────────────────────────
function BattlesList() {
  const liveMatches = [
    {
      white: { name: 'GrandMaster_21', elo: 2105, initials: 'GM', tone: 'purple' },
      black: { name: 'QueenSlayer',    elo: 1980, initials: 'QS', tone: 'green' },
      stake: 1000, timer: '03:42',
    },
    {
      white: { name: 'Sokolov',        elo: 1870, initials: 'СВ', tone: 'gold' },
      black: { name: 'NightKnight',    elo: 1910, initials: 'NK', tone: 'purple' },
      stake: 500, timer: '01:18',
    },
  ];

  const waiting = [
    { name: 'Magnus_27',     elo: 2340, initials: 'М',  tone: 'purple', time: 5,  stake: 500,   color: 'white'  },
    { name: 'BlitzKing_99',  elo: 1650, initials: 'BK', tone: 'gold',   time: 3,  stake: 100,   color: 'any'    },
    { name: 'SilentRook',    elo: 1920, initials: 'SR', tone: 'purple', time: 15, stake: 1000,  color: 'black'  },
    { name: 'IceCastle',     elo: 2010, initials: 'IC', tone: 'green',  time: 10, stake: 5000,  color: 'white'  },
    { name: 'PawnStar',      elo: 1480, initials: 'PS', tone: 'gold',   time: 1,  stake: 50,    color: 'any'    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
      <Section label="Сейчас играют" count={liveMatches.length} dotColor="#3DBA7A" dotPulse>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liveMatches.map((m, i) => <LiveCard key={i} {...m} />)}
        </div>
      </Section>

      <Section label="Ожидают соперника" count={waiting.length}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {waiting.map((w, i) => <WaitingCard key={i} {...w} />)}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, count, dotColor, dotPulse, children }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '.58rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#7A7875', padding: '0 2px 8px',
      }}>
        {dotColor && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            animation: dotPulse ? 'ccTurnPulse 1.1s ease-in-out infinite' : 'none',
          }} />
        )}
        <span>{label}</span>
        <span style={{
          color: '#5A5855', background: 'rgba(255,255,255,.04)',
          padding: '1px 6px', borderRadius: 6, fontSize: '.58rem', letterSpacing: '.08em',
        }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Live card: white | VS / stake / timer | black ──────────────────────────
function LiveCard({ white, black, stake, timer }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        padding: '10px 10px',
        background: 'radial-gradient(120% 100% at 50% 0%,rgba(61,186,122,.1),rgba(61,186,122,0) 50%),#141018',
        border: '1px solid rgba(61,186,122,.35)',
        boxShadow: '0 0 22px rgba(61,186,122,.14)',
        borderRadius: 14,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
        transform: pressed ? 'scale(.99)' : 'scale(1)',
        transition: 'transform .15s',
      }}>
      <LivePlayer {...white} align="left" />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '0 4px', minWidth: 78,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 7px', borderRadius: 9999,
          background: '#EF4444', color: '#fff',
          fontSize: '.52rem', fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'ccTurnPulse .9s ease-in-out infinite' }} />
          Live
        </span>
        <span style={{
          fontFamily: 'ui-monospace,SF Mono,monospace', fontSize: '.92rem', fontWeight: 900,
          color: '#EAE2CC', fontVariantNumeric: 'tabular-nums',
        }}>{timer}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '.74rem', fontWeight: 900, color: '#F0C85A' }}>
          <Coin size={12} /> {stake}
        </span>
      </div>
      <LivePlayer {...black} align="right" />
    </div>
  );
}

function LivePlayer({ name, elo, initials, tone, align }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: align === 'right' ? 'row-reverse' : 'row', minWidth: 0 }}>
      <Avatar initials={initials} tone={tone} size={32} />
      <div style={{ minWidth: 0, textAlign: align }}>
        <div style={{ fontSize: '.74rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: '.58rem', color: '#7A7875', fontWeight: 700, letterSpacing: '.04em' }}>ELO {elo}</div>
      </div>
    </div>
  );
}

// ── Waiting card: gold-bordered challenge ──────────────────────────────────
function WaitingCard({ name, elo, initials, tone, time, stake, color }) {
  const KingGlyph = color === 'white' ? '♔' : (color === 'black' ? '♚' : '⚂');
  const colorTitle = color === 'white' ? 'Белые' : (color === 'black' ? 'Чёрные' : 'Случайно');
  return (
    <div style={{
      padding: 10,
      background: 'radial-gradient(120% 80% at 100% 0%,rgba(212,168,67,.1),rgba(212,168,67,0) 55%),#141018',
      border: '1px solid rgba(212,168,67,.28)',
      borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Avatar initials={initials} tone={tone} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: '.62rem', color: '#7A7875', fontWeight: 700, marginTop: 1, letterSpacing: '.04em' }}>ELO {elo}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: '.72rem' }}>
          <span style={{ color: '#C8C0E0', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <ClockIcon size={11} stroke={2.2} /> {time} мин
          </span>
          <span style={{ color: 'rgba(255,255,255,.1)' }}>·</span>
          <span style={{ color: '#F0C85A', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800 }}>
            <Coin size={12} /> {stake}
          </span>
          <span style={{ color: 'rgba(255,255,255,.1)' }}>·</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, color: '#7A7875', fontWeight: 700,
          }} title={colorTitle}>
            <span style={{ fontSize: '.9rem', lineHeight: 1, color: color === 'black' ? '#5A5855' : '#EAE2CC' }}>{KingGlyph}</span>
          </span>
        </div>
      </div>
      <EnterButton />
    </div>
  );
}

function EnterButton() {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        fontFamily: 'inherit', fontWeight: 900, fontSize: '.7rem', letterSpacing: '.08em', textTransform: 'uppercase',
        padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
        background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
        color: '#0D0D12', border: '1px solid rgba(212,168,67,.5)',
        boxShadow: pressed ? '0 0 10px rgba(212,168,67,.35)' : '0 2px 10px rgba(212,168,67,.4)',
        transform: pressed ? 'scale(.96)' : 'scale(1)',
        transition: 'transform .15s, box-shadow .15s',
      }}>Войти</button>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function BattlesEmpty({ onCreate }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      padding: '50px 20px 30px', textAlign: 'center',
    }}>
      <EmptyIllustration />
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.02em' }}>
        Пока нет открытых батлов
      </div>
      <div style={{ fontSize: '.82rem', color: '#7A7875', lineHeight: 1.45, maxWidth: 260 }}>
        Создай первый и другие игроки смогут присоединиться к твоему вызову
      </div>
      <button
        onClick={onCreate}
        style={{
          marginTop: 4, fontFamily: 'inherit',
          fontWeight: 900, fontSize: '.82rem', letterSpacing: '.06em',
          padding: '12px 24px', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
          color: '#0D0D12', border: '1px solid rgba(212,168,67,.5)',
          boxShadow: '0 6px 20px rgba(212,168,67,.4)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        <PlusIcon size={14} stroke={2.6} /> Создать первый
      </button>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="150" height="120" viewBox="0 0 150 120" fill="none">
      <defs>
        <radialGradient id="emBg" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#D4A843" stopOpacity=".22" />
          <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="emGold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F0C85A" />
          <stop offset="100%" stopColor="#A07830" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="150" height="120" fill="url(#emBg)" />
      {/* Board */}
      <g transform="translate(35,30)">
        {Array.from({ length: 16 }).map((_, i) => {
          const r = Math.floor(i / 4), c = i % 4;
          const light = (r + c) % 2 === 0;
          return <rect key={i} x={c*20} y={r*20} width={20} height={20}
            fill={light ? '#DEB887' : '#8B4513'} opacity=".55" />;
        })}
        <rect x="0" y="0" width="80" height="80" fill="none" stroke="url(#emGold)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".5" rx="4" />
      </g>
      {/* Question-mark crown */}
      <g transform="translate(67,48)">
        <circle cx="8" cy="8" r="22" fill="#141018" stroke="url(#emGold)" strokeWidth="1.5" />
        <text x="8" y="15" textAnchor="middle" fontSize="22" fontWeight="900" fill="url(#emGold)" fontFamily="Inter, sans-serif">?</text>
      </g>
    </svg>
  );
}

// ── FAB ────────────────────────────────────────────────────────────────────
function BattleFab({ onClick }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        position: 'absolute', bottom: 76, right: 16, zIndex: 20,
        width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'radial-gradient(120% 100% at 50% 0%,#F7D974,#D4A843 55%,#A07830)',
        boxShadow: pressed
          ? '0 2px 8px rgba(212,168,67,.4),inset 0 0 12px rgba(255,255,255,.25)'
          : '0 6px 20px rgba(212,168,67,.4),inset 0 1px 0 rgba(255,255,255,.25)',
        transform: pressed ? 'scale(.94)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1), box-shadow .15s',
        color: '#0D0D12',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <PlusIcon size={26} stroke={2.8} />
    </button>
  );
}

// ── Create Battle modal ────────────────────────────────────────────────────
function CreateBattleModal({ onClose }) {
  const [stake, setStake]   = React.useState(500);
  const [time, setTime]     = React.useState(5);
  const [color, setColor]   = React.useState('any');
  const [isPrivate, setP]   = React.useState(false);

  const stakes = [50, 100, 500, 1000, 5000, 10000];
  const times  = [1, 3, 5, 15, 30, 60];

  return (
    <Backdrop align="bottom" onClose={onClose}>
      <div style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderTop: '2px solid rgba(212,168,67,.35)',
        borderRadius: '20px 20px 0 0',
        padding: '16px 16px 20px',
        maxHeight: '92%',
        display: 'flex', flexDirection: 'column',
        animation: 'ccSlideUp .3s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ width: 38, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '0 auto 14px', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.02em' }}>Новый батл</div>
          <div onClick={onClose} style={{
            width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,.05)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7A7875',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: '#7A7875', marginBottom: 14 }}>
          Настрой ставку, контроль времени и цвет
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 14 }} className="cc-scroll">
          <Field label="Ставка" right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#F0C85A', fontWeight: 900 }}><Coin size={12} /> {stake}</span>}>
            <PillRow options={stakes} value={stake} onChange={setStake} renderOpt={(n) => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Coin size={10} /> {formatCompact(n)}
              </span>
            )} />
          </Field>

          <Field label="Время" right={<span style={{ color: '#C8C0E0', fontWeight: 700 }}>{time} мин</span>}>
            <PillRow options={times} value={time} onChange={setTime} renderOpt={(n) => `${n}`} />
          </Field>

          <Field label="Цвет">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <ColorPick active={color === 'any'}   onClick={() => setColor('any')}   icon={<DiceIcon />}         label="Случайно" />
              <ColorPick active={color === 'white'} onClick={() => setColor('white')} icon={<KingGlyph color="white" />} label="Белые" />
              <ColorPick active={color === 'black'} onClick={() => setColor('black')} icon={<KingGlyph color="black" />} label="Чёрные" />
            </div>
          </Field>

          <PrivateRow value={isPrivate} onChange={setP} />
        </div>

        <div style={{ marginTop: 14, flexShrink: 0 }}>
          <ShimmerCTA onClick={onClose} stake={stake} />
        </div>
      </div>
    </Backdrop>
  );
}

function Field({ label, right, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>{label}</span>
        {right && <span style={{ fontSize: '.78rem' }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function PillRow({ options, value, onChange, renderOpt }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5,
      padding: 3, background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.06)', borderRadius: 10,
    }}>
      {options.map((o) => (
        <div key={o} onClick={() => onChange(o)} style={{
          padding: '7px 2px', borderRadius: 7, textAlign: 'center', cursor: 'pointer',
          fontSize: '.72rem', fontWeight: 800,
          background: value === o ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: value === o ? '#0D0D12' : '#C8C0E0',
          boxShadow: value === o ? '0 2px 8px rgba(212,168,67,.3)' : 'none',
          transition: 'background .15s, color .15s',
        }}>{renderOpt(o)}</div>
      ))}
    </div>
  );
}

function ColorPick({ active, onClick, icon, label }) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 4px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
      background: active ? 'radial-gradient(120% 100% at 50% 0%,rgba(212,168,67,.18),rgba(212,168,67,0) 60%),#1A1620' : 'rgba(255,255,255,.03)',
      border: active ? '1px solid rgba(212,168,67,.5)' : '1px solid rgba(255,255,255,.06)',
      boxShadow: active ? '0 0 14px rgba(212,168,67,.2)' : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      transition: 'all .15s',
    }}>
      <div style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: '.66rem', fontWeight: 800, color: active ? '#F0C85A' : '#C8C0E0', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}

function KingGlyph({ color }) {
  return (
    <span style={{
      fontSize: '1.6rem', lineHeight: 1,
      color: color === 'white' ? '#F4F0E8' : '#2A1F10',
      textShadow: color === 'white' ? '0 1px 0 #0D0D12' : '0 0 1px #7A6038',
      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))',
    }}>{color === 'white' ? '♔' : '♚'}</span>
  );
}

function DiceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F0C85A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3.5"/>
      <circle cx="8" cy="8" r="1.3" fill="#F0C85A"/>
      <circle cx="12" cy="12" r="1.3" fill="#F0C85A"/>
      <circle cx="16" cy="16" r="1.3" fill="#F0C85A"/>
    </svg>
  );
}

function PrivateRow({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 12px', borderRadius: 12,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: value ? 'rgba(212,168,67,.15)' : 'rgba(255,255,255,.05)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: value ? '#F0C85A' : '#7A7875', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#F4F0E8' }}>Приватный батл</div>
        <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>
          {value ? 'Ссылка готова · t.me/cc/b/a7k2' : 'Играть только по ссылке'}
        </div>
      </div>
      <Switch value={value} onChange={onChange} />
    </div>
  );
}

function Switch({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 40, height: 24, borderRadius: 9999, padding: 2, cursor: 'pointer',
      background: value ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'rgba(255,255,255,.08)',
      transition: 'background .2s',
      display: 'flex', alignItems: 'center',
      justifyContent: value ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: value ? '#0D0D12' : '#F4F0E8',
        boxShadow: '0 1px 3px rgba(0,0,0,.4)',
        transition: 'transform .2s',
      }} />
    </div>
  );
}

function ShimmerCTA({ onClick, stake }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        width: '100%', fontFamily: 'inherit',
        fontWeight: 900, fontSize: '.92rem', letterSpacing: '.04em',
        padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
        background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
        color: '#0D0D12', border: '1px solid rgba(212,168,67,.6)',
        boxShadow: '0 8px 26px rgba(212,168,67,.45)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
      <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Создать батл за <Coin size={16} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{stake}</span>
      </span>
      <span style={{
        position: 'absolute', top: 0, left: '-60%', width: '40%', height: '100%',
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)',
        transform: 'skewX(-24deg)',
        animation: 'ccShimmer 2.2s ease-in-out infinite',
      }} />
    </button>
  );
}

// ── Helpers (Backdrop is imported from GameScreenV2 into window) ───────────
function formatCompact(n) {
  if (n >= 1000) return (n / 1000) + 'K';
  return n;
}

Object.assign(window, { BattlesV2 });
