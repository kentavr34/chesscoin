"""Bot configuration — reads from environment variables."""
import os

# Telegram IDs администраторов (через запятую: 123456,789012)
_raw = os.getenv("ADMIN_IDS", "")
ADMIN_IDS: set[int] = {int(x.strip()) for x in _raw.split(",") if x.strip().isdigit()}

# URLs
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000/api/v1")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://chesscoin.app")
