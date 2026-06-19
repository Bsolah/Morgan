from __future__ import annotations

import os
from pathlib import Path

from dagster import Definitions, EnvVar
from dagster_dbt import DbtCliResource

from morgan_etl.assets.dbt_assets import morgan_dbt_assets
from morgan_etl.assets.metric_snapshots import refresh_metric_snapshots
from morgan_etl.jobs import chat_gold_refresh_job, gold_refresh_job
from morgan_etl.resources import ChatRefreshSignalResource, default_chat_refresh_resource
from morgan_etl.failure_sensors import dbt_failure_alert_sensor
from morgan_etl.schedules import hourly_gold_refresh_schedule
from morgan_etl.sensors import chat_gold_refresh_sensor

DBT_PROJECT_DIR = Path(__file__).resolve().parents[1] / "dbt"


def build_definitions() -> Definitions:
    profiles_dir = os.getenv("DBT_PROFILES_DIR", str(DBT_PROJECT_DIR))
    dbt = DbtCliResource(project_dir=str(DBT_PROJECT_DIR), profiles_dir=profiles_dir)

    return Definitions(
        assets=[morgan_dbt_assets, refresh_metric_snapshots],
        jobs=[gold_refresh_job, chat_gold_refresh_job],
        schedules=[hourly_gold_refresh_schedule],
        sensors=[chat_gold_refresh_sensor, dbt_failure_alert_sensor],
        resources={
            "dbt": dbt,
            "chat_refresh_signal": default_chat_refresh_resource(),
        },
    )


defs = build_definitions()


def main() -> None:
    from dagster.cli import main as dagster_main

    dagster_main(["dev", "-m", "morgan_etl.definitions"])
