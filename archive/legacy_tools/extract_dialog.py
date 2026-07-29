"""Извлекает чистый диалог (user ↔ assistant) из JSONL сессии Claude Code.
Отбрасывает tool_use, tool_result, system reminders, queue-operations.
"""
import json
import re
import sys
from pathlib import Path

SRC = Path(r"C:\Users\SAM\Desktop\claude_chats\current_session.jsonl")
OUT = Path(r"C:\Users\SAM\Desktop\claude_chats\dialog.md")

# Эти теги/фразы означают служебные сообщения, не реальные слова пользователя
SKIP_USER_PATTERNS = [
    r"<system-reminder>",
    r"<command-message>",
    r"<command-name>",
    r"<local-command-stdout>",
    r"^Caveat:",
    r"^\[Request interrupted",
    r"^check Kenan$",  # таймер-промпт
    r"^<<autonomous-loop",
]
SKIP_RE = re.compile("|".join(SKIP_USER_PATTERNS), re.IGNORECASE | re.MULTILINE)


def extract_text(content):
    """Из content (str или list) вынимает только текстовые части."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            t = item.get("type")
            if t == "text":
                parts.append(item.get("text", ""))
            elif t == "tool_use":
                continue  # skip
            elif t == "tool_result":
                continue  # skip — это вывод инструмента, не диалог
            elif t == "thinking":
                continue  # внутренние мысли — не диалог
        return "\n".join(p for p in parts if p)
    return ""


def is_real_user_message(text: str) -> bool:
    """True если это настоящий текст от Кенана, не служебное."""
    if not text.strip():
        return False
    # tool_result от user-side (Claude Code оборачивает результаты в user-сообщения)
    if text.startswith("Tool ran") or text.startswith("[Tool"):
        return False
    if SKIP_RE.search(text):
        # Возможно это смешано с реальным текстом — отрежем теги
        # Удалим всё что в <...> до закрытия и проверим осталось ли что-то
        cleaned = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL)
        cleaned = re.sub(r"<command-[a-z]+>.*?</command-[a-z]+>", "", cleaned, flags=re.DOTALL)
        cleaned = re.sub(r"<local-command-stdout>.*?</local-command-stdout>", "", cleaned, flags=re.DOTALL)
        cleaned = cleaned.strip()
        if not cleaned or len(cleaned) < 3:
            return False
        return True
    return True


def clean_user_text(text: str) -> str:
    """Удаляет служебные обёртки, оставляя реальный текст."""
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL)
    text = re.sub(r"<command-[a-z]+>.*?</command-[a-z]+>", "", text, flags=re.DOTALL)
    text = re.sub(r"<local-command-stdout>.*?</local-command-stdout>", "", text, flags=re.DOTALL)
    text = re.sub(r"Caveat:.*?(?=\n\n|\Z)", "", text, flags=re.DOTALL)
    return text.strip()


def main():
    out_chunks = []
    out_chunks.append(f"# Диалог сессии\n\n_Источник: `{SRC.name}`_\n\n---\n")

    total = 0
    user_n = 0
    asst_n = 0
    last_role = None

    with SRC.open("r", encoding="utf-8") as f:
        for line in f:
            total += 1
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") not in ("user", "assistant"):
                continue
            msg = obj.get("message") or {}
            role = msg.get("role")
            content = msg.get("content", "")
            ts = obj.get("timestamp", "")

            text = extract_text(content)
            if not text.strip():
                continue

            if role == "user":
                if not is_real_user_message(text):
                    continue
                text = clean_user_text(text)
                if not text:
                    continue
                user_n += 1
                out_chunks.append(f"\n## 👤 Кенан · `{ts[:19]}`\n\n{text}\n")
                last_role = "user"
            elif role == "assistant":
                text = text.strip()
                if not text:
                    continue
                asst_n += 1
                out_chunks.append(f"\n## 🤖 Claude · `{ts[:19]}`\n\n{text}\n")
                last_role = "assistant"

    OUT.write_text("".join(out_chunks), encoding="utf-8")
    print(f"Lines processed: {total}")
    print(f"User messages:   {user_n}")
    print(f"Asst messages:   {asst_n}")
    print(f"Output:          {OUT}")
    print(f"Size:            {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
