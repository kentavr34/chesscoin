import os
import logging
from typing import Any
import aiohttp

logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000/api/v1")
BOT_API_SECRET = os.getenv("BOT_API_SECRET", "")


class BackendClient:
    """Async HTTP клиент к ChessCoin backend. Используется как async context manager."""

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession(
            base_url=BACKEND_URL,
            headers={
                "Authorization": f"Bearer {BOT_API_SECRET}",
                "Content-Type": "application/json",
            },
            timeout=aiohttp.ClientTimeout(total=10),
        )
        return self

    async def __aexit__(self, *_):
        if self._session:
            await self._session.close()

    async def _post(self, path: str, payload: dict) -> dict:
        async with self._session.post(path, json=payload) as resp:
            data = await resp.json()
            if not resp.ok:
                raise RuntimeError(f"Backend {resp.status}: {data}")
            return data

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with self._session.get(path, params=params) as resp:
            data = await resp.json()
            if not resp.ok:
                raise RuntimeError(f"Backend {resp.status}: {data}")
            return data

    # ─── Уведомления ──────────────────────────────────────────────────────────

    async def notify_user(self, telegram_id: str, message: str) -> dict:
        """Отправить уведомление пользователю (бэкенд пушит через Bot API)."""
        return await self._post("/bot/notify", {
            "telegramId": telegram_id,
            "message": message,
        })

    async def notify_referral_arrival(
        self, referrer_telegram_id: str, new_user_name: str
    ) -> None:
        """Уведомить пригласившего о новом реферале."""
        try:
            await self.notify_user(
                telegram_id=referrer_telegram_id,
                message=(
                    f"👥 По вашей реферальной ссылке зарегистрировался "
                    f"<b>{new_user_name}</b>!\n"
                    f"Когда он сыграет первую игру, вы получите <b>3 000 ᚙ</b>."
                ),
            )
        except Exception as e:
            logger.warning(f"notify_referral_arrival failed: {e}")

    # ─── Статистика ───────────────────────────────────────────────────────────

    async def get_stats(self) -> dict:
        return await self._get("/bot/stats")

    # ─── Администрирование ────────────────────────────────────────────────────

    async def broadcast(self, text: str) -> dict:
        return await self._post("/bot/broadcast", {"text": text})

    async def ban_user(self, telegram_id: str) -> dict:
        return await self._post("/bot/ban", {"telegramId": telegram_id})

    # ─── Уведомления (AdminNotification polling) ──────────────────────────────

    async def get_pending_notifications(self) -> list:
        """Получить несотправленные AdminNotification."""
        data = await self._get("/bot/notifications/pending")
        return data.get("notifications", [])

    async def mark_notification_sent(self, notification_id: str) -> None:
        """Пометить уведомление как отправленное."""
        await self._post(f"/bot/notifications/{notification_id}/sent", {})

    # ─── Реферальная регистрация ──────────────────────────────────────────────

    async def register_referral_start(
        self, new_telegram_id: str, referrer_telegram_id: str
    ) -> None:
        """Сохранить связь реферал→пригласивший до первого auth/login."""
        try:
            await self._post("/bot/referral-start", {
                "newTelegramId": new_telegram_id,
                "referrerTelegramId": referrer_telegram_id,
            })
        except Exception as e:
            logger.warning(f"register_referral_start: {e}")
