// AnalysisModal — PGN replay modal with eval bar, arrows, move list,
// analysis panel, and stage switcher (opening / middle-check / endgame-mate).

function AnalysisModal({ onClose }) {
  const [stage, setStage] = React.useState('opening'); // opening | middle | endgame
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [panelOpen, setPanelOpen] = React.useState(true);

  const stages = {
    opening: {
      idx: 6, total: 47,
      position: SAMPLE_POSITION,
      lastMove: { from: 'f1', to: 'b5' },
      arrows: [
        { from: 'b5', to: 'c6', color: 'blue'  },
        { from: 'g8', to: 'f6', color: 'green' },
      ],
      checkSq: null,
      eval: +0.4,
      bestMove: 'Nf6',
      explain: 'Испанская партия. Чёрным важно развить коня, не позволяя белым захватить центр.',
    },
    middle: {
      idx: 22, total: 47,
      position: CHECK_POSITION,
      lastMove: { from: 'd8', to: 'h4' },
      arrows: [
        { from: 'e1', to: 'e2', color: 'green' },
        { from: 'h4', to: 'f2', color: 'blue'  },
      ],
      checkSq: 'e1',
      eval: -3.2,
      bestMove: 'Ke2',
      explain: 'Ферзь прорывается к короне. Единственный разумный ответ — Ke2, но позиция остаётся проигранной.',
    },
    endgame: {
      idx: 47, total: 47,
      position: MATE_POSITION,
      lastMove: { from: 'c4', to: 'f7' },
      arrows: [],
      checkSq: 'g8',
      eval: +99,
      bestMove: 'Мат',
      explain: 'Спёртый мат: конь на f7 + ферзь на c4 замыкают короля, запертого собственной ладьёй.',
    },
  };
  const s = stages[stage];
  const result = stage === 'endgame' ? '1-0' : '1-0';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: '#0B0B10',
      display: 'flex', flexDirection: 'column',
      animation: 'ccPop .28s cubic-bezier(.34,1.56,.64,1)',
    }}>
      <AnalysisHeader onClose={onClose} />
      <MetaRow stage={s} result={result} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 .85rem 16px' }} className="cc-scroll">
        <StageSwitcher stage={stage} onStage={setStage} />
        <BoardWithEval s={s} />
        <Playback playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} idx={s.idx} total={s.total} />
        <MoveList currentIdx={s.idx} />
        <AnalysisPanel s={s} open={panelOpen} onToggle={() => setPanelOpen(!panelOpen)} />
        <BottomCTAs />
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function AnalysisHeader({ onClose }) {
  return (
    <div style={{
      flexShrink: 0, padding: '10px .85rem 10px',
      background: 'linear-gradient(180deg,#0D0D12,#0B0B10)',
      borderBottom: '1px solid rgba(255,255,255,.05)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div onClick={onClose} style={{
        width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.05)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#F4F0E8',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '.5rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#7A7875' }}>Разбор</div>
        <div style={{ fontSize: '.92rem', fontWeight: 800, color: '#EAE2CC', letterSpacing: '-.02em' }}>Партия #3241</div>
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: 'rgba(212,168,67,.1)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#F0C85A',
        border: '1px solid rgba(212,168,67,.3)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
          <path d="M16 6l-4-4-4 4M12 2v14"/>
        </svg>
      </div>
    </div>
  );
}

// ── Meta row ───────────────────────────────────────────────────────────────
function MetaRow({ stage, result }) {
  const white = { name: 'AlexKing_42', elo: 1820, tone: 'gold' };
  const black = { name: 'Magnus_27',   elo: 2340, tone: 'purple' };
  return (
    <div style={{
      flexShrink: 0, padding: '10px .85rem 8px',
      background: '#0D0D12',
      borderBottom: '1px solid rgba(255,255,255,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlayerTag p={white} side="white" />
        <div style={{
          padding: '4px 10px', borderRadius: 8,
          background: result === '1-0' ? 'rgba(61,186,122,.12)' : result === '0-1' ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.04)',
          border: `1px solid ${result === '1-0' ? 'rgba(61,186,122,.35)' : result === '0-1' ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.08)'}`,
          fontSize: '.78rem', fontWeight: 900,
          fontFamily: 'ui-monospace,SF Mono,monospace',
          fontVariantNumeric: 'tabular-nums',
          color: result === '1-0' ? '#6FEDB0' : result === '0-1' ? '#EF4444' : '#C8C0E0',
        }}>{result}</div>
        <PlayerTag p={black} side="black" align="right" />
      </div>
      <div style={{
        marginTop: 6, display: 'flex', justifyContent: 'space-between',
        fontSize: '.58rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7A7875',
      }}>
        <span>18 марта</span>
        <span>·</span>
        <span>24 мин</span>
        <span>·</span>
        <span style={{ color: '#C4A8FF' }}>Блиц 5+0</span>
      </div>
    </div>
  );
}

function PlayerTag({ p, side, align }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexDirection: align === 'right' ? 'row-reverse' : 'row', minWidth: 0 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 5,
        background: side === 'white' ? '#F4F0E8' : '#1A1620',
        border: '1px solid rgba(212,168,67,.25)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '.9rem', color: side === 'white' ? '#0D0D12' : '#F4F0E8', flexShrink: 0,
      }}>{side === 'white' ? '♔' : '♚'}</div>
      <div style={{ minWidth: 0, textAlign: align }}>
        <div style={{ fontSize: '.76rem', fontWeight: 700, color: '#F4F0E8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize: '.58rem', color: '#7A7875', fontWeight: 700 }}>ELO {p.elo}</div>
      </div>
    </div>
  );
}

// ── Stage switcher ─────────────────────────────────────────────────────────
function StageSwitcher({ stage, onStage }) {
  const opts = [
    { id: 'opening', label: 'Дебют' },
    { id: 'middle',  label: 'Шах'   },
    { id: 'endgame', label: 'Мат'   },
  ];
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3, marginTop: 10,
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 10,
    }}>
      {opts.map((o) => (
        <div key={o.id} onClick={() => onStage(o.id)} style={{
          flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 8,
          fontSize: '.68rem', fontWeight: 800, letterSpacing: '.04em', cursor: 'pointer',
          background: stage === o.id ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
          color: stage === o.id ? '#0D0D12' : '#7A7875',
        }}>{o.label}</div>
      ))}
    </div>
  );
}

