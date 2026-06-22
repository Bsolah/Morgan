from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pandas as pd
from prophet import Prophet

MIN_HISTORY_DAYS = 60
TRAIN_MIN_DAYS = 90
HORIZON_DAYS_DEFAULT = 30
MAPE_HOLDOUT_DAYS = 14


@dataclass
class DailyPoint:
    day: str
    p10: float
    p50: float
    p90: float


def _compute_mape(actual: list[float], predicted: list[float]) -> float | None:
    if len(actual) == 0 or len(actual) != len(predicted):
        return None

    total = 0.0
    count = 0
    for truth, forecast in zip(actual, predicted, strict=False):
        if truth <= 0:
            continue
        total += abs((truth - forecast) / truth)
        count += 1

    if count == 0:
        return None
    return total / count


def _build_cumulative(daily: list[DailyPoint]) -> list[dict]:
    cumulative_p10 = 0.0
    cumulative_p50 = 0.0
    cumulative_p90 = 0.0
    rows: list[dict] = []

    for point in daily:
        cumulative_p10 += point.p10
        cumulative_p50 += point.p50
        cumulative_p90 += point.p90
        rows.append(
            {
                "day": point.day,
                "p10": round(cumulative_p10),
                "p50": round(cumulative_p50),
                "p90": round(cumulative_p90),
            }
        )

    return rows


def _insufficient_message(history_days: int) -> str:
    if history_days < MIN_HISTORY_DAYS:
        return "Insufficient data — need at least 60 days of sales history."
    return f"Insufficient data — need at least {TRAIN_MIN_DAYS} days of sales history to train the forecast."


def forecast_revenue_prophet(
    history: list[dict],
    horizon_days: int = HORIZON_DAYS_DEFAULT,
) -> dict:
    sorted_history = sorted(history, key=lambda row: row["day"])
    history_days = len(sorted_history)

    if history_days < MIN_HISTORY_DAYS:
        return {
            "status": "insufficient_data",
            "message": _insufficient_message(history_days),
            "history_days": history_days,
            "mape": None,
            "model": "prophet",
            "daily": [],
            "cumulative": [],
        }

    if history_days < TRAIN_MIN_DAYS:
        return {
            "status": "insufficient_data",
            "message": _insufficient_message(history_days),
            "history_days": history_days,
            "mape": None,
            "model": "prophet",
            "daily": [],
            "cumulative": [],
        }

    frame = pd.DataFrame(
        {
            "ds": pd.to_datetime([row["day"] for row in sorted_history]),
            "y": [float(row["net_revenue"]) for row in sorted_history],
        }
    )

    holdout = min(MAPE_HOLDOUT_DAYS, max(7, history_days // 6))
    train_frame = frame.iloc[:-holdout].copy() if holdout > 0 and len(frame) > holdout else frame.copy()
    holdout_frame = frame.iloc[-holdout:].copy() if holdout > 0 and len(frame) > holdout else frame.iloc[0:0]

    mape: float | None = None
    if len(train_frame) >= TRAIN_MIN_DAYS and len(holdout_frame) > 0:
        backtest_model = Prophet(
            interval_width=0.8,
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=len(train_frame) >= 365,
        )
        backtest_model.fit(train_frame)
        future = backtest_model.make_future_dataframe(periods=len(holdout_frame), include_history=False)
        forecast = backtest_model.predict(future)
        predicted = [max(0.0, float(value)) for value in forecast["yhat"].tolist()]
        actual = [max(0.0, float(value)) for value in holdout_frame["y"].tolist()]
        mape = _compute_mape(actual, predicted)

    model = Prophet(
        interval_width=0.8,
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=len(frame) >= 365,
    )
    model.fit(frame)
    future = model.make_future_dataframe(periods=horizon_days, include_history=False)
    forecast = model.predict(future)

    daily: list[DailyPoint] = []
    for _, row in forecast.iterrows():
        daily.append(
            DailyPoint(
                day=row["ds"].strftime("%Y-%m-%d"),
                p10=max(0.0, float(row["yhat_lower"])),
                p50=max(0.0, float(row["yhat"])),
                p90=max(0.0, float(row["yhat_upper"])),
            )
        )

    return {
        "status": "ready",
        "message": None,
        "history_days": history_days,
        "mape": mape,
        "model": "prophet",
        "daily": [
            {
                "day": point.day,
                "p10": round(point.p10),
                "p50": round(point.p50),
                "p90": round(point.p90),
            }
            for point in daily
        ],
        "cumulative": _build_cumulative(daily),
    }
