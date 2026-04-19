// WarsV2 — country vs country PvP: countries / war / rating / history tabs.
// Green accent (#3DBA7A) everywhere battles were gold.

const WAR_GREEN = '#3DBA7A';
const WAR_GREEN_SOFT = '#6FEDB0';

function WarsV2() {
  const [tab, setTab] = React.useState('war'); // countries | war | rating | history
  const [joined, setJoined] = React.useState(true);

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <WarsHeader tab={tab} onTab={setTab} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px .85rem 80px' }} className="cc-scroll">
        {tab === 'countries' && <CountriesTab joined={joined} onToggle={() => setJoined(!joined)} />}
        {tab === 'war'       && <WarTab />}
        {tab === 'rating'    && <RatingTab />}
        {tab === 'history'   && <HistoryTab />}
      </div>
    </div>
  );
}

function WarsHeader({ tab, onTab }) {
  const tabs = [
    { id: 'countries', label: 'Страны' },
    { id: 'war',       label: 'Война',   badge: 'LIVE' },
    { id: 'rating',    label: 'Рейтинг' },
    { id: 'history',   label: 'История' },
  ];
  return (
    <div style={{
      flexShrink: 0, padding: '10px .85rem 10px',
      background: 'linear-gradient(180deg,#0D0D12,#0B0B10)',
      borderBottom: '1px solid rgba(255,255,255,.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: WAR_GREEN, letterSpacing: '-.02em', textShadow: `0 0 18px ${WAR_GREEN}50` }}>Войны</div>
          <div style={{ fontSize: '.6rem', fontWeight: 700, color: '#7A7875', letterSpacing: '.14em', textTransform: 'uppercase' }}>Сезон 4</div>
        </div>
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
            fontSize: '.72rem', fontWeight: 800, letterSpacing: '.02em', cursor: 'pointer',
            background: tab === t.id ? `linear-gradient(180deg,${WAR_GREEN_SOFT},${WAR_GREEN})` : 'transparent',
            color: tab === t.id ? '#05200F' : '#7A7875',
            boxShadow: tab === t.id ? `0 4px 14px ${WAR_GREEN}35` : 'none',
            transition: 'background .2s, color .2s',
          }}>
            {t.label}
            {t.badge && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                marginLeft: 4, fontSize: '.48rem', fontWeight: 900,
                color: tab === t.id ? '#05200F' : '#EF4444', letterSpacing: '.12em',
              }}>
                <span style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: tab === t.id ? '#05200F' : '#EF4444',
                  animation: 'ccTurnPulse .9s ease-in-out infinite',
                }} />
                {t.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Countries tab ──────────────────────────────────────────────────────────
function CountriesTab({ joined, onToggle }) {
  const countries = [
    { code: 'RU', name: 'Россия',     members: 4820, elo: 1920, color: '#D4A843', pattern: 'ru' },
    { code: 'US', name: 'США',        members: 5120, elo: 1980, color: '#6FA8DC', pattern: 'us' },
    { code: 'CN', name: 'Китай',      members: 6340, elo: 1890, color: '#EF4444', pattern: 'cn' },
    { code: 'IN', name: 'Индия',      members: 3210, elo: 1760, color: '#E88B44', pattern: 'in' },
    { code: 'DE', name: 'Германия',   members: 2150, elo: 1840, color: '#D4A843', pattern: 'de' },
    { code: 'BR', name: 'Бразилия',   members: 2480, elo: 1790, color: '#3DBA7A', pattern: 'br' },
    { code: 'FR', name: 'Франция',    members: 1980, elo: 1820, color: '#6FA8DC', pattern: 'fr' },
    { code: 'UA', name: 'Украина',    members: 1640, elo: 1850, color: '#F0C85A', pattern: 'ua' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', paddingTop: 2 }}>
        {['Вступил', 'Не вступил'].map((l, i) => (
          <div key={l} onClick={onToggle} style={{
            padding: '4px 10px', borderRadius: 8,
            fontSize: '.58rem', fontWeight: 800, letterSpacing: '.1em', cursor: 'pointer',
            background: (i === 0) === joined ? `${WAR_GREEN}20` : 'rgba(255,255,255,.03)',
            border: (i === 0) === joined ? `1px solid ${WAR_GREEN}` : '1px solid rgba(255,255,255,.06)',
            color: (i === 0) === joined ? WAR_GREEN : '#7A7875',
          }}>{l}</div>
        ))}
      </div>

      {joined ? (
        <MyCountryCard country={countries[0]} rank={2} />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          {countries.map((c) => <CountryJoinCard key={c.code} country={c} />)}
        </div>
      )}
    </div>
  );
}

function MyCountryCard({ country, rank }) {
  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: `radial-gradient(120% 100% at 0% 0%,${WAR_GREEN}1e,${WAR_GREEN}00 55%),linear-gradient(180deg,#161A17,#121411)`,
      border: `1px solid ${WAR_GREEN}44`,
      boxShadow: `0 0 30px ${WAR_GREEN}18`,
    }}>
      <div style={{ fontSize: '.56rem', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: WAR_GREEN_SOFT }}>Твоя страна</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <Flag code={country.code} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em' }}>{country.name}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: '.7rem', color: '#7A7875' }}>
            <span><b style={{ color: '#F4F0E8' }}>{country.members.toLocaleString('ru')}</b> бойцов</span>
            <span>·</span>
            <span>#{rank} в мире</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 14 }}>
        <Stat label="ELO страны" value={country.elo} tone="green" />
        <Stat label="Побед" value="128" tone="green" />
        <Stat label="Твой ранг" value="#42" />
      </div>
      <button style={{
        marginTop: 12, width: '100%', fontFamily: 'inherit',
        fontWeight: 800, fontSize: '.76rem', letterSpacing: '.06em',
        padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
        background: 'rgba(239,68,68,.08)', color: '#EF4444',
        border: '1px solid rgba(239,68,68,.35)',
      }}>Покинуть команду</button>
    </div>
  );
}

