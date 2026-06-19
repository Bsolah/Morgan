from __future__ import annotations

import json
import os
from typing import Any

import httpx


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def notify_dbt_failure(context: Any, error_message: str) -> None:
    """Alert engineering when a dbt/Dagster gold refresh fails."""
    slack_webhook = _env("SLACK_ALERT_WEBHOOK_URL")
    pagerduty_routing_key = _env("PAGERDUTY_ROUTING_KEY")
    run_id = getattr(context, "run_id", "unknown")
    job_name = getattr(getattr(context, "job_def", None), "name", "unknown")

    payload = {
        "job": job_name,
        "run_id": str(run_id),
        "error": error_message[:4000],
    }

    if slack_webhook:
        _post_slack(slack_webhook, payload)

    if pagerduty_routing_key:
        _post_pagerduty(pagerduty_routing_key, payload)


def _post_slack(webhook_url: str, payload: dict[str, str]) -> None:
    body = {
        "text": (
            f":warning: Morgan dbt gold refresh failed\n"
            f"*Job:* {payload['job']}\n"
            f"*Run:* {payload['run_id']}\n"
            f"*Error:* {payload['error']}"
        )
    }
    httpx.post(webhook_url, json=body, timeout=10.0).raise_for_status()


def _post_pagerduty(routing_key: str, payload: dict[str, str]) -> None:
    event = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": f"Morgan dbt failure: {payload['job']}",
            "source": "morgan-dagster",
            "severity": "error",
            "custom_details": payload,
        },
    }
    httpx.post(
        "https://events.pagerduty.com/v2/enqueue",
        json=event,
        timeout=10.0,
    ).raise_for_status()
