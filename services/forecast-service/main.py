from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from revenue_prophet import forecast_revenue_prophet

app = FastAPI(title="Morgan Forecast Service", version="0.1.0")


class HistoryPoint(BaseModel):
    day: str
    net_revenue: float = Field(ge=0)


class RevenueForecastRequest(BaseModel):
    history: list[HistoryPoint]
    horizon_days: int = Field(default=30, ge=1, le=90)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/forecast/revenue")
def forecast_revenue(request: RevenueForecastRequest) -> dict:
    return forecast_revenue_prophet(
        [row.model_dump() for row in request.history],
        horizon_days=request.horizon_days,
    )