function CountryJoinCard({ country }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: `radial-gradient(140% 100% at 0% 0%,${country.color}16,${country.color}00 55%),#141018`,
      border: `1px solid ${country.color}35`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <Flag code={country.code} size={40} />
      <div style={{ fontSize: '.92rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.01em' }}>{country.name}</div>
      <div style={{ fontSize: '.64rem', color: '#7A7875', lineHeight: 1.4 }}>
        <div>{country.members.toLocaleString('ru')} бойцов</div>
        <div>ELO <b style={{ color: '#C8C0E0' }}>{country.elo}</b></div>
      </div>
      <button style={{
        marginTop: 2, fontFamily: 'inherit',
        fontWeight: 900, fontSize: '.7rem', letterSpacing: '.1em', textTransform: 'uppercase',
        padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
        background: `linear-gradient(180deg,${WAR_GREEN_SOFT},${WAR_GREEN})`,
        color: '#05200F', border: 'none',
        boxShadow: `0 3px 12px ${WAR_GREEN}40`,
      }}>Вступить</button>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{
      padding: '8px 8px', borderRadius: 10,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ fontSize: '.54rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7A7875' }}>{label}</div>
      <div style={{
        marginTop: 2, fontSize: '1rem', fontWeight: 900, letterSpacing: '-.02em',
        color: tone === 'green' ? WAR_GREEN_SOFT : '#EAE2CC',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

// ── War tab ────────────────────────────────────────────────────────────────
function WarTab() {
  const a = { code: 'US', name: 'США',    score: 3820, color: '#6FA8DC' };
  const b = { code: 'RU', name: 'Россия', score: 3210, color: '#D4A843' };
  const total = a.score + b.score;
  const topA = [
    { initials: 'JK', name: 'John_K',    points: 184, tone: 'purple' },
    { initials: 'MR', name: 'MrRook',    points: 162, tone: 'green'  },
    { initials: 'BL', name: 'BlitzLee',  points: 148, tone: 'gold'   },
    { initials: 'ZZ', name: 'ZenZen',    points: 124, tone: 'purple' },
    { initials: 'AJ', name: 'Ace_J',     points: 110, tone: 'gold'   },
  ];
  const topB = [
    { initials: 'СМ', name: 'Sokolov',    points: 198, tone: 'gold',   me: true },
    { initials: 'НК', name: 'NightKnight',points: 172, tone: 'purple' },
    { initials: 'ВП', name: 'VolgaPawn',  points: 141, tone: 'green'  },
    { initials: 'ИИ', name: 'IceIvan',    points: 132, tone: 'purple' },
    { initials: 'РГ', name: 'RedGrand',   points: 108, tone: 'gold'   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <VSHero a={a} b={b} />
      <Countdown />
      <ScoreBar a={a} b={b} total={total} />

      <div>
        <div style={{ fontSize: '.58rem', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7A7875', padding: '2px 2px 8px' }}>
          Топ бойцов
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TopList country={a} fighters={topA} />
          <TopList country={b} fighters={topB} />
        </div>
      </div>

      <BattleCTA />
    </div>
  );
}

function VSHero({ a, b }) {
  return (
    <div style={{
      padding: '14px 12px',
      background: `radial-gradient(120% 80% at 0% 0%,${a.color}22,${a.color}00 55%),radial-gradient(120% 80% at 100% 100%,${b.color}22,${b.color}00 55%),#141018`,
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 16, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
        <HeroSide c={a} align="left" />
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(80% 80% at 50% 30%,#1A1620,#0D0D12)',
          border: `1px solid ${WAR_GREEN}66`,
          boxShadow: `0 0 18px ${WAR_GREEN}30`,
          fontSize: '.75rem', fontWeight: 900, letterSpacing: '.04em', color: WAR_GREEN_SOFT,
        }}>VS</div>
        <HeroSide c={b} align="right" />
      </div>
    </div>
  );
}

function HeroSide({ c, align }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 6 }}>
      <Flag code={c.code} size={56} />
      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em' }}>{c.name}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: c.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em' }}>
        {c.score.toLocaleString('ru')}
      </div>
    </div>
  );
}

function Countdown() {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 14,
      background: `radial-gradient(100% 100% at 50% 0%,${WAR_GREEN}12,${WAR_GREEN}00 70%),#141018`,
      border: `1px solid ${WAR_GREEN}35`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '.56rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: WAR_GREEN_SOFT }}>
        До конца войны
      </div>
      <div style={{
        marginTop: 4, fontFamily: 'ui-monospace,SF Mono,monospace',
        fontSize: '1.85rem', fontWeight: 900, color: WAR_GREEN_SOFT,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em',
        textShadow: `0 0 18px ${WAR_GREEN}70`,
      }}>24:18:45</div>
    </div>
  );
}

