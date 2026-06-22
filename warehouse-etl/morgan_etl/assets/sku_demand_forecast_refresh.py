from __future__ import annotations

import os

import httpx
from dagster import AssetExecutionContext, asset

from morgan_etl.assets.revenue_forecast_refresh import refresh_revenue_forecasts


@asset(deps=[refresh_revenue_forecasts], group_name="warehouse")
def refresh_sku_demand_forecasts(context: AssetExecutionContext) -> dict:
    """Refresh due 30-day SKU demand forecasts for top revenue SKUs."""
    api_base = os.getenv("MORGAN_API_BASE_URL", "http://localhost:8080").rstrip("/")
    internal_key = os.getenv("COMPLIANCE_INTERNAL_KEY", "")

    if not internal_key:
        context.log.warning("COMPLIANCE_INTERNAL_KEY not set; skipping SKU demand forecast refresh")
        return {"status": "skipped", "reason": "missing_internal_key"}

    response = httpx.post(
        f"{api_base}/api/v1/internal/forecasts/sku-demand/refresh",
        headers={"x-compliance-internal-key": internal_key},
        json={},
        timeout=600.0,
    )
    response.raise_for_status()
    payload = response.json()
    refreshed = [row for row in payload.get("results", []) if row.get("refreshed")]
    context.log.info("SKU demand forecast refresh completed for %s stores", len(refreshed))
    return payload
