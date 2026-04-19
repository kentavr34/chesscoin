# 🔐 CLAUDIA VAULT — Инвентарь ключей и паролей

> **Расположение на сервере:** `/root/claudia/vault/`
> **Права доступа:** 700 (только root)
> **Резервное копирование:** `gdrive:claudia_vault/vault_*.tar.gz.enc` (шифровано GPG)
> **Симметричный пароль шифрования:** хранится в `/root/.claudia_vault_passphrase` (chmod 600)
> **Последнее обновление:** 2026-04-17

---

## 📂 Структура vault/

```
/root/claudia/vault/
├── INVENTORY.md                        ← этот файл
├── .env.encrypted                      ← главный .env шифрованный
├── service_accounts/
│   └── gdrive_service_account.json     ← Google Service Account
├── tokens/
│   ├── telegram_bot.txt
│   ├── github.txt
│   └── anthropic_direct.txt
└── keys/
    ├── ssh/                            ← SSH-ключи (если понадобятся)
    └── api/                            ← API ключи провайдеров
```

---

## 🔑 КАТАЛОГ КЛЮЧЕЙ

### 🤖 LLM-провайдеры

| Ключ | Провайдер | Назначение | Где используется |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek | Основной LLM (классификация, PMI, self_update) | `bot/main.py`, `self_update.py`, `learn.py`, `architect.py`, `commander.py`, `crew_board.py` |
| `ANTHROPIC_API_KEY` | OpenRouter | Claude через OpenRouter (failover, дешевле) | `crew_board.py`, `aider_runner.py` |
| `ANTHROPIC_API_KEY_DIRECT` | Anthropic | Direct API (дороже, быстрее) | `crew_board.py`, `architect.py` |
| `ANTHROPIC_BASE_URL` | OpenRouter | Базовый URL OpenRouter | все модули с OpenRouter |
| `LLM_MODEL` | — | Имя модели по умолчанию | default LLM calls |

### 🎤 Voice (ASR + TTS)

| Ключ | Провайдер | Назначение |
|---|---|---|
| `GROQ_API_KEY` | Groq | ASR: whisper-large-v3 (транскрипция голосовых) |
| `ELEVENLABS_API_KEY` | ElevenLabs | TTS: приоритетный голос (⚠ баланс 0) |
| `ELEVENLABS_VOICE_ID` | ElevenLabs | ID голоса Клаудии |
| `FISH_AUDIO_API_KEY` | Fish Audio | TTS: резерв при исчерпании ElevenLabs |
| `FISH_AUDIO_VOICE_ID` | Fish Audio | ID голоса в Fish Audio |

### 🧠 Память и эмбеддинги

| Ключ | Провайдер | Назначение |
|---|---|---|
| `QWEN_API_KEY` | MuleRouter (было Qwen) | Эмбеддинги text-embedding-v3 для LightRAG |
| `LIGHTRAG_API_KEY` | LightRAG | API ключ локального LightRAG-сервера |
| `LIGHTRAG_URL` | LightRAG | `http://localhost:9622` |
| `LIGHTRAG_PROJECT` | LightRAG | Имя проекта `chesscoin` |

### 🗄️ База данных

| Ключ | Назначение |
|---|---|
| `POSTGRES_HOST` | localhost |
| `POSTGRES_PORT` | 5432 |
| `POSTGRES_DB` | `claudia` |
| `POSTGRES_USER` | `claudia` |
| `POSTGRES_PASSWORD` | пароль БД |

### 💬 Telegram

| Ключ | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Основной токен бота @claudia |
| `ADMIN_USER_ID` | Telegram ID Кенана (254450353) |

### 🐙 GitHub

| Ключ | Назначение |
|---|---|
| `GITHUB_TOKEN` | Personal Access Token (repo scope) |
| `GITHUB_REPO` | `kentavr34/claudia` |

### ☁️ Google Drive

| Файл | Назначение |
|---|---|
| `/root/claudia/gdrive_service_account.json` | Service Account (альтернатива OAuth) |
| `/root/.config/rclone/rclone.conf` | OAuth токен для `gdrive:` remote |

**Папки в Google Drive:**
- `gdrive:` (root_folder_id=1o-jJj--iRxG-BQMOfBEyg0OXAqxk_4rx) — полные бэкапы сервера
- `gdrive:claudia_backups/` — автономные бэкапы Клаудии (каждые 12ч)
- `gdrive:claudia_vault/` — шифрованные бэкапы vault (каждые 12ч)

---

## 🛡️ ПРАВИЛА БЕЗОПАСНОСТИ

1. **Никогда не коммитить ключи в git** — файлы vault/ в `.gitignore`
2. **Vault шифруется GPG** при бэкапе на GDrive — файл `.enc`
3. **Passphrase хранится отдельно** — `/root/.claudia_vault_passphrase` (не в репо, не в бэкапе vault)
4. **Ротация ключей раз в 90 дней** — напоминание в `CLAUDIA_PROJECTS.md`
5. **Сервер 185.203.116.131** — не давать root-доступ никому кроме Кенана и Claude-агента

---

## 🔄 ПРОЦЕДУРА ВОССТАНОВЛЕНИЯ ИЗ БЭКАПА

Если нужно восстановить Клаудию с нуля на новом сервере:

```bash
# 1. Скачать последний полный бэкап
rclone copy gdrive:claudia_backups/claudia_LATEST.tar.gz /tmp/

# 2. Распаковать
cd /root && tar -xzf /tmp/claudia_*.tar.gz
mv claudia_*/claudia /root/claudia
mv claudia_*/lightrag_data /root/lightrag_data

# 3. Восстановить БД
psql -U claudia -d claudia < claudia_*/postgres/claudia_data.sql

# 4. Восстановить vault
rclone copy gdrive:claudia_vault/vault_LATEST.tar.gz.enc /tmp/
PASS=$(cat /root/.claudia_vault_passphrase)
gpg --batch --yes --passphrase "$PASS" -d /tmp/vault_LATEST.tar.gz.enc | tar -xzf - -C /root/claudia/

# 5. Запустить
systemctl daemon-reload
systemctl start claudia-bot
```

---

_Обновляется вручную при добавлении/замене ключей._
_Автокоммит в git — при каждом изменении inventory._
