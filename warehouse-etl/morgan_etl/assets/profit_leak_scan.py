from __future__ import annotations

import os

import httpx
from dagster import AssetExecutionContext, asset

from morgan_etl.assets.metric_snapshots import refresh_metric_snapshots


@asset(deps=[refresh_metric_snapshots], group_name="warehouse")
def scan_profit_leaks(context: AssetExecutionContext) -> dict:
    """Run due profit leak scans after gold mart refresh and metric snapshots."""
    api_base = os.getenv("MORGAN_API_BASE_URL", "http://localhost:8080").rstrip("/")
    internal_key = os.getenv("COMPLIANCE_INTERNAL_KEY", "")

    if not internal_key:
        context.log.warning("COMPLIANCE_INTERNAL_KEY not set; skipping profit leak scan")
        return {"status": "skipped", "reason": "missing_internal_key"}

    response = httpx.post(
        f"{api_base}/api/v1/internal/profit-leaks/scan",
        headers={"x-compliance-internal-key": internal_key},
        json={},
        timeout=300.0,
    )
    response.raise_for_status()
    payload = response.json()
    scanned = [row for row in payload.get("results", []) if row.get("scanned")]
    context.log.info("Profit leak scan completed for %s stores", len(scanned))
    return payload
