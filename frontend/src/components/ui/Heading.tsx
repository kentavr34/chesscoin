import React, { CSSProperties } from 'react';

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';
type HeadingColor = 'primary' | 'accent' | 'danger';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  color?: HeadingColor;
  as?: HeadingLevel;
  children: React.ReactNode;
}

const headingStyles: Record<HeadingLevel, CSSProperties> = {
  h1: {
    fontSize: 'var(--heading-1-font-size)',
    fontWeight: 'var(--heading-1-font-weight)',
    lineHeight: 'var(--heading-1-line-height)',
    letterSpacing: 'var(--letter-spacing-tight)',
  },
  h2: {
    fontSize: 'var(--heading-2-font-size)',
    fontWeight: 'var(--heading-2-font-weight)',
    lineHeight: 'var(--line-height-tight)',
    letterSpacing: 'var(--letter-spacing-tight)',
  },
  h3: {
    fontSize: 'var(--heading-3-font-size)',
    fontWeight: 'var(--heading-3-font-weight)',
    lineHeight: 'var(--line-height-tight)',
  },
  h4: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-bold)',
    lineHeight: 'var(--line-height-tight)',
  },
};

const colorMap: Record<HeadingColor, string> = {
  primary: 'var(--color-text-primary)',
  accent: 'var(--color-accent)',
  danger: 'var(--color-red)',
};

/**
 * Heading — Компонент для заголовков
 * H1, H2, H3, H4 уровни с единым стилем
 */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 'h1', color = 'primary', as, className = '', style, children, ...props }, ref) => {
    const Component = (as || level) as any;
    const finalStyle: CSSProperties = {
      ...headingStyles[level],
      color: colorMap[color],
      margin: 0,
      ...style,
    };

    return (
      <Component
        ref={ref}
        style={finalStyle}
        className={className}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Heading.displayName = 'Heading';
