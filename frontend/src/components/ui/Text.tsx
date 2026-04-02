import React, { CSSProperties } from 'react';

type TextVariant = 'body' | 'caption' | 'label' | 'code';
type TextSize = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl';
type TextColor = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'success';

interface TextProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TextVariant;
  size?: TextSize;
  color?: TextColor;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  as?: 'p' | 'span' | 'div' | 'small';
  children: React.ReactNode;
}

const colorMap: Record<TextColor, string> = {
  primary: 'var(--color-text-primary)',
  secondary: 'var(--color-text-secondary)',
  muted: 'var(--color-text-muted)',
  accent: 'var(--color-accent)',
  danger: 'var(--color-red)',
  success: 'var(--color-green)',
};

const sizeMap: Record<TextSize, string> = {
  xs: 'var(--font-size-xs)',
  sm: 'var(--font-size-sm)',
  base: 'var(--font-size-base)',
  md: 'var(--font-size-md)',
  lg: 'var(--font-size-lg)',
  xl: 'var(--font-size-xl)',
};

const weightMap: Record<string, string> = {
  regular: 'var(--font-weight-regular)',
  medium: 'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold: 'var(--font-weight-bold)',
  extrabold: 'var(--font-weight-extrabold)',
};

/**
 * Text — Единый компонент для текста
 * Использует дизайн-токены из index.css
 */
export const Text = React.forwardRef<HTMLDivElement, TextProps>(
  (
    {
      variant = 'body',
      size = 'base',
      color = 'primary',
      weight = 'regular',
      as = 'div',
      className = '',
      style,
      children,
      ...props
    },
    ref
  ) => {
    const variantDefaults: Record<TextVariant, { size: TextSize; weight: string; lineHeight: string }> = {
      body: { size: 'base', weight: 'regular', lineHeight: 'var(--line-height-normal)' },
      caption: { size: 'xs', weight: 'regular', lineHeight: 'var(--line-height-tight)' },
      label: { size: 'sm', weight: 'semibold', lineHeight: 'var(--line-height-normal)' },
      code: { size: 'sm', weight: 'medium', lineHeight: 'var(--line-height-normal)' },
    };

    const variantDefault = variantDefaults[variant];

    const baseStyle: CSSProperties = {
      fontSize: sizeMap[size || variantDefault.size],
      fontWeight: weightMap[weight || variantDefault.weight],
      color: colorMap[color],
      lineHeight: variantDefault.lineHeight,
      margin: 0,
      ...style,
    };

    const Component = as as any;

    return (
      <Component
        ref={ref}
        style={baseStyle}
        className={className}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Text.displayName = 'Text';
