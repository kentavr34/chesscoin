"""
Модуль команд /remember и /recall — подключается в main.py.
Вынесен отдельно, чтобы не править главный файл.
"""
import re
import sys
from telegram import Update
from telegram.ext import ContextTypes

sys.path.insert(0, '/root/claudia')
import claudia_memory as _cm


async def cmd_remember(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/remember [tag1,tag2] текст — закладка в долговременную память."""
    args_text = ' '.join(ctx.args) if ctx.args else ''
    if not args_text:
        await update.message.reply_text(
            'Формат: /remember [tag1,tag2] твой текст\n'
            'Пример: /remember [deploy,vps] SSH-ключ лежит в ~/.ssh/claude_deploy_key'
        )
        return

    tags = []
    m = re.match(r'^\s*\[([^\]]+)\]\s*(.*)$', args_text, re.DOTALL)
    if m:
        tags = [t.strip().lower() for t in m.group(1).split(',') if t.strip()]
        text = m.group(2).strip()
    else:
        text = args_text

    if not text:
        await update.message.reply_text('Пустой текст — нечего запомнить.')
        return

    ok = _cm.remember(text, tags=tags, category='bookmark', project='claudia')
    tags_str = ', '.join(tags) if tags else '—'
    reply = f'✓ Запомнила (теги: {tags_str})' if ok else '✗ Не удалось сохранить в RAG'
    await update.message.reply_text(reply)


async def cmd_recall(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/recall запрос — параллельный поиск по всей памяти (PG+RAG+semantic)."""
    q = ' '.join(ctx.args) if ctx.args else ''
    if not q:
        await update.message.reply_text('Формат: /recall что искать')
        return

    r = _cm.search(q, limit=5, modes=['fts', 'trigram', 'semantic', 'rag'])
    lines = [
        f'🔎 <b>{q}</b>',
        f'FTS={len(r["pg_fts"])} | Trigram={len(r["pg_trigram"])} | '
        f'Semantic={len(r["pg_semantic"])}',
        '',
    ]
    for i, m in enumerate(r.get('merged', [])[:5], 1):
        sc = m.get('score', 0)
        ex = (m.get('excerpt') or '')[:200]
        ex = ex.replace('<', '&lt;').replace('>', '&gt;')
        src = m.get('source', '?').replace('pg_', '')
        lines.append(f'{i}. [{sc:.2f}|{src}] {ex}')

    rag_txt = r.get('rag') or ''
    if rag_txt and len(rag_txt) > 30:
        lines.append('')
        lines.append(f'📚 RAG: {rag_txt[:500]}')

    await update.message.reply_html('\n'.join(lines)[:4000])
