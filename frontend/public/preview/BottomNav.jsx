function BottomNav({ active, onChange }) {
  const items = [
    { id: 'home',     label: 'Главная', Icon: HomeIcon },
    { id: 'game',     label: 'Игра',    Icon: GameIcon },
    { id: 'battles',  label: 'Батлы',   Icon: BattlesIcon },
    { id: 'wars',     label: 'Войны',   Icon: WarsIcon },
    { id: 'profile',  label: 'Профиль', Icon: ProfileIcon },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      background: 'linear-gradient(180deg,#141018 0%,#0F0C14 100%)',
      borderTop: '1px solid rgba(255,255,255,.05)',
      borderRadius: '20px 20px 0 0',
      padding: '10px 6px 14px',
      boxShadow: '0 -8px 24px rgba(0,0,0,.4)',
      paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      zIndex: 10,
    }}>
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <div key={id} onClick={() => onChange(id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '4px 0', color: isActive ? '#D4A843' : '#7A7875',
            position: 'relative', cursor: 'pointer',
            transition: 'color .2s',
          }}>
            {isActive && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 3, borderRadius: 3,
                background: '#D4A843', boxShadow: '0 0 10px rgba(212,168,67,.6)',
              }} />
            )}
            <Icon size={22} />
            <span style={{ fontSize: '.54rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
Object.assign(window, { BottomNav });
