import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { getActiveTheme, applyThemeToCss, THEMES } from '@/lib/theme';

// Initialize theme before render
applyThemeToCss(THEMES[getActiveTheme()]);

// Глобальные стили
const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; }
  body { background: #0B0D11; font-family: var(--font-main, 'Inter', sans-serif); font-size: 15px; color: #F0F2F8; }
  
  /* Принудительно применяем экипированный шрифт ко всем базовым текстовым элементам, переопределяя встроенные inline-стили */
  div, span, button, input { font-family: var(--font-main, 'Inter', sans-serif); }
  
  /* Исключения: моноширинные элементы и стилизованные заголовки */
  .mono { font-family: 'JetBrains Mono', monospace !important; }
  .title-brand { font-family: 'Unbounded', sans-serif !important; }

  ::-webkit-scrollbar { display: none; }
  @keyframes ring-pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.03)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(245,200,66,0.3)} 50%{box-shadow:0 0 40px rgba(245,200,66,0.6)} }
  @keyframes slide-up { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  @keyframes highlightPulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,214,143,0)} 50%{box-shadow:0 0 0 6px rgba(0,214,143,0.3)} }
  @keyframes floatCoin { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-70px);opacity:0} }
  @keyframes pieceBounce { 0%,100%{transform:scale(1)} 40%{transform:scale(1.18)} 70%{transform:scale(0.94)} }
  @keyframes pieceTeleport { 0%{transform:scale(1);opacity:1} 35%{transform:scale(0);opacity:0} 65%{transform:scale(1.15);opacity:0.8} 100%{transform:scale(1);opacity:1} }
  /* Применяются к фигурам через react-chessboard customPieces */
  .piece-bounce img  { animation: pieceBounce 0.3s ease-out; }
  .piece-teleport img { animation: pieceTeleport 0.4s ease-in-out; }
  .piece-fade img    { transition: opacity 0.15s ease; }
  /* Шах — пульсация клетки короля */
  @keyframes checkPulse { 0%,100%{background:rgba(255,77,106,0.15)} 50%{background:rgba(255,77,106,0.45)} }
  .check-square { animation: checkPulse 0.8s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }

  /* V1: Промоция — анимация появления модала */
  @keyframes promotionIn { from{transform:scale(0.7);opacity:0} to{transform:scale(1);opacity:1} }

  /* V2: Игровые события */
  @keyframes checkFlash { 0%{opacity:1} 100%{opacity:0} }
  @keyframes captureFlash { 0%{opacity:1} 100%{opacity:0} }
  @keyframes mateBannerIn { from{transform:scale(0.5)translateY(20px);opacity:0} to{transform:scale(1)translateY(0);opacity:1} }
  @keyframes fall {
    0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
    80%  { opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
  @keyframes starFloat {
    0%   { transform: scale(0) rotate(0deg);   opacity: 0; }
    30%  { transform: scale(1.3) rotate(180deg); opacity: 1; }
    100% { transform: scale(0) rotate(360deg); opacity: 0; }
  }
  /* V2: Взятие — расходящиеся кольца */
  @keyframes ringExpand {
    0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
  }
  @keyframes starBurst {
    0%   { transform: translate(-50%, -50%) scale(0) rotate(0deg);   opacity: 1; }
    50%  { transform: translate(-50%, -50%) scale(1.8) rotate(180deg); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(0) rotate(360deg); opacity: 0; }
  }
  /* V3: Стили для спецходов */
  @keyframes victoryPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.04)} }
  @keyframes neonFlicker { 0%,100%{opacity:1} 20%{opacity:0.7} 40%{opacity:1} 60%{opacity:0.85} 80%{opacity:1} }
  @keyframes fireShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-3px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-2px)} 80%{transform:translateX(2px)} }
  @keyframes iceFreeze { 0%{transform:scale(1.1);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes goldShine { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.4)} }
  @keyframes matrixGlitch { 0%,100%{clip-path:none} 30%{clip-path:inset(10% 0 80% 0)} 60%{clip-path:inset(50% 0 30% 0)} }
  @keyframes bloodDrip { 0%{transform:translateY(-10px);opacity:0} 50%{transform:translateY(3px);opacity:1} 100%{transform:translateY(0);opacity:1} }
  @keyframes galaxySpin { 0%{transform:rotate(-5deg) scale(0.9);opacity:0} 100%{transform:rotate(0deg) scale(1);opacity:1} }
  @keyframes rainbowShift { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
  @keyframes ghostFade { 0%,100%{opacity:1} 30%{opacity:0.3} 60%{opacity:0.8} }
  @keyframes lightningStrike { 0%{transform:scaleX(0.8);opacity:0} 10%{transform:scaleX(1.1);opacity:1} 20%{opacity:0.7} 30%{opacity:1} 100%{opacity:1} }
  @keyframes dragonBurn { 0%{transform:scale(0.5) rotate(-10deg);opacity:0} 60%{transform:scale(1.05) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
  @keyframes fadeSlideUp { 0%{transform:translateY(16px);opacity:0} 30%{transform:translateY(-3px);opacity:1} 100%{transform:translateY(0);opacity:1} }
  button { font-family: inherit; }
  input { font-family: inherit; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
