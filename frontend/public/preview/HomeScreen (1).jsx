// HomeScreen — three composition variants driven by the `variant` prop:
//   'classic' | 'card' | 'minimal'
function HomeScreen({ variant = 'classic', user, onPlay, onTopup }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
      <FadeIn delay={0}>
        <PassportCard variant={variant} user={user} onTopup={onTopup} />
      </FadeIn>

      <FadeIn delay={80}>
        <SectionLabel>Режимы игры</SectionLabel>
        <ModeTiles variant={variant} onPick={onPlay} />
      </FadeIn>

      <FadeIn delay={160}>
        <SectionLabel right={<span style={{ color: '#D4A843', fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em' }}>ВСЕ · 4</span>}>
          Активные партии
        </SectionLabel>
        <ActiveMatches variant={variant} />
      </FadeIn>

      <FadeIn delay={240}>
        <SectionLabel right={<span style={{ color: '#6FEDB0', fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em' }}>1/3</span>}>
          Ежедневные задания
        </SectionLabel>
        <DailyQuests variant={variant} />
      </FadeIn>
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 2px 6px',
    }}>
      <span style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>
        {children}
      </span>
      {right}
    </div>
  );
}

function FadeIn({ children, delay = 0 }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      opacity: shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity .36s ease,transform .36s cubic-bezier(.34,1.56,.64,1)',
    }}>{children}</div>
  );
}

function ActiveMatches({ variant }) {
  const matches = [
    { initials: 'М',  name: 'Magnus_27',   sub: 'ELO 2340 · твой ход', time: '04:32', tone: 'purple', active: true  },
    { initials: 'АК', name: 'AlexKing_42', sub: 'ELO 1820 · ход соперника', time: '00:47', tone: 'gold',    active: false },
    { initials: 'Н',  name: 'Nina_blitz',  sub: 'ELO 1510 · твой ход', time: '09:11', tone: 'green',   active: true  },
  ];
  if (variant === 'minimal') {
    return (
      <div>
        {matches.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 2px',
            borderBottom: i === matches.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
            cursor: 'pointer',
          }}>
            <Avatar initials={m.initials} tone={m.tone} size={32} online={m.active} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: '#F4F0E8' }}>{m.name}</div>
              <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 1 }}>{m.sub}</div>
            </div>
            <div style={{
              fontSize: '.78rem', fontWeight: 900,
              color: m.active ? '#F0C85A' : '#7A7875',
              fontVariantNumeric: 'tabular-nums',
            }}>{m.time}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {matches.map((m, i) => (
        <ListRow key={i}
          avatar={<Avatar initials={m.initials} tone={m.tone} size={36} online={m.active} />}
          name={m.name}
          sub={<span>{m.sub}</span>}
          right={
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 9999,
              background: m.active ? 'rgba(212,168,67,.12)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${m.active ? 'rgba(212,168,67,.3)' : 'rgba(255,255,255,.08)'}`,
              color: m.active ? '#F0C85A' : '#7A7875',
              fontSize: '.72rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
            }}>
              <ClockIcon size={12} stroke={2} /> {m.time}
            </div>
          }
          last={i === matches.length - 1}
        />
      ))}
    </div>
  );
}

function DailyQuests({ variant }) {
  const quests = [
    { label: 'Выиграть 3 партии',     done: 2, total: 3, reward: 150, complete: false },
    { label: 'Сделать 10 шахов',      done: 10, total: 10, reward: 80, complete: true },
    { label: 'Партия vs J.A.R.V.I.S', done: 0, total: 1, reward: 100, complete: false, tone: 'blue' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {quests.map((q, i) => {
        const p = q.done / q.total;
        const tone = q.complete ? '#6FEDB0' : (q.tone === 'blue' ? '#82CFFF' : '#D4A843');
        const bg = q.complete ? '#3DBA7A' : (q.tone === 'blue' ? '#4A9EFF' : '#D4A843');
        return (
          <div key={i} style={{
            padding: '12px 14px',
            background: '#141018',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 14,
            opacity: q.complete ? .68 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{
                fontSize: '.82rem', fontWeight: 600, color: '#F4F0E8',
                textDecoration: q.complete ? 'line-through' : 'none',
                textDecorationColor: 'rgba(255,255,255,.3)',
              }}>{q.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {q.complete
                  ? <CheckIcon size={14} stroke={2.5} style={{ color: '#6FEDB0' }} />
                  : null}
                <Coin size={13} />
                <span style={{ fontSize: '.78rem', fontWeight: 900, color: tone, fontVariantNumeric: 'tabular-nums' }}>+{q.reward}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                <div style={{ width: `${p * 100}%`, height: '100%', background: bg, boxShadow: `0 0 6px ${bg}` }} />
              </div>
              <div style={{ fontSize: '.64rem', color: '#7A7875', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right', fontWeight: 700 }}>
                {q.done}/{q.total}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { HomeScreen, SectionLabel, FadeIn });
