// GameScreenV2 — rich active-game screen.
// state: 'idle' (your turn) | 'thinking' (opponent) | 'check' | 'promotion' | 'result-win' | 'result-lose' | 'draw-offer'
function GameScreenV2() {
  const [state, setState] = React.useState('idle');
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const position = state === 'check' ? CHECK_POSITION : SAMPLE_POSITION;
  const lastMove = state === 'check' ? { from: 'd8', to: 'h4' } : { from: 'f1', to: 'b5' };
  const dots = state === 'idle' ? ['a4', 'c4', 'a6'] : [];
  const captures = state === 'idle' ? ['c6'] : [];
  const checkSq = state === 'check' ? 'e1' : null;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar balance={12500} bet={500} oppElo={2340} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px .85rem 80px', display: 'flex', flexDirection: 'column', gap: 10 }} className="cc-scroll">
        <StateSwitcher state={state} onChange={setState} />

        <GamePlayerCard
          side="opponent"
          name="Magnus_27" elo={2340} initials="М" tone="purple"
          time="08:42"
          captured="♟♟♞"
          thinking={state === 'thinking'}
          active={state === 'thinking'}
        />

        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <ChessBoard position={position} size={330}
            lastMove={lastMove} dots={dots} captures={captures} checkSq={checkSq} />
        </div>

        <GamePlayerCard
          side="you"
          name="AlexKing_42" elo={1820} initials="АК" tone="gold"
          time="03:14"
          captured="♙♙"
          yourTurn={state === 'idle' || state === 'check'}
          active={state === 'idle'}
          inCheck={state === 'check'}
        />

        <ActionBar
          onSurrender={() => setState('result-lose')}
          onDraw={() => setState('draw-offer')}
          onHistory={() => setHistoryOpen(true)}
        />
      </div>

      {state === 'promotion' && <PromotionDialog onPick={() => setState('idle')} />}
      {state === 'draw-offer' && <DrawSheet onClose={() => setState('idle')} />}
      {(state === 'result-win' || state === 'result-lose') && (
        <ResultOverlay win={state === 'result-win'} onClose={() => setState('idle')} />
      )}
      {historyOpen && <HistorySheet onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────────
function GameTopBar({ balance, bet, oppElo }) {
  return (
    <div style={{
      flexShrink: 0, padding: '10px .85rem 10px',
      borderBottom: '1px solid rgba(255,255,255,.05)',
      background: 'linear-gradient(180deg,#0D0D12,#0B0B10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconSlot><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg></IconSlot>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 9999,
          background: 'radial-gradient(120% 200% at 0% 0%,rgba(212,168,67,.22),rgba(212,168,67,0) 60%),#141018',
          border: '1px solid rgba(212,168,67,.3)',
        }}>
          <span style={{ fontSize: '.52rem', fontWeight: 800, letterSpacing: '.14em', color: '#7A7875', textTransform: 'uppercase' }}>Ставка</span>
          <Coin size={14} />
          <span style={{ fontSize: '.85rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 10px rgba(212,168,67,.4)' }}>{bet}</span>
        </div>
        <IconSlot><DotsIcon size={18} /></IconSlot>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '.56rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>
        <span>ELO соперника · <span style={{ color: '#C4A8FF' }}>{oppElo}</span></span>
        <span>Баланс · <span style={{ color: '#F0C85A' }}>
          <Coin size={10} /> {formatK(balance)}
        </span></span>
      </div>
    </div>
  );
}

// ── State switcher (debug / demo) ───────────────────────────────────────────
function StateSwitcher({ state, onChange }) {
  const opts = [
    { id: 'idle',        label: 'Твой ход' },
    { id: 'thinking',    label: 'Думает' },
    { id: 'check',       label: 'Шах' },
    { id: 'promotion',   label: 'Превращ.' },
    { id: 'draw-offer',  label: 'Ничья' },
    { id: 'result-win',  label: 'Победа' },
    { id: 'result-lose', label: 'Пораж.' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 10, overflowX: 'auto',
    }} className="cc-scroll">
      {opts.map((o) => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          flexShrink: 0, padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
          fontSize: '.58rem', fontWeight: 800, letterSpacing: '.06em',
          background: state === o.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: state === o.id ? '#0D0D12' : '#7A7875',
        }}>{o.label}</div>
      ))}
    </div>
  );
}

