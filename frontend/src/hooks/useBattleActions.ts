import { useState } from 'react';
import { toast } from 'react-hot-toast';

export const useBattleActions = () => {
  const [loading, setLoading] = useState(false);

  const acceptChallenge = async (challengeId: string) => {
    setLoading(true);
    try {
      // Имитация запроса
      await new Promise(resolve => setTimeout(resolve, 1000));
      // В случае успеха
      toast.success('Вызов принят!');
    } catch (error: any) {
      if (error.message.includes('INSUFFICIENT_ATTEMPTS')) {
        // Программно открываем PurchaseAttemptsModal
        const event = new CustomEvent('open-purchase-attempts-modal');
        window.dispatchEvent(event);
        return;
      }
      toast.error(error.message || 'Ошибка при принятии вызова');
    } finally {
      setLoading(false);
    }
  };

  const createChallenge = async (opponentId: string, color: 'white' | 'black' | 'random') => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Вызов создан!');
    } catch (error: any) {
      if (error.message.includes('INSUFFICIENT_ATTEMPTS')) {
        const event = new CustomEvent('open-purchase-attempts-modal');
        window.dispatchEvent(event);
        return;
      }
      toast.error(error.message || 'Ошибка при создании вызова');
    } finally {
      setLoading(false);
    }
  };

  return {
    acceptChallenge,
    createChallenge,
    loading,
  };
};
