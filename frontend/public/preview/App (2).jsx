// Main App — screen shell + navigation + variant switcher
const DEFAULT_USER = {
  name: 'AlexKing_42',
  initials: 'АК',
  elo: 1450,
  rank: 'Сержант',
  jarvisRank: 'Гроссмейстер',
  balance: 12500,
};

function App() {
  const [screen, setScreen] = React.useState(() => localStorage.getItem('cc-screen') || 'home');
  const [variant, setVariant] = React.useState(() => localStorage.getItem('cc-variant') || 'classic');
  const [user] = React.useState(DEFAULT_USER);
  const [flash, setFlash] = React.useState(null);
  const [analysisOpen, setAnalysisOpen] = React.useState(() => location.hash === '#analysis' || localStorage.getItem('cc-analysis') === '1');

  React.useEffect(() => {
    const h = () => setAnalysisOpen(location.hash === '#analysis');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  React.useEffect(() => { localStorage.setItem('cc-analysis', analysisOpen ? '1' : '0'); }, [analysisOpen]);

  React.useEffect(() => { localStorage.setItem('cc-screen', screen); }, [screen]);
  React.useEffect(() => { localStorage.setItem('cc-variant', variant); }, [variant]);

  const go = (id) => setScreen(id);
  const handlePlay = (id) => {
    if (id === 'battles' || id === 'cups')  { setScreen('battles'); return; }
    if (id === 'wars')    { setScreen('wars'); return; }
    if (id === 'jarvis')  { setFlash('J.A.R.V.I.S запускается…'); setTimeout(() => setFlash(null), 1400); setScreen('game'); return; }
    setScreen('game');
  };
  const handleTopup = () => { setFlash('Пополнение открыто'); setTimeout(() => setFlash(null), 1400); };

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#0D0D12', color: '#F4F0E8',
      fontFamily: 'Inter,sans-serif', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <TelegramBar screen={screen} />
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px .85rem 94px',
        scrollbarWidth: 'none',
      }} className="cc-scroll">
        {screen === 'home' && (
          <>
            <HomeHeader user={user} variant={variant} onVariant={setVariant} />
            <HomeScreen variant={variant} user={user} onPlay={handlePlay} onTopup={handleTopup} />
          </>
        )}
        {screen === 'game'    && <GameScreenV2 />}
        {screen === 'battles' && <BattlesV2 />}
        {screen === 'wars'    && <WarsV2 />}
        {screen === 'profile' && <ScreenWrap title="Профиль"><ProfileScreen user={user} onOpenAnalysis={() => { location.hash='analysis'; setAnalysisOpen(true); }} /></ScreenWrap>}
      </div>
      <BottomNav active={screen} onChange={go} />
      {flash && <Flash>{flash}</Flash>}
      {analysisOpen && <AnalysisModal onClose={() => { history.replaceState(null,'',location.pathname); setAnalysisOpen(false); }} />}
    </div>
  );
}

function TelegramBar({ screen }) {
  const titles = { home: 'Главная', game: 'Партия', battles: 'Батлы', wars: 'Войны', profile: 'Профиль' };
  return (
    <div style={{
      height: 'calc(18px + env(safe-area-inset-top, 0px))',
      background: 'linear-gradient(180deg,#0B0B10,#0D0D12)',
      borderBottom: '1px solid rgba(255,255,255,.04)',
      flexShrink: 0,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      fontSize: '.58rem', letterSpacing: '.14em', textTransform: 'uppercase',
      color: '#7A7875', fontWeight: 700, paddingBottom: 2,
    }}>
      ChessCoin · {titles[screen]}
    </div>
  );
}

function HomeHeader({ user, variant, onVariant }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 2px 12px',
    }}>
      <div style={{
        fontSize: '1.25rem', fontWeight: 900, color: '#EAE2CC',
        letterSpacing: '-.02em', lineHeight: 1.15,
      }}>Главная</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <VariantSwitch value={variant} onChange={onVariant} />
        <IconSlot><SearchIcon size={18} /></IconSlot>
        <IconSlot badge><BellIcon size={18} /></IconSlot>
      </div>
    </div>
  );
}

function VariantSwitch({ value, onChange }) {
  const opts = [
    { id: 'classic', label: 'Кл.' },
    { id: 'card',    label: 'Крт.' },
    { id: 'minimal', label: 'Мин.' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 2,
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 9999, fontSize: '.58rem', fontWeight: 800,
      letterSpacing: '.06em',
    }}>
      {opts.map((o) => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          padding: '5px 9px', borderRadius: 9999, cursor: 'pointer',
          background: value === o.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: value === o.id ? '#0D0D12' : '#7A7875',
          boxShadow: value === o.id ? '0 0 10px rgba(212,168,67,.3)' : 'none',
          transition: 'color .15s,background .15s',
        }}>{o.label}</div>
      ))}
    </div>
  );
}

function IconSlot({ children, badge }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)',
      color: '#C8C0E0', cursor: 'pointer', position: 'relative',
    }}>
      {children}
      {badge && <div style={{
        position: 'absolute', top: 7, right: 7,
        width: 6, height: 6, borderRadius: '50%',
        background: '#EF4444', boxShadow: '0 0 6px #EF4444',
      }} />}
    </div>
  );
}

function ScreenWrap({ title, children }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 2px 14px',
      }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EAE2CC', letterSpacing: '-.02em' }}>{title}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconSlot><SearchIcon size={18} /></IconSlot>
          <IconSlot><BellIcon size={18} /></IconSlot>
        </div>
      </div>
      {children}
    </div>
  );
}

function Flash({ children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 100, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      zIndex: 20,
    }}>
      <div style={{
        padding: '10px 16px', borderRadius: 12,
        background: 'rgba(20,16,24,.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(212,168,67,.3)',
        color: '#F4F0E8', fontSize: '.76rem', fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,.5)',
        animation: 'ccPop .3s cubic-bezier(.34,1.56,.64,1)',
      }}>{children}</div>
    </div>
  );
}

Object.assign(window, { App });
