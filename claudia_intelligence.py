"""
claudia_intelligence.py — Интеллектуальные слои Клаудии.

Два связанных механизма:

1. classify_complexity(text) → 'fast' | 'standard' | 'deep'
   Автовыбор tier модели по сложности запроса.
   Экономит 5-10× на простых ack-фразах.

2. memory_lifecycle() — жизненный цикл памяти
   Раз в месяц: старые сообщения PG → summary → LightRAG → удаление raw.
   Освобождает PostgreSQL, сжимает знание в семантический граф.

Использование:
    from claudia_intelligence import classify_complexity, smart_llm_call

    tier = classify_complexity("привет")          # → 'fast'
    tier = classify_complexity("переделай архитектуру бэкенда")  # → 'deep'

    response = smart_llm_call("привет")  # автовыбор tier
"""
import os
import sys
import re
import logging
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')
from model_registry import call_llm

log = logging.getLogger('intelligence')


# ═══════════════════════════════════════════════════════════════════════
# 1. Классификация сложности (локально, без LLM)
# ═══════════════════════════════════════════════════════════════════════

# Ключевые слова и признаки для каждого tier
FAST_PATTERNS = [
    r'^(привет|здравствуй|хай|ок|да|нет|понял(а)?|принял(а)?|готов(а)?|хорошо)[\s.!?]*$',
    r'^\/\w+\s*$',  # одиночные slash-команды
    r'^(спасибо|thanks|thx|good|👍|❤️|😊)[\s.!?]*$',
    r'^.{1,20}$',  # очень короткие фразы вообще
]

DEEP_KEYWORDS = [
    # Архитектура и дизайн
    'архитектура', 'рефакторинг', 'структура', 'реорганизац', 'дизайн системы',
    # Сложный анализ
    'проанализируй', 'глубокий анализ', 'полный аудит', 'продумай', 'исследуй',
    # Новые фичи и планирование
    'создай с нуля', 'разработай план', 'стратегия', 'roadmap', 'архитектурное решение',
    # Оптимизация
    'оптимизируй', 'ускорь', 'сократи сложность',
    # Критические решения
    'критически важно', 'безопасность', 'security', 'production',
    # Многоступенчатые задачи
    'сначала... потом... затем', 'объясни почему', 'обоснуй',
]

STANDARD_KEYWORDS = [
    'сделай', 'напиши', 'исправь', 'добавь', 'удали', 'измени',
    'как', 'почему', 'что', 'где', 'когда',
    'расскажи', 'опиши', 'объясни',
    'проверь', 'запусти', 'покажи',
]


def classify_complexity(text: str) -> str:
    """
    Классифицирует сложность запроса для выбора tier модели.

    Returns: 'fast' | 'standard' | 'deep'
    """
    if not text:
        return 'fast'

    text_lower = text.lower().strip()
    words = text_lower.split()
    word_count = len(words)

    # 1. FAST — короткие ack, привет, команды
    for pattern in FAST_PATTERNS:
        if re.match(pattern, text_lower, re.IGNORECASE):
            return 'fast'

    # 2. DEEP — архитектурные решения, сложный анализ
    for kw in DEEP_KEYWORDS:
        if kw in text_lower:
            return 'deep'

    # Если запрос длинный и с несколькими разделами («во-первых», списки)
    if word_count > 80 and ('во-первых' in text_lower or text.count('\n') > 5):
        return 'deep'

    # Код в запросе (бэктики, импорты, def, function) + вопрос = deep
    if ('```' in text or 'def ' in text or 'function ' in text or 'import ' in text) \
            and ('?' in text or any(kw in text_lower for kw in ['почему', 'исправь', 'why'])):
        return 'deep'

    # 3. STANDARD — есть глагол или вопрос
    for kw in STANDARD_KEYWORDS:
        if kw in text_lower:
            return 'standard'

    # 4. Fallback по длине
    if word_count <= 3:
        return 'fast'
    elif word_count > 50:
        return 'deep'
    return 'standard'


def smart_llm_call(user: str, system: str = '', max_tokens: int = 1000) -> dict:
    """
    Автоматический выбор tier + вызов LLM.

    Returns: {'response': str, 'tier_used': str, 'reason': str}
    """
    tier = classify_complexity(user)
    reason = _explain_tier(user, tier)
    log.info(f'Auto-selected tier={tier} — {reason}')
    response = call_llm(user=user, system=system, tier=tier, max_tokens=max_tokens)
    return {
        'response':  response,
        'tier_used': tier,
        'reason':    reason,
    }


def _explain_tier(text: str, tier: str) -> str:
    """Человекочитаемое объяснение выбора."""
    length = len(text.split())
    if tier == 'fast':
        return f'быстрый отклик ({length} слов)'
    if tier == 'deep':
        matches = [kw for kw in DEEP_KEYWORDS if kw in text.lower()]
        if matches:
            return f'глубокий анализ (ключевые слова: {", ".join(matches[:3])})'
        return 'многословный запрос / код'
    return f'стандартная задача ({length} слов)'


# ═══════════════════════════════════════════════════════════════════════
# 2. Memory Lifecycle (горячая/тёплая/холодная)
# ═══════════════════════════════════════════════════════════════════════

HOT_DAYS  = 1    # 24ч — Redis + PG свежее
WARM_DAYS = 30   # 30 дней — только PG, активный поиск
COLD_DAYS = 90   # старше 90 дней → сжатие → LightRAG → удаление из PG


