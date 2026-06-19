#!/usr/bin/env python3
"""Parse the Morgan dbt project (CI smoke test)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def run_dbt_cli(args: list[str], cwd: Path) -> None:
    previous_argv = sys.argv[:]
    previous_cwd = Path.cwd()
    try:
        os.chdir(cwd)
        sys.argv = ["dbt", *args]
        from dbt.cli.main import cli

        cli()
    finally:
        os.chdir(previous_cwd)
        sys.argv = previous_argv


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    dbt_dir = root / "warehouse-etl" / "dbt"

    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "dbt-clickhouse>=1.8.0"],
        cwd=root,
    )

    run_dbt_cli(["deps"], dbt_dir)
    run_dbt_cli(["parse", "--profiles-dir", str(dbt_dir)], dbt_dir)

    print("dbt parse succeeded")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
