/**
 * useWarChallengeStore.ts
 * W1: Глобальный стор для попапа вызова на военную дуэль
 * useSocket устанавливает warChallenge, App.tsx рендерит WarChallengePopup
 */

import { create } from 'zustand';

interface WarChallengeData {
  sessionId: string;
  sessionCode: string;
  warId: string;
  challengerUserId: string;
  challengerName?: string;
  challengerCountry?: string;
  challengerFlag?: string;
}

interface WarChallengeStore {
  warChallenge: WarChallengeData | null;
  setWarChallenge: (data: WarChallengeData | null) => void;
}

export const useWarChallengeStore = create<WarChallengeStore>((set) => ({
  warChallenge: null,
  setWarChallenge: (data) => set({ warChallenge: data }),
}));
