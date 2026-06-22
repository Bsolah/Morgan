import { describe, expect, it } from "vitest";
import {
  buildDailySkuUnitSeries,
  classifySkuDemandPattern,
  crostonDemandForecast,
  forecastSkuDemand,
  movingAverageDemandForecast,
  selectTopSkusByRevenue,
  SKU_DEMAND_FORECAST_HORIZON_DAYS,
} from "./sku-demand-forecast.js";

describe("sku demand forecast", () => {
  it("builds a complete daily unit series for a SKU", () => {
    const series = buildDailySkuUnitSeries(
      [
        { day: "2026-06-01", sku: "TEE-BLUE-M", units_sold: 2 },
        { day: "2026-06-03", sku: "TEE-BLUE-M", units_sold: 1 },
        { day: "2026-06-01", sku: "HOODIE-L", units_sold: 5 },
      ],
      "TEE-BLUE-M",
      "2026-06-01",
      "2026-06-03",
    );

    expect(series).toHaveLength(3);
    expect(series[0]?.units).toBe(2);
    expect(series[1]?.units).toBe(0);
    expect(series[2]?.units).toBe(1);
  });

  it("classifies intermittent demand when many zero-sale days", () => {
    const intermittent = Array.from({ length: 30 }, (_, index) => (index % 7 === 0 ? 3 : 0));
    expect(classifySkuDemandPattern(intermittent)).toBe("croston");
  });

  it("classifies high-velocity demand for steady sellers", () => {
    const steady = Array.from({ length: 30 }, () => 4);
    expect(classifySkuDemandPattern(steady)).toBe("moving_average");
  });

  it("forecasts intermittent SKUs with Croston's method", () => {
    const history = Array.from({ length: 60 }, (_, index) => ({
      day: `2026-04-${String((index % 30) + 1).padStart(2, "0")}`,
      units: index % 10 === 0 ? 5 : 0,
    }));

    const forecast = forecastSkuDemand({
      sku: "TEE-BLUE-M",
      history,
      as_of_day: "2026-06-30",
      horizon_days: SKU_DEMAND_FORECAST_HORIZON_DAYS,
    });

    expect(forecast?.model).toBe("croston");
    expect(forecast?.forecast_units_total).toBeGreaterThan(0);
    expect(forecast?.daily).toHaveLength(SKU_DEMAND_FORECAST_HORIZON_DAYS);
  });

  it("forecasts high-velocity SKUs with a moving average", () => {
    const history = Array.from({ length: 60 }, (_, index) => ({
      day: `2026-05-${String((index % 30) + 1).padStart(2, "0")}`,
      units: 3,
    }));

    const forecast = forecastSkuDemand({
      sku: "HOODIE-GRAY-L",
      history,
      as_of_day: "2026-06-30",
    });

    expect(forecast?.model).toBe("moving_average");
    expect(forecast?.avg_daily_units).toBe(3);
    expect(forecast?.forecast_units_total).toBe(90);
  });

  it("returns null when history is too short", () => {
    const forecast = forecastSkuDemand({
      sku: "NEW-SKU",
      history: [{ day: "2026-06-01", units: 1 }],
      as_of_day: "2026-06-30",
    });

    expect(forecast).toBeNull();
  });

  it("selects top SKUs by gross revenue", () => {
    const selected = selectTopSkusByRevenue(
      [
        { sku: "A", gross_revenue: 100 },
        { sku: "B", gross_revenue: 500 },
        { sku: "C", gross_revenue: 250 },
      ],
      2,
    );

    expect(selected.map((row) => row.sku)).toEqual(["B", "C"]);
  });

  it("produces flat Croston daily forecasts across the horizon", () => {
    const history = [
      { day: "2026-06-01", units: 0 },
      { day: "2026-06-02", units: 6 },
      { day: "2026-06-03", units: 0 },
      { day: "2026-06-04", units: 0 },
      { day: "2026-06-05", units: 6 },
    ];
    const result = crostonDemandForecast(history, 7, "2026-06-05");

    expect(result.daily).toHaveLength(7);
    expect(result.daily.every((point) => point.units === result.avg_daily_units)).toBe(true);
  });

  it("uses trailing window for moving average forecasts", () => {
    const history = [
      ...Array.from({ length: 20 }, (_, index) => ({
        day: `2026-05-${String(index + 1).padStart(2, "0")}`,
        units: 1,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        day: `2026-06-${String(index + 1).padStart(2, "0")}`,
        units: 4,
      })),
    ];

    const result = movingAverageDemandForecast(history, 30, "2026-06-30", 10);
    expect(result.avg_daily_units).toBe(4);
    expect(result.forecast_units_total).toBe(120);
  });
});
