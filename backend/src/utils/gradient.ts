// Генерирует уникальный градиент на основе telegramId
// Не хранится в БД как строка — генерируется на лету
// Одинаковый результат для одного и того же ID

const GRADIENTS = [
  ["#667eea", "#764ba2"], // фиолетово-синий
  ["#f093fb", "#f5576c"], // розово-красный
  ["#4facfe", "#00f2fe"], // голубой
  ["#43e97b", "#38f9d7"], // зелёный
  ["#fa709a", "#fee140"], // розово-жёлтый
  ["#a18cd1", "#fbc2eb"], // лавандовый
  ["#fccb90", "#d57eeb"], // персиково-фиолетовый
  ["#a1c4fd", "#c2e9fb"], // небесно-голубой
  ["#fd7043", "#ffb300"], // оранжевый
  ["#26c6da", "#00acc1"], // бирюзовый
  ["#66bb6a", "#43a047"], // зелёный
  ["#ab47bc", "#7b1fa2"], // тёмно-фиолетовый
];

export const generateGradient = (telegramId: string): string => {
  // Простой детерминированный хэш из строки
  let hash = 0;
  for (let i = 0; i < telegramId.length; i++) {
    hash = telegramId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }

  const index = Math.abs(hash) % GRADIENTS.length;
  const angle = Math.abs(hash) % 360;
  const [color1, color2] = GRADIENTS[index];

  return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
};

// Возвращает CSS-класс или inline стиль для аватара
export const getAvatarStyle = (gradient: string) => ({
  background: gradient,
});
