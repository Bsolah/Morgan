import {
  buildSkuInventoryHealth,
  type SkuInventoryHealth,
  type SkuInventoryInput,
} from "./inventory-health.js";
import type { SkuDemandForecastResult } from "../forecast/sku-demand-forecast.js";

export type SkuPlanningInput = SkuInventoryInput & {
  demand_forecast?: SkuDemandForecastResult | null;
};

export type SkuInventoryPlanning = SkuInventoryHealth & {
  observed_velocity_per_day: number;
  forecasted_velocity_per_day: number | null;
  forecast_model: SkuDemandForecastResult["model"] | null;
  forecast_units_30d: number | null;
  planning_velocity_per_day: number;
};

export function resolvePlanningVelocity(
  observedVelocityPerDay: number,
  forecast?: SkuDemandForecastResult | null,
): number {
  if (forecast && forecast.avg_daily_units > 0) {
    return forecast.avg_daily_units;
  }
  return observedVelocityPerDay;
}

export function buildSkuInventoryPlanning(
  input: SkuPlanningInput,
  referenceDay: string,
  leadTimeDays?: number,
): SkuInventoryPlanning {
  const observedVelocity = input.velocity_per_day;
  const planningVelocity = resolvePlanningVelocity(observedVelocity, input.demand_forecast);

  const health = buildSkuInventoryHealth(
    {
      ...input,
      velocity_per_day: planningVelocity,
      daily_demand_units: input.demand_forecast?.history_daily_units,
      revenue_rank: input.revenue_rank ?? null,
      avg_daily_net_outflow: input.avg_daily_net_outflow ?? null,
    },
    referenceDay,
    leadTimeDays,
  );

  return {
    ...health,
    observed_velocity_per_day: Math.round(observedVelocity * 100) / 100,
    forecasted_velocity_per_day: input.demand_forecast?.avg_daily_units ?? null,
    forecast_model: input.demand_forecast?.model ?? null,
    forecast_units_30d: input.demand_forecast?.forecast_units_total ?? null,
    planning_velocity_per_day: health.velocity_per_day,
  };
}
