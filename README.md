# ChessCoin ♟️

> Шахматная Telegram Mini App с внутренней валютой ᚙ и P2P биржей

[![Version](https://img.shields.io/badge/version-v7.1.0-gold)](./MASTERPLAN.md)
[![Tests](https://img.shields.io/badge/tests-124%20passed-green)](./backend/src/__tests__)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./backend/tsconfig.json)

---

## 🏗 Стек

| Компонент | Технологии |
|-----------|-----------|
| Backend | Node.js + TypeScript + Express + Socket.io + Prisma + PostgreSQL + Redis |
| Frontend | React + Vite + TypeScript + Zustand + react-chessboard |
| Bot | Python 3.11 + aiogram 3 |
| Infrastructure | Docker Compose + nginx + Let's Encrypt |
| Хранилище | Timeweb S3 (аватары) |
| Блокчейн | TON (TonConnect 2.0, TonCenter API) |

---

## 🚀 Деплой на VPS (Timeweb / любой Ubuntu 22.04)

### 1. Требования к серверу

```
CPU: 2+ ядра
RAM: 4+ GB
Диск: 20+ GB SSD
OS: Ubuntu 22.04 LTS
Открытые порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

### 2. Установка зависимостей

```bash
# Обновляем систему
apt update && apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
newgrp docker

# Docker Compose v2
apt install docker-compose-plugin -y

# Certbot (SSL)
apt install certbot -y
```

### 3. Клонируем репозиторий

```bash
git clone https://github.com/kentavr34/chesscoin.git /opt/chesscoin
cd /opt/chesscoin
```

### 4. Получаем SSL-сертификат

```bash
# Останавливаем если что-то занимает 80 порт
# Запрашиваем сертификат
certbot certonly --standalone -d chesscoin.app -d www.chesscoin.app

# Сертификаты появятся в /etc/letsencrypt/live/chesscoin.app/
```

### 5. Настраиваем переменные окружения

```bash
# Копируем шаблон
cp backend/.env.example backend/.env

# Открываем для редактирования
nano backend/.env
```

**Обязательно заменить** (см. таблицу ниже):

```bash
# Копируем frontend env
cp frontend/.env.example frontend/.env.production
nano frontend/.env.production
```

### 6. Настраиваем TON Connect манифест

```bash
# Файл уже есть: frontend/public/tonconnect-manifest.json
# Проверяем что URL правильный
cat frontend/public/tonconnect-manifest.json
```

Должно быть:
```json
{
  "url": "https://chesscoin.app",
  "name": "ChessCoin",
  "iconUrl": "https://chesscoin.app/logo.png"
}
```

### 7. Запускаем

```bash
cd /opt/chesscoin

# Первый запуск — собираем образы
docker compose up -d --build

# Применяем миграции БД
docker compose exec backend npx prisma migrate deploy

# Заполняем начальные данные (страны, товары магазина)
docker compose exec backend npx tsx prisma/seed.ts

# Смотрим логи
docker compose logs -f backend
```

### 8. Проверяем

```bash
# Health check
curl https://chesscoin.app/health

# Статус контейнеров
docker compose ps

# Логи всех сервисов
docker compose logs --tail=50
```

---

## ⚙️ Переменные окружения

### backend/.env

| Переменная | Пример | Обязательно | Описание |
|-----------|--------|-------------|---------|
| `NODE_ENV` | `production` | ✅ | Режим запуска |
| `DATABASE_URL` | `postgresql://...` | ✅ | Строка подключения PostgreSQL |
| `REDIS_PASSWORD` | `strong_password_here` | ✅ | Пароль Redis |
| `BOT_TOKEN` | `123456:ABC-DEF...` | ✅ | Токен Telegram бота (от @BotFather) |
| `BOT_API_SECRET` | `any_random_string` | ✅ | Внутренний секрет bot→backend |
| `JWT_ACCESS_SECRET` | `64_char_random` | ✅ | Секрет JWT access токенов |
| `JWT_REFRESH_SECRET` | `64_char_random` | ✅ | Секрет JWT refresh токенов |
| `ADMIN_IDS` | `123456789,987654321` | ✅ | Telegram ID администраторов |
| `DOMAIN` | `chesscoin.app` | ✅ | Домен приложения |
| `PLATFORM_TON_WALLET` | `UQD...` | ✅ | TON-адрес кошелька платформы (комиссии биржи) |
| `TONCENTER_API_KEY` | `abc123...` | ⚠️ | API ключ TonCenter (без него верификация PENDING) |
| `S3_ENDPOINT` | `https://s3.timeweb.cloud` | ✅ | S3 endpoint (Timeweb) |
| `S3_BUCKET` | `your-bucket-name` | ✅ | Название бакета |
| `S3_ACCESS_KEY` | `...` | ✅ | S3 access key |
| `S3_SECRET_ACCESS_KEY` | `...` | ✅ | S3 secret key |
| `POSTGRES_PASSWORD` | `strong_db_pass` | ✅ | Пароль PostgreSQL |

> Генерация случайных секретов:
> ```bash
> openssl rand -hex 32   # для JWT secrets
> openssl rand -hex 16   # для паролей
> ```

### frontend/.env.production

| Переменная | Значение | Описание |
|-----------|---------|---------|
| `VITE_PLATFORM_TON_WALLET` | `UQD...` | TON адрес платформы (тот же что в backend) |
| `VITE_APP_URL` | `https://chesscoin.app` | Публичный URL приложения |

---

## 🔄 Обновление (после нового деплоя)

```bash
cd /opt/chesscoin

# Получаем изменения
git pull origin main

# Пересобираем и перезапускаем
docker compose up -d --build

# Применяем новые миграции (если есть)
docker compose exec backend npx prisma migrate deploy

# Рестартуем бота (при изменениях в боте)
docker compose restart bot
```

---

## 🧪 Тесты

```bash
cd backend

# Установить зависимости (если не установлены)
npm install

# Запустить все тесты (124 теста)
npm test

# С покрытием
npm test -- --coverage

# Только биржа
npm test -- exchange.test.ts

# Только рефералы
npm test -- referral.test.ts
```

---

## 📁 Структура проекта

```
chesscoin-v7.1.0/
├── backend/                    # Node.js API сервер
│   ├── src/
│   │   ├── routes/             # Express роуты
│   │   │   ├── exchange.ts     # P2P биржа (E1-E15)
│   │   │   ├── auth.ts         # Авторизация Telegram
│   │   │   ├── wars.ts         # Войны стран
│   │   │   ├── tournaments.ts  # Турниры
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── game/           # Игровая логика (socket, finish, session)
│   │   │   ├── crons.ts        # Фоновые задачи
│   │   │   └── economy.ts      # Финансовая логика
│   │   ├── lib/
│   │   │   ├── tonverify.ts    # Верификация TON транзакций
│   │   │   ├── logger.ts       # Winston логгер
│   │   │   └── ...
│   │   └── __tests__/          # 124 unit теста
│   └── prisma/
│       ├── schema.prisma       # Модели БД
│       ├── migrations/         # SQL миграции
│       └── seed.ts             # Начальные данные
├── frontend/                   # React + Vite приложение
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ExchangeTab.tsx # P2P биржа UI
│   │   │   ├── ShopPage.tsx    # Магазин
│   │   │   ├── WarsPage.tsx    # Войны
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── game/           # Игровые компоненты
│   │   │   ├── shop/           # Карточки товаров
│   │   │   └── ui/             # Общие UI компоненты
│   │   └── lib/
│   │       └── tonconnect.ts   # TonConnect интеграция
│   └── public/
│       └── tonconnect-manifest.json
├── bot/                        # Python Telegram бот
│   ├── handlers/
│   │   ├── notifications.py    # Уведомления (биржа, турниры, войны)
│   │   └── start.py            # /start команда
│   └── i18n.py                 # 9 языков
├── nginx/
│   └── nginx.conf              # Reverse proxy конфиг
├── docker-compose.yml          # Все сервисы
├── MASTERPLAN.md               # История разработки + архитектура
└── AUDIT.md                    # Лог всех багов и исправлений
```

---

## 🔒 Безопасность

- JWT авторизация через Telegram initData (проверка HMAC)
- Rate limiting на API роутах (express-rate-limit)
- Zod валидация входящих данных
- Helmet заголовки безопасности
- P2P биржа: atomic transactions + race condition protection
- TON верификация через TonCenter blockchain API
- Redis distributed lock для broadcast операций

---

## 📊 Мониторинг

```bash
# Статус всех сервисов
docker compose ps

# Логи в реальном времени
docker compose logs -f

# Только ошибки
docker compose logs backend | grep ERROR

# Использование ресурсов
docker stats

# Health check
curl https://chesscoin.app/health
```

---

## 🆘 Troubleshooting

**502 Bad Gateway:**
```bash
docker compose restart backend
docker compose logs backend --tail=50
```

**База данных не запускается:**
```bash
docker compose logs postgres
docker volume ls  # проверить что volume существует
```

**Бот не отвечает:**
```bash
docker compose restart bot
docker compose logs bot --tail=20
```

**SSL истёк:**
```bash
certbot renew
docker compose restart nginx
```

**Ошибки миграций:**
```bash
docker compose exec backend npx prisma migrate status
docker compose exec backend npx prisma migrate deploy
```

---

## 📞 Контакты

- Репозиторий: https://github.com/kentavr34/chesscoin
- MASTERPLAN: [MASTERPLAN.md](./MASTERPLAN.md)
- Аудит багов: [AUDIT.md](./AUDIT.md)
