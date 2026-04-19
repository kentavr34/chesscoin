"""
team.py — AI_TEAM Commander API.

Клаудиа — командир. Роли (специалисты) персонифицированы.
Мозги (LLM) назначаются ролям и меняются на лету.

Использование:
    from team import Commander
    cmdr = Commander()

    # Нанять
    cmdr.hire('seo_writer', persona='SEO-копирайтер',
              job='Пишет meta для chesscoin',
              default_provider='dashscope', default_model='qwen-plus')

    # Вызвать специалиста
    answer = cmdr.call('librarian', 'найди решения про деплой')

    # Назначить (постоянно)
    cmdr.assign('developer', provider='anthropic', model='claude-opus-4-7',
                reason='сложный рефакторинг')

    # Временная замена
    cmdr.assign_temp('developer', 'anthropic', 'claude-opus-4-7',
                     hours=2, reason='критический баг')

    # Научить
    cmdr.teach('developer', 'В chesscoin — Tailwind, не inline-стили')

    # Уволить
    cmdr.fire('translator', reason='проект закрыт')

    # Обзор команды
    print(cmdr.roster())

    # Предложения по перестановкам
    cmdr.suggestions()
"""
import os
import sys
import json
import time
import logging
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/root/claudia/.env')
sys.path.insert(0, '/root/claudia')

log = logging.getLogger('team')


def _connect():
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        dbname=os.getenv('POSTGRES_DB', 'claudia'),
        user=os.getenv('POSTGRES_USER', 'claudia'),
        password=os.getenv('POSTGRES_PASSWORD', ''),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


