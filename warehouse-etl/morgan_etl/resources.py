from __future__ import annotations

import json
import os
from pathlib import Path

from dagster import ConfigurableResource


class ChatRefreshSignalResource(ConfigurableResource):
    """Reads pending on-demand gold refresh requests (Redis or filesystem fallback)."""

    redis_url: str = ""
    filesystem_signal_path: str = "./data/warehouse/chat_refresh.pending"

    def pop_pending_request(self) -> dict | None:
        if self.redis_url:
            try:
                import redis

                client = redis.from_url(self.redis_url, decode_responses=True)
                raw = client.lpop("warehouse:gold_refresh:pending")
                if raw:
                    return json.loads(raw)
            except Exception:
                pass

        path = Path(self.filesystem_signal_path)
        if not path.exists():
            return None

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            path.unlink(missing_ok=True)
            return payload
        except Exception:
            path.unlink(missing_ok=True)
            return None


def default_chat_refresh_resource() -> ChatRefreshSignalResource:
    return ChatRefreshSignalResource(
        redis_url=os.getenv("REDIS_URL", ""),
        filesystem_signal_path=os.getenv(
            "WAREHOUSE_CHAT_REFRESH_SIGNAL_PATH",
            "./data/warehouse/chat_refresh.pending",
        ),
    )
