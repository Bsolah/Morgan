from __future__ import annotations

import os

import httpx
from dagster import AssetExecutionContext, asset

from morgan_etl.assets.profit_leak_scan import scan_profit_leaks


@asset(deps=[scan_profit_leaks], group_name="warehouse")
def refresh_revenue_forecasts(context: AssetExecutionContext) -> dict:
    """Refresh due 30-day revenue forecasts after gold mart refresh."""
    api_base = os.getenv("MORGAN_API_BASE_URL", "http://localhost:8080").rstrip("/")
    internal_key = os.getenv("COMPLIANCE_INTERNAL_KEY", "")

    if not internal_key:
        context.log.warning("COMPLIANCE_INTERNAL_KEY not set; skipping revenue forecast refresh")
        return {"status": "skipped", "reason": "missing_internal_key"}

    response = httpx.post(
        f"{api_base}/api/v1/internal/forecasts/revenue/refresh",
        headers={"x-compliance-internal-key": internal_key},
        json={},
        timeout=600.0,
    )
    response.raise_for_status()
    payload = response.json()
    refreshed = [row for row in payload.get("results", []) if row.get("refreshed")]
    context.log.info("Revenue forecast refresh completed for %s stores", len(refreshed))
    return payload
