const jwt = require('jsonwebtoken');

// Генерируем токен с твоим Telegram ID
const userId = 1; // Это будет ID в БД (системный, не Telegram ID)
const telegramId = 254450353; // Твой Telegram ID

const token = jwt.sign(
  {
    userId,
    telegramId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 часа
  },
  'dev_access_secret_change_in_production'
);

console.log('✅ TOKEN ГОТОВ:\n');
console.log(token);
console.log('\n📋 ЧТО ДЕЛАТЬ:\n');
console.log('1. Копируй токен выше\n');
console.log('2. Открой http://localhost:5175\n');
console.log('3. Нажми F12 → откроется DevTools\n');
console.log('4. В консоли (Console tab) выполни:\n');
console.log(`   localStorage.setItem('accessToken', '${token}')`);
console.log(`   localStorage.setItem('refreshToken', '${token}')\n`);
console.log('5. Нажми F5 (refresh)\n');
console.log('✅ Готово! Приложение загрузится с твоим аккаунтом\n');
