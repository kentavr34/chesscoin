import React, { CSSProperties } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button — Единый компонент для всех кнопок
 * Использует дизайн-токены из index.css
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', style, ...props }, ref) => {
    const baseStyle: CSSProperties = {
      fontFamily: 'inherit',
      fontWeight: 'var(--font-weight-semibold)',
      border: 'none',
      borderRadius: 'var(--radius-m)',
      cursor: 'pointer',
      transition: `all var(--transition-normal) var(--ease-in-out)`,
      width: fullWidth ? '100%' : undefined,
    };

    // Размеры кнопок
    const sizeStyles: Record<ButtonSize, CSSProperties> = {
      sm: {
        padding: `8px var(--button-padding-x-sm)`,
        fontSize: 'var(--font-size-sm)',
        minHeight: 'var(--button-height-sm)',
      },
      md: {
        padding: `10px var(--button-padding-x-md)`,
        fontSize: 'var(--font-size-base)',
        minHeight: 'var(--button-height-md)',
      },
      lg: {
        padding: `12px var(--button-padding-x-lg)`,
        fontSize: 'var(--font-size-md)',
        minHeight: 'var(--button-height-lg)',
      },
    };

    // Стили вариантов
    const variantStyles: Record<ButtonVariant, CSSProperties> = {
      primary: {
        background: 'var(--color-accent)',
        color: 'var(--color-bg-dark)',
        fontWeight: 'var(--font-weight-bold)',
        boxShadow: '0 4px 20px rgba(245,200,66,0.2)',
      },
      secondary: {
        background: 'rgba(255,255,255,0.07)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border)',
      },
      tertiary: {
        background: 'transparent',
        color: 'var(--color-text-primary)',
        border: 'none',
      },
      danger: {
        background: 'rgba(255,77,106,0.1)',
        color: 'var(--color-red)',
        border: '1px solid rgba(255,77,106,0.2)',
      },
    };

    // Hover состояния
    const hoverStyles: Record<ButtonVariant, CSSProperties> = {
      primary: { opacity: 0.9, transform: 'scale(1.02)' },
      secondary: { background: 'rgba(255,255,255,0.12)' },
      tertiary: { opacity: 0.7 },
      danger: { background: 'rgba(255,77,106,0.15)' },
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      Object.assign(e.currentTarget.style, hoverStyles[variant]);
      props.onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      Object.assign(e.currentTarget.style, variantStyles[variant]);
      props.onMouseLeave?.(e);
    };

    const finalStyle: CSSProperties = {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    };

    return (
      <button
        ref={ref}
        style={finalStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
