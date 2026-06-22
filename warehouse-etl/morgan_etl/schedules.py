from __future__ import annotations

from dagster import DefaultScheduleStatus, ScheduleDefinition

from morgan_etl.jobs import gold_refresh_job, revenue_forecast_job

hourly_gold_refresh_schedule = ScheduleDefinition(
    job=gold_refresh_job,
    cron_schedule="0 * * * *",
    default_status=DefaultScheduleStatus.RUNNING,
    description="Hourly gold mart refresh (US-08-02).",
)

nightly_revenue_forecast_schedule = ScheduleDefinition(
    job=revenue_forecast_job,
    cron_schedule="0 6 * * *",
    default_status=DefaultScheduleStatus.RUNNING,
    description="Nightly 30-day revenue forecast refresh (US-19-01).",
)