// ── Board + eval bar ───────────────────────────────────────────────────────
function BoardWithEval({ s }) {
  const evalClamped = Math.max(-10, Math.min(10, s.eval));
  const whitePct = 50 + (evalClamped / 20) * 100;
  const evalLabel = Math.abs(s.eval) >= 99 ? (s.eval > 0 ? 'M' : '-M') : (s.eval > 0 ? `+${s.eval.toFixed(1)}` : s.eval.toFixed(1));
  return (
    <div style={{ display: 'flex', gap: 8, padding: '12px 0', alignItems: 'flex-start' }}>
      <div style={{
        width: 14, height: 330, borderRadius: 4, overflow: 'hidden',
        background: '#1A1620', position: 'relative',
        border: '1px solid rgba(255,255,255,.08)',
        display: 'flex', flexDirection: 'column-reverse',
      }}>
        <div style={{
          height: `${whitePct}%`,
          background: 'linear-gradient(180deg,#F4F0E8,#C8C0A8)',
          transition: 'height .4s',
        }} />
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: '50%', height: 1, background: 'rgba(212,168,67,.4)',
        }} />
        <div style={{
          position: 'absolute', left: '50%', transform: 'translate(-50%,-50%)',
          top: s.eval > 0 ? '92%' : '8%',
          fontSize: '.5rem', fontWeight: 900, letterSpacing: '.04em',
          color: s.eval > 0 ? '#0D0D12' : '#F4F0E8',
          writingMode: 'vertical-rl', transform: 'translate(-50%,-50%) rotate(180deg)',
          whiteSpace: 'nowrap',
        }}>{evalLabel}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <ChessBoard position={s.position} size={310}
          lastMove={s.lastMove} checkSq={s.checkSq} arrows={s.arrows} />
      </div>
    </div>
  );
}

