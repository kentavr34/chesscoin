import React, { useState } from 'react';
import { Modal, Button, Text } from '@/components/ui';

interface PurchaseAttemptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ATTEMPT_PACKS = [
  { id: 1, amount: 5, price: 50, description: 'Базовый пакет' },
  { id: 2, amount: 10, price: 90, description: 'Выгодный пакет' },
  { id: 3, amount: 20, price: 160, description: 'Максимальный пакет' },
];

export const PurchaseAttemptsModal: React.FC<PurchaseAttemptsModalProps> = ({ isOpen, onClose }) => {
  const [selectedPack, setSelectedPack] = useState(ATTEMPT_PACKS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    setIsLoading(true);
    // Имитация запроса
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Покупка попыток">
      <div style={{ padding: '20px' }}>
        <Text variant="body" size="md" color="primary" style={{ marginBottom: 16 }}>
          Выберите пакет попыток:
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ATTEMPT_PACKS.map(pack => (
            <div
              key={pack.id}
              onClick={() => setSelectedPack(pack)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${selectedPack.id === pack.id ? '#D4A843' : 'transparent'}`,
                background: '#1A1A23',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Text variant="label" size="md" color="primary" style={{ fontWeight: 600, fontSize: '18px' }}>
                {pack.amount} попыток
              </Text>
              <Text variant="body" size="sm" color="muted" style={{ fontSize: '14px' }}>
                {pack.description}
              </Text>
              <Text variant="label" size="lg" color="accent" style={{ marginTop: 4, fontSize: '20px' }}>
                {pack.price} ᚙ
              </Text>
            </div>
          ))}
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={handlePurchase}
          loading={isLoading}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px 16px',
            fontSize: '16px',
            fontWeight: 600,
            borderRadius: '12px',
          }}
        >
          Купить {selectedPack.amount} попыток за {selectedPack.price} ᚙ
        </Button>
      </div>
    </Modal>
  );
};
