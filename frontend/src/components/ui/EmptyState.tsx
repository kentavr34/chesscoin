/**
 * EmptyState — «здесь пусто» с иконкой/SVG + текстом.
 * Используется вместо голого «No items» / «Нет ещё ничего».
 *
 *   <EmptyState icon="🏆" title="No tournaments" desc="Проверьте позже" />
 */
import React from 'react';

interface Props {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  accent?: string;         // hex для бордера/фона иконки
  children?: React.ReactNode;  // для CTA-кнопки
}

export const EmptyState: React.FC<Props> = ({ icon = '🗒', title, desc, accent = '#9B6DFF', children }) => (
  <div style={{
    textAlign: 'center',
    padding: '40px 24px 32px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 20,
      background: `${accent}14`,
      border: `.5px solid ${accent}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, marginBottom: 6,
    }}>
      {icon}
    </div>
    <div style={{ fontSize: 15, fontWeight: 800, color: '#EAE2CC', lineHeight: 1.3 }}>{title}</div>
    {desc && (
      <div style={{ fontSize: 12, color: '#7A7875', lineHeight: 1.6, maxWidth: 280, whiteSpace: 'pre-line' }}>
        {desc}
      </div>
    )}
    {children && <div style={{ marginTop: 8 }}>{children}</div>}
  </div>
);
