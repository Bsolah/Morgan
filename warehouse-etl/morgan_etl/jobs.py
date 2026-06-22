from __future__ import annotations

from dagster import AssetSelection, define_asset_job

from morgan_etl.assets.dbt_assets import morgan_dbt_assets
from morgan_etl.assets.metric_snapshots import refresh_metric_snapshots
from morgan_etl.assets.profit_leak_scan import scan_profit_leaks

gold_refresh_job = define_asset_job(
    name="gold_refresh_job",
    selection=AssetSelection.tag("gold")
    | AssetSelection.assets(refresh_metric_snapshots, scan_profit_leaks),
    description="Refresh gold marts, metric snapshots, and run due profit leak scans.",
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
