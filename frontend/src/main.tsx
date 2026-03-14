import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getActiveTheme, applyThemeToCss, THEMES } from '@/lib/theme';

// Initialize theme before render
applyThemeToCss(THEMES[getActiveTheme()]);

// Глобальные стили
const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body, #root { width: 100%; height: 100%; overflow: hidden; }
  body { background: #0B0D11; font-family: 'Inter', sans-serif; font-size: 15px; color: #F0F2F8; }
  ::-webkit-scrollbar { display: none; }
  @keyframes ring-pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.7;transform:scale(1.03)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(245,200,66,0.3)} 50%{box-shadow:0 0 40px rgba(245,200,66,0.6)} }
  @keyframes slide-up { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes fade-in { from{opacity:0} to{opacity:1} }
  button { font-family: inherit; }
  input { font-family: inherit; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