// ── Playback controls ──────────────────────────────────────────────────────
function Playback({ playing, setPlaying, speed, setSpeed, idx, total }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 14,
      background: '#141018', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <PBtn><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5v14h2V5H6zm4 7 10-7v14z"/></svg></PBtn>
          <PBtn><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 5l-10 7 10 7z"/></svg></PBtn>
          <PBtn primary onClick={() => setPlaying(!playing)}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l14-8z"/></svg>
            )}
          </PBtn>
          <PBtn><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 5l10 7-10 7z"/></svg></PBtn>
          <PBtn><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5v14h2V5h-2zm-4 7L4 5v14z"/></svg></PBtn>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, padding: 2, background: 'rgba(255,255,255,.03)', borderRadius: 7 }}>
          {[0.5, 1, 2].map((s) => (
            <div key={s} onClick={() => setSpeed(s)} style={{
              padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
              fontSize: '.62rem', fontWeight: 800,
              background: speed === s ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
              color: speed === s ? '#0D0D12' : '#7A7875',
            }}>{s}x</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '.7rem', fontWeight: 800, color: '#F0C85A', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace,SF Mono,monospace' }}>{idx}</span>
        <div style={{
          flex: 1, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 9999, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${(idx / total) * 100}%`,
            background: 'linear-gradient(90deg,#F0C85A,#D4A843)',
            borderRadius: 9999,
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: `${(idx / total) * 100}%`,
            transform: 'translate(-50%,-50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: '#F0C85A', boxShadow: '0 0 0 3px rgba(212,168,67,.25),0 2px 6px rgba(0,0,0,.4)',
          }} />
        </div>
        <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#7A7875', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace,SF Mono,monospace' }}>/{total}</span>
      </div>
    </div>
  );
}

function PBtn({ children, primary, onClick }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        width: primary ? 40 : 32, height: 32, borderRadius: 8,
        background: primary ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'rgba(255,255,255,.05)',
        color: primary ? '#0D0D12' : '#C8C0E0',
        border: primary ? 'none' : '1px solid rgba(255,255,255,.08)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transform: pressed ? 'scale(.92)' : 'scale(1)',
        transition: 'transform .12s',
        fontFamily: 'inherit',
      }}>{children}</button>
  );
}

// ── Move list ──────────────────────────────────────────────────────────────
function MoveList({ currentIdx }) {
  // (moveNum, white, black, annotation) — annotation: '?' bad, '!' brilliant
  const moves = [
    [1,  'e4',    'e5',    null, null],
    [2,  'Nf3',   'Nc6',   null, null],
    [3,  'Bb5',   'a6',    null, null],
    [4,  'Ba4',   'Nf6',   '!',  null],
    [5,  'O-O',   'Be7',   null, null],
    [6,  'Re1',   'b5',    null, null],
    [7,  'Bb3',   'd6',    null, null],
    [8,  'c3',    'O-O',   null, null],
    [9,  'h3',    'Nb8',   null, '?'],
    [10, 'd4',    'Nbd7',  null, null],
    [11, 'Nbd2',  'Bb7',   null, null],
    [12, 'Bc2',   'Re8',   null, '!'],
    [13, 'a4',    'Bf8',   null, null],
    [14, 'Bd3',   'c6',    null, null],
    [15, 'b4',    'exd4',  null, '?'],
    [16, 'cxd4',  'd5',    null, null],
    [17, 'e5',    'Ne4',   null, null],
    [18, 'Nxe4',  'dxe4',  null, null],
    [19, 'Bxe4',  'Qxh4',  '!',  null],
    [20, 'g3',    'Qh5',   null, null],
    [21, 'Kg2',   'Bxd4',  null, '?'],
    [22, 'Qxd4',  'Rad8',  null, null],
    [23, 'Qf4',   'Qe2',   null, null],
    [24, 'Nxf7#', null,    '!',  null],
  ];

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 14,
      background: '#141018', border: '1px solid rgba(255,255,255,.06)',
      maxHeight: 140, overflowY: 'auto',
    }} className="cc-scroll">
      <div style={{ fontSize: '.56rem', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7A7875', marginBottom: 6 }}>
        Партия · 1-0
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 1fr',
        gap: 2, rowGap: 3,
        fontFamily: 'ui-monospace,SF Mono,monospace',
      }}>
        {moves.map(([n, w, b, wa, ba]) => {
          const whiteIdx = (n - 1) * 2 + 1;
          const blackIdx = (n - 1) * 2 + 2;
          return (
            <React.Fragment key={n}>
              <div style={{ fontSize: '.72rem', color: '#7A7875', fontWeight: 700, paddingTop: 3 }}>{n}.</div>
              <MoveCell move={w} annot={wa} active={currentIdx === whiteIdx} />
              <MoveCell move={b} annot={ba} active={currentIdx === blackIdx} dark />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function MoveCell({ move, annot, active, dark }) {
  if (!move) return <div />;
  const color =
    annot === '?' ? '#EF4444' :
    annot === '!' ? '#6FEDB0' :
    (active ? '#0D0D12' : (dark ? '#C8C0E0' : '#F4F0E8'));
  return (
    <div style={{
      fontSize: '.82rem', fontWeight: active ? 900 : 700,
      padding: '3px 8px', borderRadius: 6,
      background: active ? 'linear-gradient(180deg,#F0C85A,#D4A843)' : 'transparent',
      color,
      boxShadow: active ? '0 2px 8px rgba(212,168,67,.3)' : 'none',
      display: 'inline-flex', alignItems: 'center', gap: 3, width: 'max-content',
    }}>
      {move}
      {annot && (
        <span style={{
          fontSize: '.7rem', fontWeight: 900,
          color: active ? '#0D0D12' : (annot === '?' ? '#EF4444' : '#6FEDB0'),
        }}>{annot}</span>
      )}
    </div>
  );
}

// ── Analysis panel ─────────────────────────────────────────────────────────
function AnalysisPanel({ s, open, onToggle }) {
  const tone = s.eval >= 0 ? 'good' : 'bad';
  const evalTxt = Math.abs(s.eval) >= 99
    ? (s.eval > 0 ? 'Мат в 1' : 'Мат')
    : `${s.eval > 0 ? '+' : ''}${s.eval.toFixed(1)} у ${s.eval >= 0 ? 'белых' : 'чёрных'}`;
  return (
    <div style={{
      marginTop: 10, borderRadius: 14, overflow: 'hidden',
      background: '#141018', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', cursor: 'pointer',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: tone === 'good' ? 'rgba(61,186,122,.12)' : 'rgba(239,68,68,.12)',
          color: tone === 'good' ? '#6FEDB0' : '#EF4444',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${tone === 'good' ? 'rgba(61,186,122,.3)' : 'rgba(239,68,68,.3)'}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4zM8 14l4 3 4-3M7 18l5 3 5-3"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.58rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7A7875' }}>Нейро-разбор</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
            <span style={{ fontSize: '.92rem', fontWeight: 900, color: tone === 'good' ? '#6FEDB0' : '#EF4444', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{evalTxt}</span>
            <span style={{ fontSize: '.72rem', color: '#7A7875' }}>·</span>
            <span style={{ fontSize: '.72rem', color: '#C8C0E0' }}>Лучший: <b style={{ color: '#F4F0E8', fontFamily: 'ui-monospace,SF Mono,monospace' }}>{s.bestMove}</b></span>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A7875" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
             style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      {open && (
        <div style={{
          padding: '0 14px 14px', fontSize: '.78rem', color: '#C8C0E0', lineHeight: 1.5,
          borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#6FA8DC' }} />
            <span style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7A7875' }}>Синяя — ход игрока</span>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3DBA7A', marginLeft: 8 }} />
            <span style={{ fontSize: '.6rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7A7875' }}>Зелёная — движок</span>
          </div>
          {s.explain}
        </div>
      )}
    </div>
  );
}

// ── Bottom CTAs ────────────────────────────────────────────────────────────
function BottomCTAs() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, marginTop: 12 }}>
      <button style={{
        fontFamily: 'inherit', fontWeight: 900, fontSize: '.8rem', letterSpacing: '.04em',
        padding: '12px 12px', borderRadius: 12, cursor: 'pointer',
        background: 'linear-gradient(180deg,#F0C85A,#D4A843)',
        color: '#0D0D12', border: '1px solid rgba(212,168,67,.55)',
        boxShadow: '0 6px 20px rgba(212,168,67,.4)',
      }}>Сыграть отсюда</button>
      <button style={{
        fontFamily: 'inherit', fontWeight: 800, fontSize: '.8rem',
        padding: '12px 12px', borderRadius: 12, cursor: 'pointer',
        background: 'transparent', color: '#F0C85A',
        border: '1px solid rgba(212,168,67,.4)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 3 7 7 .6-5.3 4.7L18 22l-6-3.6L6 22l1.3-7.6L2 9.6 9 9z"/></svg>
        В избранное
      </button>
    </div>
  );
}

Object.assign(window, { AnalysisModal });
