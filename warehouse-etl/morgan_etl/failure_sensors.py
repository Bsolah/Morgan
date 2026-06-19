from __future__ import annotations

from dagster import AssetSelection, RunFailureSensorContext, run_failure_sensor

from morgan_etl.alerts import notify_dbt_failure
from morgan_etl.jobs import chat_gold_refresh_job, gold_refresh_job


@run_failure_sensor(
    name="dbt_failure_alert_sensor",
    monitored_jobs=[gold_refresh_job, chat_gold_refresh_job],
    minimum_interval_seconds=60,
)
def dbt_failure_alert_sensor(context: RunFailureSensorContext):
    notify_dbt_failure(context, context.failure_event.message)
