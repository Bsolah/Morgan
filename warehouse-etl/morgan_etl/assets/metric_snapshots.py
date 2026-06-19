from __future__ import annotations

import os

import httpx
from dagster import AssetExecutionContext, asset

from morgan_etl.assets.dbt_assets import morgan_dbt_assets


@asset(deps=[morgan_dbt_assets], group_name="warehouse")
def refresh_metric_snapshots(context: AssetExecutionContext) -> dict:
    """Refresh Postgres metric_snapshots after gold mart build."""
    api_base = os.getenv("MORGAN_API_BASE_URL", "http://localhost:8080").rstrip("/")
    internal_key = os.getenv("COMPLIANCE_INTERNAL_KEY", "")

    if not internal_key:
        context.log.warning("COMPLIANCE_INTERNAL_KEY not set; skipping metric snapshot refresh")
        return {"status": "skipped", "reason": "missing_internal_key"}

    response = httpx.post(
        f"{api_base}/api/v1/internal/warehouse/refresh-metric-snapshots",
        headers={"x-compliance-internal-key": internal_key},
        json={},
        timeout=120.0,
    )
    response.raise_for_status()
    payload = response.json()
    context.log.info("Refreshed metric snapshots for %s stores", len(payload.get("results", [])))
    return payload