function ScoreBar({ a, b, total }) {
  const pctA = (a.score / total) * 100;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.64rem', fontWeight: 700, color: '#7A7875', marginBottom: 6 }}>
        <span>{pctA.toFixed(1)}% · {a.name}</span>
        <span>{b.name} · {(100 - pctA).toFixed(1)}%</span>
      </div>
      <div style={{
        height: 14, borderRadius: 9999, overflow: 'hidden', display: 'flex',
        background: '#0D0D12', border: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ width: `${pctA}%`, background: `linear-gradient(90deg,${a.color},${a.color}cc)`, transition: 'width .4s' }} />
        <div style={{ flex: 1, background: `linear-gradient(90deg,${b.color}cc,${b.color})` }} />
      </div>
    </div>
  );
}

function TopList({ country, fighters }) {
  return (
    <div style={{
      padding: 10, borderRadius: 14,
      background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <Flag code={country.code} size={18} />
        <div style={{ fontSize: '.74rem', fontWeight: 800, color: '#EAE2CC' }}>{country.name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 6 }}>
        {fighters.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 2px',
            background: f.me ? `${WAR_GREEN}10` : 'transparent', borderRadius: 6,
          }}>
            <span style={{ fontSize: '.6rem', fontWeight: 800, color: '#7A7875', width: 12 }}>{i + 1}</span>
            <Avatar initials={f.initials} tone={f.tone} size={20} />
            <span style={{
              flex: 1, fontSize: '.72rem', fontWeight: 700,
              color: f.me ? WAR_GREEN_SOFT : '#F4F0E8',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{f.name}{f.me ? ' · ты' : ''}</span>
            <span style={{ fontSize: '.7rem', fontWeight: 900, color: country.color, fontVariantNumeric: 'tabular-nums' }}>
              {f.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BattleCTA() {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        width: '100%', fontFamily: 'inherit',
        fontWeight: 900, fontSize: '.95rem', letterSpacing: '.1em', textTransform: 'uppercase',
        padding: '15px 18px', borderRadius: 14, cursor: 'pointer',
        background: `linear-gradient(180deg,${WAR_GREEN_SOFT},${WAR_GREEN})`,
        color: '#05200F', border: `1px solid ${WAR_GREEN}`,
        boxShadow: `0 8px 26px ${WAR_GREEN}55`,
        transform: pressed ? 'scale(.98)' : 'scale(1)',
        transition: 'transform .15s',
        animation: 'ccWarPulse 2s ease-in-out infinite',
      }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2 }}>
        <SwordIcon size={16} stroke={2.4} /> В бой
      </span>
      <span style={{
        position: 'absolute', top: 0, left: '-60%', width: '40%', height: '100%',
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)',
        transform: 'skewX(-24deg)',
        animation: 'ccShimmer 2.4s ease-in-out infinite',
      }} />
    </button>
  );
}

