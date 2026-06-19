from __future__ import annotations

import os
from pathlib import Path

from dagster import AssetExecutionContext, Failure
from dagster_dbt import DbtCliResource, DbtProject, dbt_assets

from morgan_etl.alerts import notify_dbt_failure

DBT_PROJECT_DIR = Path(__file__).resolve().parents[2] / "dbt"
dbt_project = DbtProject(project_dir=DBT_PROJECT_DIR)
dbt_project.prepare_if_dev()


@dbt_assets(manifest=dbt_project.manifest_path)
def morgan_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    store_id = context.run_tags.get("store_id")
    if store_id:
        context.log.info("On-demand refresh scoped to store_id=%s", store_id)

    try:
        yield from dbt.cli(["build"], context=context).stream()
    except Exception as error:
        notify_dbt_failure(context, str(error))
        raise Failure(str(error)) from error
