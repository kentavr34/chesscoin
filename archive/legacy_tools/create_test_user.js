const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  user: 'chesscoin',
  password: 'devpass123',
  host: 'localhost',
  port: 5432,
  database: 'chesscoin',
});

async function createTestUser() {
  try {
    // 1. Создаём пользователя
    const result = await pool.query(
      `INSERT INTO "User" (id, "telegramId", username, avatar, balance, "createdAt", "updatedAt")
       VALUES (DEFAULT, 254450353, 'TestPlayer', NULL, 10000, NOW(), NOW())
       ON CONFLICT ("telegramId") DO UPDATE SET username = 'TestPlayer', balance = 10000
       RETURNING id, "telegramId"`
    );

    const userId = result.rows[0].id;
    console.log(`✅ User created: ID=${userId}, Telegram=${result.rows[0].telegramId}`);

    // 2. Генерируем JWT token
    const token = jwt.sign(
      { userId, telegramId: 254450353 },
      'dev_access_secret_change_in_production',
      { expiresIn: '2h' }
    );

    console.log(`\n🔑 TOKEN (копируй в консоль):\n${token}\n`);

    // 3. Инструкции
    console.log(`📋 ИНСТРУКЦИЯ:\n`);
    console.log(`1. Открой http://localhost:5175`);
    console.log(`2. Открой DevTools (F12) → Application → Local Storage`);
    console.log(`3. В консоли выполни:\n`);
    console.log(`   localStorage.setItem('accessToken', '${token}')`);
    console.log(`   localStorage.setItem('refreshToken', '${token}')`);
    console.log(`\n4. Нажми F5 → готово!`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();
