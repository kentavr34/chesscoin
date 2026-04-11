import React from 'react';

interface ColorSelectionProps {
  selected: 'white' | 'black' | 'random';
  onSelect: (color: 'white' | 'black' | 'random') => void;
}

export const ColorSelection: React.FC<ColorSelectionProps> = ({ selected, onSelect }) => {
  const colors = [
    { value: 'white', label: 'Белые' },
    { value: 'black', label: 'Чёрные' },
    { value: 'random', label: 'Случайно' },
  ] as const;

  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
      {colors.map(({ value, label }) => (
        <div
          key={value}
          onClick={() => onSelect(value)}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(212, 168, 67, 0.3)',
            border: `1px solid white`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: value === 'white' ? '#F0F2F8' : value === 'black' ? '#1A1A23' : 'linear-gradient(135deg, #F0F2F8 50%, #1A1A23 50%)',
            }}
          />
        </div>
      ))}
    </div>
  );
};
