import React from 'react';
import { Modal, Button, Text } from '@/components/ui';

interface InsufficientAttemptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InsufficientAttemptsModal: React.FC<InsufficientAttemptsModalProps> = ({ isOpen, onClose }) => {
  const handleBuyAttempts = () => {
    onClose();
    // Открываем PurchaseAttemptsModal программно
    const event = new CustomEvent('open-purchase-attempts-modal');
    window.dispatchEvent(event);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Недостаточно попыток">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text variant="body" size="md" color="primary">
          У вас закончились попытки для участия в битве.
        </Text>
        <Text variant="body" size="sm" color="muted" style={{ marginTop: 8 }}>
          Приобретите дополнительные попытки, чтобы продолжить играть.
        </Text>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Button variant="secondary" size="lg" onClick={onClose} style={{ flex: 1 }}>
            Отмена
          </Button>
          <Button variant="danger" size="lg" onClick={handleBuyAttempts} style={{ flex: 1 }}>
            Купить попытки
          </Button>
        </div>
      </div>
    </Modal>
  );
};
