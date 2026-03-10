// ── Haptic Feedback — обёртка над Telegram WebApp API ─────────────────────────
type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

const tg = () => (window as any).Telegram?.WebApp?.HapticFeedback;

export const haptic = {
  selection: () => tg()?.selectionChanged(),
  move:      () => tg()?.impactOccurred('medium'),
  capture:   () => tg()?.impactOccurred('heavy'),
  check:     () => { tg()?.impactOccurred('heavy'); setTimeout(() => tg()?.impactOccurred('heavy'), 100); },
  win:       () => tg()?.notificationOccurred('success'),
  lose:      () => tg()?.notificationOccurred('error'),
  impact:    (style: HapticStyle = 'medium') => tg()?.impactOccurred(style),
  notification: (type: HapticNotification) => tg()?.notificationOccurred(type),
};