class Commander:
    """Клаудиа как командир — управляет ролями и мозгами команды."""

    # ──────────────────────────────────────────────────────────────────
    # HIRE / FIRE
    # ──────────────────────────────────────────────────────────────────

    def hire(self, name: str, persona: str, job: str,
             default_provider: str, default_model: str,
             department: str = None, tier: str = 'standard',
             system_prompt: str = None, specialization: List[str] = None,
             trigger_keywords: List[str] = None,
             budget_monthly: float = None,
             hired_by: str = 'claudia') -> bool:
        """Нанять нового специалиста."""
        if system_prompt is None:
            system_prompt = (
                f'Ты — {persona} в команде Клаудии.\n'
                f'Зона ответственности: {job}\n'
                f'Правила диалога: по-русски, кратко, по делу. '
                f'Переключайся на английский только если Кенан попросит.'
            )

        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO roles (name, persona, department, job_description,
                                   default_system_prompt, specialization,
                                   trigger_keywords, cost_budget_monthly, hired_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (name) DO UPDATE SET
                    fired_at = NULL,
                    fire_reason = NULL,
                    persona = EXCLUDED.persona,
                    job_description = EXCLUDED.job_description
            """, (name, persona, department, job, system_prompt,
                  specialization or [], trigger_keywords or [],
                  budget_monthly, hired_by))

            cur.execute("""
                INSERT INTO team_roster (role_name, current_provider, current_model, current_tier)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT (role_name) DO UPDATE SET
                    current_provider = EXCLUDED.current_provider,
                    current_model = EXCLUDED.current_model,
                    current_tier = EXCLUDED.current_tier,
                    current_since = NOW()
            """, (name, default_provider, default_model, tier))

            cur.execute("""
                INSERT INTO team_history (role_name, event_type, new_provider, new_model, reason, decided_by)
                VALUES (%s,'hire',%s,%s,%s,%s)
            """, (name, default_provider, default_model,
                  f'Нанят на должность {persona}', hired_by))

            conn.commit()
            log.info(f'✓ Hired {name} ({persona}) → {default_provider}/{default_model}')
            return True
        except Exception as e:
            conn.rollback()
            log.error(f'hire failed: {e}')
            return False
        finally:
            conn.close()

    def fire(self, name: str, reason: str, fired_by: str = 'claudia') -> bool:
        """Уволить специалиста (soft delete — данные остаются)."""
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE roles SET fired_at = NOW(), fire_reason = %s
                WHERE name = %s AND fired_at IS NULL
            """, (reason, name))
            if cur.rowcount == 0:
                log.warning(f'fire: {name} не найден или уже уволен')
                return False
            cur.execute("""
                INSERT INTO team_history (role_name, event_type, reason, decided_by)
                VALUES (%s,'fire',%s,%s)
            """, (name, reason, fired_by))
            conn.commit()
            log.info(f'✓ Fired {name}: {reason}')
            return True
        finally:
            conn.close()

    # ──────────────────────────────────────────────────────────────────
    # ASSIGN (смена мозга)
    # ──────────────────────────────────────────────────────────────────

    def assign(self, role_name: str, provider: str, model: str,
               tier: str = None, reason: str = '',
               decided_by: str = 'claudia') -> bool:
        """Постоянное переназначение мозга специалисту."""
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute('SELECT * FROM team_roster WHERE role_name=%s', (role_name,))
            row = cur.fetchone()
            if not row:
                log.error(f'assign: роль {role_name} не найдена')
                return False

            metrics_before = {
                'success_30d': row['success_30d'],
                'fail_30d': row['fail_30d'],
                'cost_30d_usd': float(row['cost_30d_usd'] or 0),
                'avg_latency_ms': row['avg_latency_ms'],
            }

            cur.execute("""
                UPDATE team_roster SET
                    current_provider = %s, current_model = %s,
                    current_tier = COALESCE(%s, current_tier),
                    current_since = NOW(), assigned_by = %s,
                    success_30d = 0, fail_30d = 0, cost_30d_usd = 0
                WHERE role_name = %s
            """, (provider, model, tier, decided_by, role_name))

            cur.execute("""
                INSERT INTO team_history (role_name, event_type,
                    prev_provider, prev_model, new_provider, new_model,
                    reason, decided_by, metrics_before)
                VALUES (%s,'reassign',%s,%s,%s,%s,%s,%s,%s)
            """, (role_name, row['current_provider'], row['current_model'],
                  provider, model, reason, decided_by, json.dumps(metrics_before)))
            conn.commit()
            log.info(f'✓ {role_name}: {row["current_model"]} → {model} ({reason})')
            return True
        finally:
            conn.close()

    def assign_temp(self, role_name: str, provider: str, model: str,
                    hours: float = 2, tier: str = None,
                    reason: str = '', decided_by: str = 'claudia') -> bool:
        """Временная замена мозга (авто-возврат через N часов)."""
        until = datetime.now() + timedelta(hours=hours)
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                UPDATE team_roster SET
                    temp_provider = %s, temp_model = %s, temp_tier = %s,
                    temp_until = %s, temp_reason = %s
                WHERE role_name = %s
            """, (provider, model, tier, until, reason, role_name))

            cur.execute("""
                INSERT INTO team_history (role_name, event_type,
                    new_provider, new_model, reason, decided_by)
                VALUES (%s,'temp_assign',%s,%s,%s,%s)
            """, (role_name, provider, model,
                  f'{reason} (до {until:%H:%M})', decided_by))
            conn.commit()
            log.info(f'✓ {role_name} временно → {model} до {until:%Y-%m-%d %H:%M}')
            return True
        finally:
            conn.close()

    def revert_expired_temps(self):
        """Снять истёкшие временные назначения (вызывать таймером)."""
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT role_name, temp_provider, temp_model
                FROM team_roster
                WHERE temp_until IS NOT NULL AND temp_until < NOW()
            """)
            expired = cur.fetchall()
            for r in expired:
                cur.execute("""
                    UPDATE team_roster
                    SET temp_provider=NULL, temp_model=NULL, temp_tier=NULL,
                        temp_until=NULL, temp_reason=NULL
                    WHERE role_name=%s
                """, (r['role_name'],))
                cur.execute("""
                    INSERT INTO team_history (role_name, event_type, reason)
                    VALUES (%s,'temp_revert','истёк срок временного назначения')
                """, (r['role_name'],))
            conn.commit()
            return len(expired)
        finally:
            conn.close()

    # ──────────────────────────────────────────────────────────────────
    # CALL (вызов специалиста)
    # ──────────────────────────────────────────────────────────────────

    def _effective_brain(self, roster_row: Dict) -> Dict:
        """Возвращает активный мозг — temp если не истёк, иначе current."""
        temp_until = roster_row.get('temp_until')
        if temp_until is not None:
            # приводим к naive UTC для сравнения
            tu = temp_until.replace(tzinfo=None) if temp_until.tzinfo else temp_until
            now = datetime.utcnow()
        else:
            tu = None; now = None
        if tu and tu > now:
            return {
                'provider': roster_row['temp_provider'],
                'model': roster_row['temp_model'],
                'tier': roster_row['temp_tier'] or roster_row['current_tier'],
                'is_temp': True,
            }
        return {
            'provider': roster_row['current_provider'],
            'model': roster_row['current_model'],
            'tier': roster_row['current_tier'],
            'is_temp': False,
        }

    def _lessons_for(self, role_name: str, project: str = 'claudia') -> List[str]:
        """Активные уроки специалиста для system_prompt."""
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT lesson FROM specialist_lessons
                WHERE role_name = %s AND project IN (%s, 'all') AND is_active
                ORDER BY confidence DESC, learned_at DESC
                LIMIT 20
            """, (role_name, project))
            return [r['lesson'] for r in cur.fetchall()]
        finally:
            conn.close()

    def call(self, role_name: str, user_prompt: str,
             task_type: str = 'general',
             project: str = 'claudia',
             max_tokens: int = None) -> Optional[str]:
        """Вызвать специалиста. Вернёт ответ или None."""
        from model_registry import PROVIDERS
        import httpx

        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT r.*, tr.* FROM roles r
                JOIN team_roster tr ON tr.role_name = r.name
                WHERE r.name = %s AND r.fired_at IS NULL
            """, (role_name,))
            info = cur.fetchone()
            if not info:
                log.error(f'call: роль {role_name} не найдена или уволена')
                return None
        finally:
            conn.close()

        brain = self._effective_brain(info)
        lessons = self._lessons_for(role_name, project)

        sys_prompt = info['default_system_prompt']
        if lessons:
            sys_prompt += '\n\nУроки на проекте:\n' + '\n'.join(f'• {l}' for l in lessons)
        marker = ('временный' if brain['is_temp'] else 'постоянный')
        sys_prompt += f'\n\nТвой мозг сейчас: {brain["model"]} ({marker}).'

        max_tok = max_tokens or info.get('max_tokens') or 2000
        temp = float(info.get('temperature') or 0.3)

        prov_cfg = PROVIDERS.get(brain['provider'])
        if not prov_cfg:
            log.error(f'call: unknown provider {brain["provider"]}')
            return None

        # Собираем запрос (OpenAI-совместимый везде кроме anthropic)
        t0 = time.time()
        answer = None
        error_msg = None
        success = False
        tokens_in = tokens_out = 0
        try:
            key_env = prov_cfg.get('key_env') or prov_cfg.get('env')
            if brain['provider'] == 'anthropic':
                url = prov_cfg.get('url') or 'https://api.anthropic.com/v1/messages'
                headers = {
                    'x-api-key': os.getenv(key_env),
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                }
                payload = {
                    'model': brain['model'],
                    'max_tokens': max_tok,
                    'system': sys_prompt,
                    'messages': [{'role': 'user', 'content': user_prompt}],
                }
                r = httpx.post(url, headers=headers, json=payload, timeout=60)
                r.raise_for_status()
                data = r.json()
                answer = data['content'][0]['text']
                tokens_in = data.get('usage', {}).get('input_tokens', 0)
                tokens_out = data.get('usage', {}).get('output_tokens', 0)
            else:
                url = prov_cfg['url']
                key = os.getenv(key_env)
                headers = {'Authorization': f'Bearer {key}',
                           'Content-Type': 'application/json'}
                payload = {
                    'model': brain['model'],
                    'temperature': temp,
                    'max_tokens': max_tok,
                    'messages': [
                        {'role': 'system', 'content': sys_prompt},
                        {'role': 'user',   'content': user_prompt},
                    ],
                }
                r = httpx.post(url, headers=headers, json=payload, timeout=60)
                r.raise_for_status()
                data = r.json()
                answer = data['choices'][0]['message']['content']
                usage = data.get('usage', {})
                tokens_in = usage.get('prompt_tokens', 0)
                tokens_out = usage.get('completion_tokens', 0)
            success = answer is not None
        except Exception as e:
            error_msg = str(e)[:200]
            log.warning(f'call {role_name} ({brain["model"]}): {error_msg}')

        latency_ms = int((time.time() - t0) * 1000)
        # TODO: точный cost per model — пока грубо
        cost = (tokens_in * 0.0000005) + (tokens_out * 0.0000015)

        # Лог вызова
        try:
            conn = _connect()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO specialist_invocations
                    (role_name, provider, model, prompt_hash, tokens_in, tokens_out,
                     latency_ms, cost_usd, success, error_msg, task_type)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (role_name, brain['provider'], brain['model'],
                  hashlib.md5(user_prompt.encode()).hexdigest()[:16],
                  tokens_in, tokens_out, latency_ms, cost,
                  success, error_msg, task_type))
            conn.commit()
            conn.close()
        except Exception as e:
            log.warning(f'log invocation failed: {e}')

        return answer

    # ──────────────────────────────────────────────────────────────────
    # TEACH / FORGET
    # ──────────────────────────────────────────────────────────────────

    def teach(self, role_name: str, lesson: str,
              project: str = 'claudia', source: str = 'kenan',
              confidence: float = 1.0) -> bool:
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO specialist_lessons
                    (role_name, project, lesson, source, confidence)
                VALUES (%s,%s,%s,%s,%s)
            """, (role_name, project, lesson, source, confidence))
            conn.commit()
            log.info(f'✓ {role_name} выучил: {lesson[:60]}...')
            return True
        finally:
            conn.close()

    def forget(self, lesson_id: str) -> bool:
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute('UPDATE specialist_lessons SET is_active=FALSE WHERE id=%s',
                        (lesson_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    # ──────────────────────────────────────────────────────────────────
    # ROSTER / STATUS / SUGGESTIONS
    # ──────────────────────────────────────────────────────────────────

    def roster(self) -> List[Dict]:
        """Полный список активной команды."""
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT r.name, r.persona, r.department, r.job_description,
                       tr.current_provider, tr.current_model, tr.current_tier,
                       tr.temp_model, tr.temp_until,
                       tr.success_30d, tr.fail_30d, tr.cost_30d_usd,
                       tr.avg_latency_ms, tr.total_invocations, tr.last_invoked,
                       (SELECT COUNT(*) FROM specialist_lessons l
                        WHERE l.role_name = r.name AND l.is_active) AS lessons
                FROM roles r
                JOIN team_roster tr ON tr.role_name = r.name
                WHERE r.fired_at IS NULL
                ORDER BY r.department, r.name
            """)
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def stats(self, role_name: str, days: int = 30) -> Dict:
        conn = _connect()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT COUNT(*) AS invocations,
                       AVG(latency_ms)::INT AS avg_lat,
                       SUM(cost_usd) AS cost,
                       SUM(tokens_in) AS tok_in,
                       SUM(tokens_out) AS tok_out,
                       SUM((success)::int)::FLOAT / NULLIF(COUNT(*),0) AS success_rate
                FROM specialist_invocations
                WHERE role_name=%s AND created_at > NOW() - INTERVAL '%s days'
            """, (role_name, days))
            return dict(cur.fetchone() or {})
        finally:
            conn.close()

    def suggestions(self) -> List[Dict]:
        """Анализ: кого пора двигать (дёшево/дорого vs качество)."""
        recs = []
        for r in self.roster():
            total = (r['success_30d'] or 0) + (r['fail_30d'] or 0)
            if total < 20:
                continue
            fail_rate = r['fail_30d'] / total
            if fail_rate > 0.15:
                recs.append({
                    'role': r['name'], 'action': 'upgrade',
                    'reason': f'fail_rate={fail_rate:.0%} на {total} вызовах',
                    'current': f"{r['current_provider']}/{r['current_model']}",
                })
            elif fail_rate < 0.02 and r['current_tier'] in ('deep', 'standard'):
                recs.append({
                    'role': r['name'], 'action': 'downgrade',
                    'reason': f'fail_rate={fail_rate:.0%} — можно попробовать дешевле',
                    'current': f"{r['current_provider']}/{r['current_model']}",
                })
        return recs
