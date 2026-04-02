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
      // DARK GLASSMORPHISM: gradient background с прозрачностью
      background: 'linear-gradient(135deg, rgba(28, 32, 48, 0.95) 0%, rgba(22, 25, 39, 0.95) 100%)',
      // Glassmorphism blur эффект
      backdropFilter: 'blur(16px)',
      // Light-catching border
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 'var(--radius-l)',
      // Deep shadows для depth
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      transition: 'all var(--transition-normal) var(--ease-in-out)',
      cursor: interactive ? 'pointer' : undefined,
      ...style,
    };

    const onMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(255, 255, 255, 0.2)',
          background: 'linear-gradient(135deg, rgba(31, 36, 56, 0.97) 0%, rgba(25, 23, 47, 0.97) 100%)',
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 20px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        });
      }
      props.onMouseEnter?.(e);
    };

    const onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(135deg, rgba(28, 32, 48, 0.95) 0%, rgba(22, 25, 39, 0.95) 100%)',
          transform: 'translateY(0)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
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
