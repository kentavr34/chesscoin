/**
 * ErrorBoundary.tsx
 * B3: Ловит ошибки React-рендера и показывает красивый экран вместо белого
 */

import React from 'react';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: Record<string, unknown>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ChessCoin] Uncaught error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#0B0D11',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
        <div style={{
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 18, fontWeight: 800,
          color: 'var(--accent, #F5C842)',
          marginBottom: 12,
        }}>
          Что-то пошло не так
        </div>
        <div style={{
          fontSize: 13, color: '#8B92A8',
          lineHeight: 1.6, marginBottom: 32, maxWidth: 300,
        }}>
          Произошла неожиданная ошибка. Попробуй перезагрузить приложение.
        </div>
        {this.state.error && (
          <div style={{
            fontSize: 10, color: '#3A3F58',
            fontFamily: 'monospace', marginBottom: 24,
            maxWidth: 300, wordBreak: 'break-all',
          }}>
            {this.state.error.message}
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '14px 32px',
            background: 'var(--accent, #F5C842)',
            border: 'none', borderRadius: 14,
            color: '#0B0D11', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ♟ Перезагрузить
        </button>
      </div>
    );
  }
}
