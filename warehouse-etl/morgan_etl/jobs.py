from __future__ import annotations

from dagster import AssetSelection, define_asset_job

from morgan_etl.assets.dbt_assets import morgan_dbt_assets
from morgan_etl.assets.metric_snapshots import refresh_metric_snapshots
from morgan_etl.assets.profit_leak_scan import scan_profit_leaks
from morgan_etl.assets.revenue_forecast_refresh import refresh_revenue_forecasts
from morgan_etl.assets.sku_demand_forecast_refresh import refresh_sku_demand_forecasts

gold_refresh_job = define_asset_job(
    name="gold_refresh_job",
    selection=AssetSelection.tag("gold")
    | AssetSelection.assets(
        refresh_metric_snapshots,
        scan_profit_leaks,
        refresh_revenue_forecasts,
        refresh_sku_demand_forecasts,
    ),
    description="Refresh gold marts, metric snapshots, leak scans, and forecasts.",
)

chat_gold_refresh_job = define_asset_job(
    name="chat_gold_refresh_job",
    selection=AssetSelection.tag("gold"),
    description="On-demand gold refresh triggered by chat queries.",
)

profit_leak_scan_job = define_asset_job(
    name="profit_leak_scan_job",
    selection=AssetSelection.assets(scan_profit_leaks),
    description="Scan for profit leaks after gold mart refresh (US-18-05).",
)

revenue_forecast_job = define_asset_job(
    name="revenue_forecast_job",
    selection=AssetSelection.assets(refresh_revenue_forecasts),
    description="Refresh 30-day revenue forecasts (US-19-01).",
)

sku_demand_forecast_job = define_asset_job(
    name="sku_demand_forecast_job",
    selection=AssetSelection.assets(refresh_sku_demand_forecasts),
    description="Refresh 30-day SKU demand forecasts (US-19-03).",
)