def memory_lifecycle_run(dry_run: bool = False) -> dict:
    """
    Месячный lifecycle:
    1. Берёт сообщения старше COLD_DAYS из PG
    2. Группирует по неделям
    3. Каждую неделю → Opus/Sonnet генерирует summary
    4. Summary → LightRAG с source='archive_week_YYYY-WW'
    5. Raw сообщения удаляются из PG (если dry_run=False)

    Returns: {'processed_weeks': int, 'messages_archived': int, 'freed_rows': int}
    """
    import psycopg2
    import psycopg2.extras

    stats = {'processed_weeks': 0, 'messages_archived': 0, 'freed_rows': 0}

    try:
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            dbname=os.getenv('POSTGRES_DB', 'claudia'),
            user=os.getenv('POSTGRES_USER', 'claudia'),
            password=os.getenv('POSTGRES_PASSWORD', ''),
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        cur = conn.cursor()

        # Найти самую старую неделю с данными старше 90 дней
        cutoff = datetime.now() - timedelta(days=COLD_DAYS)
        cur.execute("""
            SELECT DATE_TRUNC('week', created_at) AS week_start,
                   COUNT(*) AS msg_count
            FROM conversations
            WHERE created_at < %s
              AND project = 'claudia'
            GROUP BY week_start
            ORDER BY week_start ASC
            LIMIT 10
        """, (cutoff,))
        weeks = cur.fetchall()

        log.info(f'Найдено {len(weeks)} недель для архивации (старше {COLD_DAYS} дней)')

        for week in weeks:
            week_start = week['week_start']
            msg_count = week['msg_count']
            week_end = week_start + timedelta(days=7)
            week_id = week_start.strftime('%Y-W%U')

            # Все сообщения недели
            cur.execute("""
                SELECT role, content, created_at
                FROM conversations
                WHERE created_at >= %s AND created_at < %s
                  AND project = 'claudia'
                ORDER BY created_at ASC
            """, (week_start, week_end))
            messages = cur.fetchall()

            if not messages:
                continue

            # Формируем summary через LLM
            log.info(f'Сжимаю неделю {week_id} ({len(messages)} сообщений)...')
            dialog = '\n\n'.join(
                f'[{m["role"]}]: {m["content"][:300]}' for m in messages[-200:]
            )
            if len(dialog) > 80000:
                dialog = dialog[-80000:]

            summary_prompt = f"""Ниже — разговоры Клаудии и Кенана за неделю {week_id}.
Напиши ёмкое резюме 300-500 слов:
- Основные темы недели
- Важные решения и договорённости
- Технические изменения в проектах
- Эмоциональный контекст (если значим)

Не добавляй вступлений. Только резюме.

РАЗГОВОРЫ:
{dialog}

РЕЗЮМЕ:"""

            summary = call_llm(
                user=summary_prompt,
                system='Ты — архивариус. Создаёшь компактные резюме диалогов.',
                tier='standard',  # Sonnet 4.6 — баланс качество/цена
                max_tokens=800,
            )

            if not summary:
                log.warning(f'Неделя {week_id}: LLM не ответила, пропуск')
                continue

            # Сохраняем в LightRAG
            import httpx
            try:
                httpx.post(
                    f'{os.getenv("LIGHTRAG_URL", "http://localhost:9622")}/documents/text',
                    headers={
                        'Content-Type': 'application/json',
                        'X-API-Key':   os.getenv('LIGHTRAG_API_KEY', ''),
                    },
                    json={
                        'text': f'[Архив недели {week_id}]\n\n{summary}',
                        'file_source': f'archive_{week_id}',
                    },
                    timeout=60,
                )
                log.info(f'  ✓ Summary {week_id} в LightRAG')
            except Exception as e:
                log.error(f'LightRAG save failed: {e}')
                continue

            # Удаляем raw из PG (только если не dry-run)
            if not dry_run:
                cur.execute("""
                    DELETE FROM conversations
                    WHERE created_at >= %s AND created_at < %s
                      AND project = 'claudia'
                """, (week_start, week_end))
                deleted = cur.rowcount
                conn.commit()
                log.info(f'  ✓ Удалено {deleted} raw-сообщений из PG')
                stats['freed_rows'] += deleted

            stats['processed_weeks'] += 1
            stats['messages_archived'] += msg_count

        conn.close()

    except Exception as e:
        log.error(f'lifecycle: {e}')

    return stats


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    if len(sys.argv) < 2:
        print('Использование:')
        print('  python3 claudia_intelligence.py classify "<текст>"')
        print('  python3 claudia_intelligence.py smart "<текст>"')
        print('  python3 claudia_intelligence.py lifecycle [--dry-run]')
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'classify':
        text = sys.argv[2] if len(sys.argv) > 2 else ''
        tier = classify_complexity(text)
        reason = _explain_tier(text, tier)
        print(f'Tier: {tier}')
        print(f'Reason: {reason}')

    elif cmd == 'smart':
        text = sys.argv[2] if len(sys.argv) > 2 else 'привет'
        result = smart_llm_call(text)
        print(f'Tier used: {result["tier_used"]} ({result["reason"]})')
        print(f'\nResponse:\n{result["response"]}')

    elif cmd == 'lifecycle':
        dry = '--dry-run' in sys.argv
        stats = memory_lifecycle_run(dry_run=dry)
        print(f'{"DRY RUN — " if dry else ""}Итог:')
        print(f'  Обработано недель: {stats["processed_weeks"]}')
        print(f'  Архивировано сообщений: {stats["messages_archived"]}')
        print(f'  Удалено строк из PG: {stats["freed_rows"]}')
