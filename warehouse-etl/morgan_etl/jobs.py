from __future__ import annotations

from dagster import AssetSelection, define_asset_job

from morgan_etl.assets.dbt_assets import morgan_dbt_assets

gold_refresh_job = define_asset_job(
    name="gold_refresh_job",
    selection=AssetSelection.tag("gold"),
    description="Refresh gold marts for engine and chat consumption.",
)

chat_gold_refresh_job = define_asset_job(
    name="chat_gold_refresh_job",
    selection=AssetSelection.tag("gold"),
    description="On-demand gold refresh triggered by chat queries.",
)
