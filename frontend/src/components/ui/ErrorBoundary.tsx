/**
 * ErrorBoundary.tsx
 * B3: Ловит ошибки React-рендера и показывает красивый экран вместо белого
 */

import React from 'react';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
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
        background: 'var(--color-bg-dark, #0B0D11)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
        <div style={{
          fontFamily: "'Unbounded',sans-serif",
          fontSize: 18, fontWeight: 800,
          color: 'var(--color-accent, #F5C842)',
          marginBottom: 12,
        }}>
          Something went wrong
        </div>
        <div style={{
          fontSize: 13, color: 'var(--color-text-secondary, #8B92A8)',
          lineHeight: 1.6, marginBottom: 32, maxWidth: 300,
        }}>
          An unexpected error occurred. Try reloading the app.
        </div>
        {this.state.error && (
          <>
          <div style={{
            fontSize: 10, color: 'var(--color-red, #FF4D6A)',
            fontFamily: 'monospace', marginBottom: 8,
            maxWidth: 340, wordBreak: 'break-all',
          }}>
            {this.state.error.message}
          </div>
          <div style={{
            fontSize: 8, color: 'var(--color-text-muted, #4A5270)',
            fontFamily: 'monospace', marginBottom: 24,
            maxWidth: 340, wordBreak: 'break-all',
            maxHeight: 120, overflow: 'auto',
            textAlign: 'left', lineHeight: 1.4,
            background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8,
          }}>
            {this.state.error.stack}
          </div>
          </>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '14px 32px',
            background: 'var(--color-accent, #F5C842)',
            border: 'none', borderRadius: 14,
            color: 'var(--color-bg-dark, #0B0D11)', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ♟ Reload
        </button>
      </div>
    );
  }
}
