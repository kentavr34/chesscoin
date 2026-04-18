// Нативное подтверждение Telegram WebApp — надёжно отображается поверх,
// в отличие от window.confirm (иногда уезжает ниже экрана в TMA).
// Fallback: window.confirm (браузер / не-TMA среда).

export const tgConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.showConfirm === 'function') {
      try {
        tg.showConfirm(message, (ok: boolean) => resolve(!!ok));
        return;
      } catch {
        // fallthrough
      }
    }
    resolve(window.confirm(message));
  });
};

export const tgAlert = (message: string): Promise<void> => {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp as any;
    if (tg && typeof tg.showAlert === 'function') {
      try {
        tg.showAlert(message, () => resolve());
        return;
      } catch {}
    }
    window.alert(message);
    resolve();
  });
};