// ── Rating tab ─────────────────────────────────────────────────────────────
function RatingTab() {
  const rows = [
    { code: 'US', name: 'США',       elo: 1980, members: 5120, wins: 214 },
    { code: 'RU', name: 'Россия',    elo: 1920, members: 4820, wins: 196, me: true },
    { code: 'CN', name: 'Китай',     elo: 1890, members: 6340, wins: 188 },
    { code: 'DE', name: 'Германия',  elo: 1840, members: 2150, wins: 154 },
    { code: 'UA', name: 'Украина',   elo: 1825, members: 1640, wins: 142 },
    { code: 'FR', name: 'Франция',   elo: 1820, members: 1980, wins: 138 },
    { code: 'BR', name: 'Бразилия',  elo: 1790, members: 2480, wins: 132 },
    { code: 'IN', name: 'Индия',     elo: 1760, members: 3210, wins: 120 },
    { code: 'JP', name: 'Япония',    elo: 1755, members: 1820, wins: 116 },
    { code: 'GB', name: 'Британия',  elo: 1745, members: 1650, wins: 108 },
    { code: 'KR', name: 'Корея',     elo: 1730, members: 1410, wins: 102 },
    { code: 'ES', name: 'Испания',   elo: 1720, members: 1380, wins: 98  },
    { code: 'IT', name: 'Италия',    elo: 1715, members: 1340, wins: 94  },
    { code: 'PL', name: 'Польша',    elo: 1700, members: 1250, wins: 90  },
    { code: 'TR', name: 'Турция',    elo: 1680, members: 1180, wins: 86  },
    { code: 'AR', name: 'Аргентина', elo: 1670, members: 980,  wins: 78  },
    { code: 'MX', name: 'Мексика',   elo: 1660, members: 920,  wins: 74  },
    { code: 'NL', name: 'Нидерланды',elo: 1655, members: 880,  wins: 72  },
    { code: 'SE', name: 'Швеция',    elo: 1640, members: 840,  wins: 68  },
    { code: 'AU', name: 'Австралия', elo: 1625, members: 790,  wins: 64  },
  ];
  return (
    <div style={{
      background: '#141018', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1.8fr 52px 56px 48px',
        padding: '8px 12px', gap: 8,
        fontSize: '.54rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
        color: '#5A5855', borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        <span>#</span><span>Страна</span>
        <span style={{ textAlign: 'right' }}>ELO</span>
        <span style={{ textAlign: 'right' }}>Чел.</span>
        <span style={{ textAlign: 'right' }}>Поб.</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.code} style={{
          display: 'grid', gridTemplateColumns: '28px 1.8fr 52px 56px 48px',
          padding: '8px 12px', gap: 8, alignItems: 'center',
          background: r.me ? `linear-gradient(90deg,${WAR_GREEN}18,${WAR_GREEN}05)` : (i % 2 ? 'rgba(255,255,255,.015)' : 'transparent'),
          borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.03)',
          borderLeft: r.me ? `3px solid ${WAR_GREEN}` : '3px solid transparent',
          paddingLeft: r.me ? 9 : 12,
        }}>
          <span style={{
            fontSize: '.76rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums',
            color: i < 3 ? WAR_GREEN_SOFT : '#7A7875',
          }}>{i + 1}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Flag code={r.code} size={18} />
            <span style={{
              fontSize: '.78rem', fontWeight: r.me ? 900 : 700,
              color: r.me ? WAR_GREEN_SOFT : '#F4F0E8',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{r.name}{r.me ? ' · ты' : ''}</span>
          </span>
          <span style={{ textAlign: 'right', fontSize: '.72rem', fontWeight: 800, color: '#C8C0E0', fontVariantNumeric: 'tabular-nums' }}>{r.elo}</span>
          <span style={{ textAlign: 'right', fontSize: '.68rem', color: '#7A7875', fontVariantNumeric: 'tabular-nums' }}>{(r.members / 1000).toFixed(1) + 'K'}</span>
          <span style={{ textAlign: 'right', fontSize: '.72rem', fontWeight: 800, color: WAR_GREEN_SOFT, fontVariantNumeric: 'tabular-nums' }}>{r.wins}</span>
        </div>
      ))}
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────
function HistoryTab() {
  const wars = [
    { winner: { code: 'US', name: 'США',    score: 3421 }, loser: { code: 'CN', name: 'Китай',    score: 2890 }, date: '12 мар',  prize: 25000 },
    { winner: { code: 'RU', name: 'Россия', score: 4102 }, loser: { code: 'DE', name: 'Германия', score: 3650 }, date: '5 мар',   prize: 18000 },
    { winner: { code: 'CN', name: 'Китай',  score: 3980 }, loser: { code: 'IN', name: 'Индия',    score: 3210 }, date: '26 фев',  prize: 14000 },
    { winner: { code: 'UA', name: 'Украина',score: 2980 }, loser: { code: 'TR', name: 'Турция',   score: 2140 }, date: '19 фев',  prize: 9000  },
    { winner: { code: 'FR', name: 'Франция',score: 2750 }, loser: { code: 'IT', name: 'Италия',   score: 2340 }, date: '12 фев',  prize: 8000  },
    { winner: { code: 'BR', name: 'Бразилия',score:3120 }, loser: { code: 'AR', name: 'Аргентина',score: 2890 }, date: '5 фев',   prize: 10000 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {wars.map((w, i) => (
        <div key={i} style={{
          padding: 10, borderRadius: 12,
          background: '#141018',
          border: '1px solid rgba(255,255,255,.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Flag code={w.winner.code} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#F4F0E8' }}>
              <b style={{ color: WAR_GREEN_SOFT, fontWeight: 900 }}>{w.winner.name}</b>
              <span style={{ color: '#7A7875', fontWeight: 600 }}> разбили </span>
              <b style={{ color: '#C8C0E0', fontWeight: 700 }}>{w.loser.name}</b>
            </div>
            <div style={{ fontSize: '.66rem', color: '#7A7875', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace,SF Mono,monospace', color: '#C8C0E0', fontVariantNumeric: 'tabular-nums' }}>
                {w.winner.score.toLocaleString('ru')} : {w.loser.score.toLocaleString('ru')}
              </span>
              <span>·</span>
              <span>{w.date}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.5rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>Приз</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '.82rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums' }}>
              <Coin size={12} /> {(w.prize / 1000) + 'K'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Flag (letter block — brand rule: no emoji) ─────────────────────────────
const FLAG_BG = {
  RU: 'linear-gradient(180deg,#fff 0 33%,#1E4080 33% 66%,#C8202C 66%)',
  US: 'linear-gradient(180deg,#1E4080,#C8202C)',
  CN: 'linear-gradient(135deg,#C8202C,#8A0F18)',
  IN: 'linear-gradient(180deg,#E88B44 0 33%,#fff 33% 66%,#2E7D32 66%)',
  DE: 'linear-gradient(180deg,#222 0 33%,#C8202C 33% 66%,#F0C85A 66%)',
  BR: 'linear-gradient(180deg,#2E7D32,#F0C85A)',
  FR: 'linear-gradient(90deg,#1E4080 0 33%,#fff 33% 66%,#C8202C 66%)',
  UA: 'linear-gradient(180deg,#1E4080 50%,#F0C85A 50%)',
  JP: 'radial-gradient(circle at center,#C8202C 22%,#fff 22%)',
  GB: 'linear-gradient(135deg,#1E4080,#C8202C)',
  KR: 'linear-gradient(135deg,#fff,#C8202C 45%,#1E4080)',
  ES: 'linear-gradient(180deg,#C8202C 0 25%,#F0C85A 25% 75%,#C8202C 75%)',
  IT: 'linear-gradient(90deg,#2E7D32 0 33%,#fff 33% 66%,#C8202C 66%)',
  PL: 'linear-gradient(180deg,#fff 50%,#C8202C 50%)',
  TR: 'linear-gradient(135deg,#C8202C,#8A0F18)',
  AR: 'linear-gradient(180deg,#6FA8DC 0 33%,#fff 33% 66%,#6FA8DC 66%)',
  MX: 'linear-gradient(90deg,#2E7D32 0 33%,#fff 33% 66%,#C8202C 66%)',
  NL: 'linear-gradient(180deg,#C8202C 0 33%,#fff 33% 66%,#1E4080 66%)',
  SE: 'linear-gradient(135deg,#1E4080,#F0C85A)',
  AU: 'linear-gradient(135deg,#1E4080,#C8202C)',
};
function Flag({ code, size = 32 }) {
  return (
    <div style={{
      width: size, height: size * 0.72, borderRadius: 5, flexShrink: 0,
      background: FLAG_BG[code] || 'linear-gradient(180deg,#333,#111)',
      border: '1px solid rgba(0,0,0,.4)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08),0 1px 3px rgba(0,0,0,.35)',
      position: 'relative', overflow: 'hidden',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 900, letterSpacing: '.02em',
      color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)',
      fontFamily: 'Inter, sans-serif',
    }}>
      {code}
    </div>
  );
}

Object.assign(window, { WarsV2 });
