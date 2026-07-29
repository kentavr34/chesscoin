/**
 * CREATE_BATTLE_MODAL_TEMPLATE.tsx
 * Эталон модала «Создать партию» (батл).
 * Последнее обновление: 2026-04-29
 *
 * Ключевые параметры:
 *   paddingBottom: calc(72px + env(safe-area-inset-bottom, 0px))
 *   maxWidth: 420, borderRadius: 24px 24px 0 0
 *   Цвет ячейки: padding 14px 8px, gap 8, fontSize 0.96rem, grid gap 8, underline width 18
 *   Время ячейки: padding 14px 6px, fontSize 1.44rem, МИН 0.76rem, marginTop 4, grid gap 7
 *                  bg rgba(255,255,255,.05), border rgba(255,255,255,.1)
 */

// ── Оверлей (общий паттерн для bottom-sheet модалов) ──────────────────────────
//
// <div
//   onClick={(e) => e.target === e.currentTarget && onClose()}
//   style={{
//     position: 'fixed', inset: 0, zIndex: 200,
//     background: 'rgba(4,3,8,.82)',
//     backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
//     display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
//     paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
//     paddingTop: 16,
//   }}
// >

// ── Панель ────────────────────────────────────────────────────────────────────
//
// <div style={{
//   width: '100%', maxWidth: 420,
//   background: 'linear-gradient(170deg,#100C18,#0A080E)',
//   border: '.5px solid rgba(212,168,67,.2)',
//   borderRadius: '24px 24px 0 0',
//   padding: '0 0 8px',
//   boxShadow: '0 -16px 48px rgba(0,0,0,.6), 0 -1px 0 rgba(212,168,67,.1)',
// }}>

// ── Drag handle ───────────────────────────────────────────────────────────────
//
// <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
//   <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(212,168,67,.2)' }} />
// </div>

// ── Секция-метка (section label) ──────────────────────────────────────────────
//
// <div style={{
//   fontSize: '.52rem', fontWeight: 700, color: '#6A5A30',
//   textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 6,
// }}>LABEL</div>

// ── Ячейки выбора ЦВЕТА ───────────────────────────────────────────────────────
//
// <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
//   <button style={{
//     borderRadius: 12, padding: '14px 8px',
//     display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
//     transition: 'all .15s', transform: 'scale(1)',
//     /* active: boxShadow: `0 0 12px ${activeBorder}40` */
//   }}>
//     <Icon />  {/* размер 33×33 */}
//     <span style={{ fontSize: '0.96rem', fontWeight: 800, letterSpacing: '.02em' }}>Метка</span>
//     {/* активный индикатор: */}
//     <div style={{ width: 18, height: 2, borderRadius: 1, background: activeBorder }} />
//   </button>
// </div>

// ── Ячейки выбора ВРЕМЕНИ ─────────────────────────────────────────────────────
//
// <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
//   <button style={{
//     background: active ? 'rgba(212,168,67,.16)' : 'rgba(255,255,255,.05)',
//     border: `.5px solid ${active ? 'rgba(212,168,67,.6)' : 'rgba(255,255,255,.1)'}`,
//     borderRadius: 10, padding: '14px 6px',
//     transition: 'all .15s', transform: 'scale(1)',
//     boxShadow: active ? '0 0 10px rgba(212,168,67,.22)' : 'none',
//   }}>
//     <div style={{ fontSize: '1.44rem', fontWeight: 900, lineHeight: 1 }}>{mins}</div>
//     <div style={{ fontSize: '.76rem', fontWeight: 700, letterSpacing: '.06em', marginTop: 4 }}>МИН</div>
//   </button>
// </div>

// ── Кнопка действия ───────────────────────────────────────────────────────────
//
// <button style={{
//   width: '100%', padding: '14px',
//   background: 'linear-gradient(135deg,#3A2A08,#5A4010)',
//   border: '.5px solid rgba(212,168,67,.5)',
//   borderRadius: 14,
//   fontFamily: 'Inter, sans-serif', fontSize: '.9rem', fontWeight: 900, letterSpacing: '.06em',
//   color: '#F0C85A', cursor: 'pointer',
//   boxShadow: '0 4px 20px rgba(212,168,67,.18)',
// }}>ДЕЙСТВИЕ</button>

// ── Active-state CSS (вставить через <style>) ─────────────────────────────────
//
// .cbm-col:active  { opacity: .7; transform: scale(.93) !important; }
// .cbm-time:active { transform: scale(.91) !important; }
// @keyframes cbm-shine { 0%{left:-100%} 100%{left:200%} }
