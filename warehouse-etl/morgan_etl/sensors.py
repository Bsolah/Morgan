from __future__ import annotations

from dagster import DefaultSensorStatus, RunRequest, SensorEvaluationContext, sensor

from morgan_etl.jobs import chat_gold_refresh_job
from morgan_etl.resources import default_chat_refresh_resource


@sensor(
    job=chat_gold_refresh_job,
    minimum_interval_seconds=30,
    default_status=DefaultSensorStatus.RUNNING,
    description="Triggers gold refresh when chat/API enqueues a pending request.",
)
def chat_gold_refresh_sensor(context: SensorEvaluationContext):
    resource = default_chat_refresh_resource()
    request = resource.pop_pending_request()
    if not request:
        return

    store_id = request.get("store_id")
    trigger = request.get("trigger", "chat")
    context.log.info("On-demand gold refresh requested trigger=%s store_id=%s", trigger, store_id)

    tags = {"trigger": trigger}
    if store_id:
        tags["store_id"] = str(store_id)

    yield RunRequest(run_key=f"chat-refresh:{request.get('request_id', trigger)}", tags=tags)
