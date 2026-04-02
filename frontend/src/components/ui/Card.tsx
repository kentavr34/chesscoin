import React, { CSSProperties } from 'react';

type CardPadding = 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  interactive?: boolean;
  children: React.ReactNode;
}

const paddingMap: Record<CardPadding, string> = {
  sm: 'var(--card-padding-sm)',
  md: 'var(--card-padding-md)',
  lg: 'var(--card-padding-lg)',
  xl: 'var(--card-padding-xl)',
};

/**
 * Card — Базовый компонент карточки
 * Используется для любых контейнеров контента
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'lg', interactive = false, className = '', style, children, ...props }, ref) => {
    const baseStyle: CSSProperties = {
      padding: paddingMap[padding],
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-l)',
      transition: 'all var(--transition-normal) var(--ease-in-out)',
      cursor: interactive ? 'pointer' : undefined,
      ...style,
    };

    const onMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        Object.assign(e.currentTarget.style, {
          borderColor: 'var(--color-border-light)',
          transform: 'translateY(-2px)',
          boxShadow: 'var(--shadow-md)',
        });
      }
      props.onMouseEnter?.(e);
    };

    const onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        Object.assign(e.currentTarget.style, {
          borderColor: 'var(--color-border)',
          transform: 'translateY(0)',
          boxShadow: 'none',
        });
      }
      props.onMouseLeave?.(e);
    };

    return (
      <div
        ref={ref}
        style={baseStyle}
        className={className}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