// ── Opponent / player card ──────────────────────────────────────────────────
function GamePlayerCard({ side, name, elo, initials, tone, time, captured, active, thinking, yourTurn, inCheck }) {
  const accent = inCheck ? '#EF4444' : (active ? '#3DBA7A' : 'rgba(255,255,255,.08)');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#141018',
      border: `1px solid ${accent === 'rgba(255,255,255,.08)' ? accent : 'transparent'}`,
      boxShadow: active || inCheck ? `inset 0 0 0 1.5px ${accent},0 0 16px ${accent}30` : 'none',
      borderRadius: 14,
      animation: active && !thinking ? 'ccTurnPulse 1.8s ease-in-out infinite' : 'none',
      position: 'relative',
    }}>
      <Avatar initials={initials} tone={tone} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.88rem', fontWeight: 700, color: '#F4F0E8' }}>{name}</span>
          <span style={{ fontSize: '.66rem', color: '#7A7875', fontWeight: 700 }}>ELO {elo}</span>
        </div>
        <div style={{ fontSize: '.72rem', color: '#7A7875', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, minHeight: 14 }}>
          {thinking ? (
            <>
              <span style={{ color: '#C4A8FF', fontWeight: 600 }}>думает</span>
              <ThinkingDots />
            </>
          ) : yourTurn && side === 'you' ? (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6FEDB0', boxShadow: '0 0 6px #3DBA7A', animation: 'ccTurnPulse 1.1s ease-in-out infinite' }} />
              <span style={{ color: '#6FEDB0', fontWeight: 700 }}>{inCheck ? 'шах королю' : 'твой ход'}</span>
            </>
          ) : (
            <span style={{ letterSpacing: '.04em', fontFamily: 'ui-monospace,SF Mono,monospace', color: '#7A7875' }}>
              {captured}
            </span>
          )}
        </div>
      </div>
      <div style={{
        padding: '10px 14px', borderRadius: 12, minWidth: 96, textAlign: 'center',
        background: active ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'rgba(255,255,255,.04)',
        border: active ? 'none' : '1px solid rgba(255,255,255,.06)',
        color: active ? '#0D0D12' : '#F4F0E8',
        fontSize: '1.3rem', fontWeight: 900,
        fontFamily: 'ui-monospace,SF Mono,monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em',
        boxShadow: active ? '0 0 22px rgba(212,168,67,.4)' : 'none',
      }}>{time}</div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%', background: '#C4A8FF',
          animation: `ccDot 1.1s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
    </span>
  );
}

// ── Action bar ──────────────────────────────────────────────────────────────
function ActionBar({ onSurrender, onDraw, onHistory }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 44px 1.1fr', gap: 6, marginTop: 2 }}>
      <ActBtn tone="danger" onClick={onSurrender}>
        <FlagIcon size={14} stroke={2.2} /> Сдаться
      </ActBtn>
      <ActBtn onClick={onDraw}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h8M5 7l-3 5 3 5M19 7l3 5-3 5"/></svg>
        Ничья
      </ActBtn>
      <ActBtn icon>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </ActBtn>
      <ActBtn onClick={onHistory}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/></svg>
        История
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </ActBtn>
    </div>
  );
}

function ActBtn({ children, tone, icon, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  const bg = tone === 'danger' ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.05)';
  const bd = tone === 'danger' ? 'rgba(239,68,68,.3)'  : 'rgba(255,255,255,.08)';
  const fg = tone === 'danger' ? '#EF4444' : '#F4F0E8';
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        fontFamily: 'inherit', fontWeight: 700, fontSize: '.74rem',
        background: bg, color: fg, border: `1px solid ${bd}`,
        padding: icon ? 0 : '10px 0', borderRadius: 10, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        transform: pressed ? 'scale(.96)' : 'scale(1)',
        transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
      }}>
      {children}
    </button>
  );
}

// ── Promotion dialog ────────────────────────────────────────────────────────
function PromotionDialog({ onPick }) {
  const pieces = [
    { piece: 'Q', label: 'Ферзь'  },
    { piece: 'R', label: 'Ладья'  },
    { piece: 'B', label: 'Слон'   },
    { piece: 'N', label: 'Конь'   },
  ];
  return (
    <Backdrop>
      <div style={{
        background: 'radial-gradient(120% 100% at 0% 0%,rgba(212,168,67,.14),rgba(212,168,67,0) 55%),#141018',
        border: '1px solid rgba(212,168,67,.3)',
        borderRadius: 20, padding: 18,
        boxShadow: '0 12px 40px rgba(0,0,0,.6)',
        maxWidth: 320, width: '100%',
        animation: 'ccPop .3s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875', textAlign: 'center' }}>Превращение пешки</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EAE2CC', textAlign: 'center', marginTop: 6, letterSpacing: '-.02em' }}>Выбери фигуру</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14 }}>
          {pieces.map((p) => (
            <PromotePick key={p.piece} {...p} onPick={onPick} />
          ))}
        </div>
      </div>
    </Backdrop>
  );
}

function PromotePick({ piece, label, onPick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onPick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onTouchStart={() => setHover(true)} onTouchEnd={() => setHover(false)}
      style={{
        aspectRatio: '1', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
        background: hover ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : '#DEB887',
        borderRadius: 10, cursor: 'pointer',
        boxShadow: hover ? '0 0 18px rgba(212,168,67,.5)' : '0 2px 8px rgba(0,0,0,.3)',
        transform: hover ? 'scale(1.04)' : 'scale(1)',
        transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <img src={`../../assets/pieces/white-${PIECE_FILE[piece]}.svg`} width="50" height="50" draggable="false" />
      <span style={{
        fontSize: '.5rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
        color: '#5C4318',
      }}>{label}</span>
    </div>
  );
}

// ── Draw offer bottom sheet ─────────────────────────────────────────────────
function DrawSheet({ onClose }) {
  return (
    <Backdrop align="bottom" onClose={onClose}>
      <div style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderTop: '2px solid rgba(212,168,67,.3)',
        borderRadius: '20px 20px 0 0',
        padding: 18,
        animation: 'ccSlideUp .3s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ width: 38, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.1)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C4A8FF', textAlign: 'center' }}>Предложение ничьей</div>
        <div style={{ fontSize: '.95rem', color: '#F4F0E8', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
          Magnus_27 предлагает ничью.<br/><span style={{ color: '#7A7875', fontSize: '.82rem' }}>Ставки делятся поровну: <Coin size={12} /> <b style={{ color: '#F0C85A', fontWeight: 900 }}>+250</b></span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
          <PressButton onClick={onClose}>Отклонить</PressButton>
          <PressButton primary onClick={onClose}>Принять</PressButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ── History sheet ───────────────────────────────────────────────────────────
function HistorySheet({ onClose }) {
  const moves = [
    ['1.', 'e4',    'e5'],
    ['2.', 'Nf3',   'Nc6'],
    ['3.', 'Bb5',   'a6'],
    ['4.', 'Ba4',   'Nf6'],
    ['5.', 'O-O',   'Be7'],
    ['6.', 'Re1',   'b5'],
    ['7.', 'Bb3',   'd6'],
    ['8.', 'c3',    'O-O'],
    ['9.', 'h3',    'Nb8'],
    ['10.','d4',    'Nbd7'],
  ];
  return (
    <Backdrop align="bottom" onClose={onClose}>
      <div style={{
        background: '#141018',
        border: '1px solid rgba(255,255,255,.08)',
        borderTop: '2px solid rgba(212,168,67,.3)',
        borderRadius: '20px 20px 0 0',
        padding: 18, maxHeight: '75%',
        animation: 'ccSlideUp .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 38, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.1)', margin: '0 auto 12px', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.02em' }}>История ходов</div>
          <span style={{ fontSize: '.58rem', color: '#7A7875', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>Испанка</span>
        </div>
        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: '32px 1fr 1fr', rowGap: 2, fontFamily: 'ui-monospace,SF Mono,monospace' }} className="cc-scroll">
          {moves.map(([n, w, b], i) => (
            <React.Fragment key={n}>
              <div style={{ fontSize: '.74rem', color: '#7A7875', padding: '6px 0' }}>{n}</div>
              <div style={{ fontSize: '.82rem', color: '#F4F0E8', padding: '6px 8px', background: i % 2 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 4 }}>{w}</div>
              <div style={{ fontSize: '.82rem', color: '#C8C0E0', padding: '6px 8px', background: i % 2 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 4 }}>{b}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </Backdrop>
  );
}

// ── Result overlay ──────────────────────────────────────────────────────────
function ResultOverlay({ win, onClose }) {
  return (
    <Backdrop onClose={onClose} dim>
      <div style={{
        textAlign: 'center', padding: '30px 24px',
        background: win
          ? 'radial-gradient(120% 80% at 50% 0%,rgba(212,168,67,.24),rgba(212,168,67,0) 60%),#141018'
          : 'radial-gradient(120% 80% at 50% 0%,rgba(239,68,68,.2),rgba(239,68,68,0) 60%),#141018',
        border: win ? '1px solid rgba(212,168,67,.35)' : '1px solid rgba(239,68,68,.3)',
        borderRadius: 20,
        boxShadow: win ? '0 0 60px rgba(212,168,67,.25)' : '0 0 40px rgba(239,68,68,.15)',
        maxWidth: 320, width: '100%',
        animation: 'ccPop .4s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <div style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: win ? '#F0C85A' : '#EF4444' }}>
          {win ? 'Победа' : 'Поражение'}
        </div>
        <div style={{
          marginTop: 10, fontSize: '2rem', fontWeight: 900, letterSpacing: '-.03em',
          color: '#EAE2CC', lineHeight: 1.1,
        }}>
          {win ? 'Шах и мат!' : 'Мат'}
        </div>
        {win && (
          <div style={{ margin: '20px auto 0', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Coin size={36} />
            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em', textShadow: '0 0 20px rgba(212,168,67,.5)' }}>
              +1,000
            </span>
          </div>
        )}
        <div style={{
          margin: '18px auto 0', display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '6px 14px', borderRadius: 9999,
          background: win ? 'rgba(61,186,122,.1)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${win ? 'rgba(61,186,122,.25)' : 'rgba(239,68,68,.25)'}`,
          color: win ? '#6FEDB0' : '#EF4444', fontWeight: 800, fontSize: '.82rem',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {win ? <ArrowUpIcon size={13} stroke={2.4} /> : <ArrowDownIcon size={13} stroke={2.4} />}
          ELO {win ? '+12' : '−8'} → <span style={{ color: '#EAE2CC' }}>{win ? '1832' : '1812'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 22 }}>
          <PressButton onClick={onClose}>Разбор</PressButton>
          <PressButton primary onClick={onClose}>Реванш</PressButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ── Backdrop ────────────────────────────────────────────────────────────────
function Backdrop({ children, align, onClose, dim }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: dim ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.45)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: align === 'bottom' ? 'flex-end' : 'center',
      justifyContent: 'center',
      padding: align === 'bottom' ? 0 : 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { GameScreenV2 });
