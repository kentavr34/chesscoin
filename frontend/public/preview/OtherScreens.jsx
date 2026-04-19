// Game screen — Premium Oak board, player bars, bet panel.
function GameScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>
          Игра · 5+0 · блиц
        </span>
        <Chip tone="gold" dot>Ставка <Coin size={11} />100</Chip>
      </div>
      <PlayerBar name="Magnus_27" elo={2340} initials="М" tone="purple" time="02:14" capturedCount={2} active={false} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ChessBoard position={SAMPLE_POSITION} size={330}
          lastMove={{ from: 'f1', to: 'b5' }} />
      </div>
      <PlayerBar name="AlexKing_42 (ты)" elo={1820} initials="АК" tone="gold" time="03:42" capturedCount={1} active={true} />
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 44px',
        gap: 6, marginTop: 4,
      }}>
        <button style={btnSec()}>Ничья</button>
        <button style={btnSec()}>Отменить</button>
        <button style={btnDanger()}>Сдаться</button>
        <button style={btnIcon()}><DotsIcon size={18}/></button>
      </div>
    </div>
  );
}

const btnSec = () => ({
  fontFamily: 'inherit', fontWeight: 700, fontSize: '.76rem',
  background: 'rgba(255,255,255,.05)', color: '#F4F0E8',
  border: '1px solid rgba(255,255,255,.08)',
  padding: '10px 0', borderRadius: 10, cursor: 'pointer',
});
const btnDanger = () => ({
  fontFamily: 'inherit', fontWeight: 700, fontSize: '.76rem',
  background: 'rgba(239,68,68,.12)', color: '#EF4444',
  border: '1px solid rgba(239,68,68,.3)',
  padding: '10px 0', borderRadius: 10, cursor: 'pointer',
});
const btnIcon = () => ({
  background: 'rgba(255,255,255,.05)', color: '#C8C0E0',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 10, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

// Battles (tournaments) placeholder screen
function BattlesScreen() {
  const tournaments = [
    { name: 'Weekend Cup · 5+0', players: 128, prize: 12500, starts: '15:00', tone: 'purple' },
    { name: 'Blitz Fever · 3+0', players: 64,  prize: 4800,  starts: 'идёт', tone: 'purple', live: true },
    { name: 'Classic Masters',   players: 32,  prize: 25000, starts: 'Зв 18:30', tone: 'gold' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionLabel right={<Chip tone="purple" dot>3 активных</Chip>}>Турниры</SectionLabel>
      {tournaments.map((t, i) => (
        <div key={i} style={{
          padding: '14px', borderRadius: 16,
          background: `linear-gradient(155deg,rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},.12),rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},0) 55%),#141018`,
          border: `1px solid rgba(${hexToRgb(t.tone === 'purple' ? '#9B6DFF' : '#D4A843')},.25)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '.94rem', fontWeight: 800, color: '#F4F0E8' }}>{t.name}</div>
              <div style={{ fontSize: '.68rem', color: '#7A7875', marginTop: 3 }}>{t.players} игроков</div>
            </div>
            {t.live
              ? <Chip tone="green" dot>LIVE</Chip>
              : <span style={{ fontSize: '.72rem', color: '#C8C0E0' }}>{t.starts}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Призовой</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Coin size={18} />
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(212,168,67,.3)' }}>{t.prize.toLocaleString('en-US')}</span>
              </div>
            </div>
            <PressButton primary>{t.live ? 'Смотреть' : 'Записаться'}</PressButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// Wars — team list
function WarsScreen() {
  const teams = [
    { flag: '🇷🇺', name: 'Россия',  players: 4820, win: 68, tone: 'gold',   rank: 2 },
    { flag: '🇺🇦', name: 'Украина', players: 2140, win: 71, tone: 'purple', rank: 1 },
    { flag: '🇰🇿', name: 'Казахстан', players: 980,  win: 62, tone: 'green',  rank: 3 },
    { flag: '🇧🇾', name: 'Беларусь',  players: 640,  win: 58, tone: 'blue',   rank: 4 },
    { flag: '🇲🇩', name: 'Молдова',   players: 280,  win: 54, tone: 'neutral', rank: 5 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        padding: 14, borderRadius: 18,
        background: 'linear-gradient(155deg,rgba(61,186,122,.14),rgba(61,186,122,0) 60%),#141018',
        border: '1px solid rgba(61,186,122,.28)',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6FEDB0' }}>Твоя команда</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#F4F0E8', marginTop: 4, letterSpacing: '-.02em' }}>Россия · 2 место</div>
        <div style={{ height: 2.5, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg,#3DBA7A,#6FEDB0)', boxShadow: '0 0 8px #3DBA7A' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.64rem', color: '#7A7875', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
          <span>Очки: 18,240</span>
          <span>до 1-го: 3,180</span>
        </div>
      </div>
      <SectionLabel>Рейтинг стран</SectionLabel>
      <div>
        {teams.map((t, i) => (
          <div key={t.name} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px',
            borderBottom: i === teams.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
          }}>
            <div style={{ fontSize: '.82rem', fontWeight: 900, color: t.rank <= 3 ? '#F0C85A' : '#7A7875', width: 20, fontVariantNumeric: 'tabular-nums' }}>
              {t.rank}
            </div>
            <div style={{ fontSize: 22 }}>{t.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{t.name}</div>
              <div style={{ fontSize: '.66rem', color: '#7A7875' }}>{t.players.toLocaleString('en-US')} игроков</div>
            </div>
            <div style={{ fontSize: '.78rem', fontWeight: 900, color: '#6FEDB0', fontVariantNumeric: 'tabular-nums' }}>{t.win}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({ user }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0 4px' }}>
        <PassportAvatar size={96} initials={user.initials} />
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F4F0E8', marginTop: 4 }}>{user.name}</div>
        <div style={{ display: 'flex', gap: 5 }}>
          <Chip tone="gold">{user.rank}</Chip>
          <Chip tone="blue">J.A.R.V.I.S · {user.jarvisRank}</Chip>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8,
      }}>
        {[
          { label: 'ELO',  value: user.elo, tone: '#D4A843' },
          { label: 'Побед', value: 142, tone: '#6FEDB0' },
          { label: 'Рейтинг', value: '#48', tone: '#C4A8FF' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '12px 8px', textAlign: 'center',
            background: '#141018', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14,
          }}>
            <div style={{ fontSize: '.5rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.tone, fontVariantNumeric: 'tabular-nums', marginTop: 3, letterSpacing: '-.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <SectionLabel>Кошелёк</SectionLabel>
      <div style={{
        padding: 14, borderRadius: 16,
        background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.14),rgba(212,168,67,0) 55%),#120E04',
        border: '1px solid rgba(212,168,67,.22)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Баланс</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <Coin size={22} />
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', textShadow: '0 0 14px rgba(212,168,67,.35)' }}>{formatK(user.balance)}</span>
            </div>
            <div style={{ fontSize: '.68rem', color: '#7A7875', marginTop: 3 }}>≈ 0.214 TON</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <PressButton style={{ padding: '8px 10px' }}><ArrowDownIcon size={14} stroke={2.2}/></PressButton>
            <PressButton primary style={{ padding: '8px 10px' }}><ArrowUpIcon size={14} stroke={2.2}/></PressButton>
          </div>
        </div>
      </div>
      <SectionLabel>Настройки</SectionLabel>
      <div>
        {[
          { label: 'Доска', value: 'Premium Oak' },
          { label: 'Стиль фигур', value: 'Classic' },
          { label: 'Звук', value: 'Вкл.' },
          { label: 'J.A.R.V.I.S уровень', value: 'Гроссмейстер' },
        ].map((s, i, a) => (
          <div key={s.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 2px',
            borderBottom: i === a.length - 1 ? 'none' : '1px solid rgba(255,255,255,.05)',
          }}>
            <span style={{ fontSize: '.86rem', color: '#F4F0E8' }}>{s.label}</span>
            <span style={{ fontSize: '.82rem', color: '#7A7875', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {s.value} <ChevRight size={12} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { GameScreen, BattlesScreen, WarsScreen, ProfileScreen });
