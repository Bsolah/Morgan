export const INVENTORY_HEALTH_WINDOW_DAYS = 30;
export const STOCKOUT_RISK_DAYS = 14;
export const STOCKOUT_CRITICAL_DAYS = 7;
export const OVERSTOCK_DAYS = 90;
export const DEFAULT_LEAD_TIME_DAYS = 14;
export const REORDER_SAFETY_DAYS = 14;
export { SAFETY_STOCK_Z_SCORE } from "./inventory-reorder.js";
import {
  buildReorderRecommendationCopy,
  computeDemandStdDev,
  computeReorderCostUsd,
  computeReorderPointUnits,
  computeReorderQty,
  computeRunwayImpactDays,
  computeSafetyStockUnits,
  SAFETY_STOCK_Z_SCORE,
} from "./inventory-reorder.js";

export type InventoryHealthStatus = "critical" | "warning" | "healthy" | "unknown";

export type SkuInventoryInput = {
  sku: string;
  title?: string;
  available_units: number;
  velocity_per_day: number;
  gross_revenue: number;
  unit_cost: number | null;
  daily_demand_units?: number[];
  revenue_rank?: number | null;
  avg_daily_net_outflow?: number | null;
};

export type SkuInventoryHealth = {
  sku: string;
  title: string | null;
  available_units: number;
  velocity_per_day: number;
  gross_revenue: number;
  days_of_stock: number | null;
  health_status: InventoryHealthStatus;
  stockout_risk: boolean;
  overstock: boolean;
  overstock_value_usd: number;
  lead_time_days: number;
  safety_stock_units: number;
  reorder_point_units: number;
  reorder_cost_usd: number;
  runway_impact_days: number | null;
  revenue_rank: number | null;
  reorder_recommended: boolean;
  reorder_qty: number | null;
  reorder_by_day: string | null;
  recommendation_title: string | null;
  recommendation_body: string | null;
};

export type InventoryHealthSummary = {
  stockout_risk_count: number;
  overstock_count: number;
  overstock_value_usd: number;
  total_sku_count: number;
  avg_days_of_cover: number | null;
};

export function computeDaysOfStock(availableUnits: number, velocityPerDay: number): number | null {
  if (availableUnits <= 0) return 0;
  if (velocityPerDay <= 0) return null;
  return Math.round((availableUnits / velocityPerDay) * 10) / 10;
}

export function inventoryHealthStatus(daysOfStock: number | null): InventoryHealthStatus {
  if (daysOfStock == null) return "unknown";
  if (daysOfStock < STOCKOUT_CRITICAL_DAYS) return "critical";
  if (daysOfStock < STOCKOUT_RISK_DAYS) return "warning";
  return "healthy";
}

export function computeSafetyStockFromDemand(input: {
  daily_demand_units?: number[];
  avg_daily_velocity: number;
  lead_time_days: number;
}): number {
  const demandStdDev =
    input.daily_demand_units && input.daily_demand_units.length > 0
      ? computeDemandStdDev(input.daily_demand_units)
      : Math.sqrt(Math.max(input.avg_daily_velocity, 0));

  return computeSafetyStockUnits(demandStdDev, input.lead_time_days, SAFETY_STOCK_Z_SCORE);
}

export function buildReorderRecommendation(input: {
  sku: string;
  availableUnits: number;
  velocityPerDay: number;
  daysOfStock: number | null;
  leadTimeDays?: number;
  referenceDay: string;
  unitCost?: number | null;
  dailyDemandUnits?: number[];
  avgDailyNetOutflow?: number | null;
}): {
  reorder_recommended: boolean;
  reorder_point_units: number;
  reorder_qty: number | null;
  reorder_cost_usd: number;
  runway_impact_days: number | null;
  reorder_by_day: string | null;
  recommendation_title: string | null;
  recommendation_body: string | null;
} {
  const leadTimeDays = input.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const { sku, availableUnits, velocityPerDay, daysOfStock, referenceDay } = input;

  if (velocityPerDay <= 0) {
    return {
      reorder_recommended: false,
      reorder_point_units: 0,
      reorder_qty: null,
      reorder_cost_usd: 0,
      runway_impact_days: null,
      reorder_by_day: null,
      recommendation_title: null,
      recommendation_body: null,
    };
  }

  const safetyStockUnits = computeSafetyStockFromDemand({
    daily_demand_units: input.dailyDemandUnits,
    avg_daily_velocity: velocityPerDay,
    lead_time_days: leadTimeDays,
  });
  const reorderPointUnits = computeReorderPointUnits(velocityPerDay, leadTimeDays, safetyStockUnits);
  const reorderQty = computeReorderQty(reorderPointUnits, availableUnits, velocityPerDay, leadTimeDays);
  const reorderRecommended = availableUnits <= reorderPointUnits && reorderQty > 0;
  const reorderCostUsd = computeReorderCostUsd(reorderQty, input.unitCost ?? null);
  const runwayImpactDays = computeRunwayImpactDays(reorderCostUsd, input.avgDailyNetOutflow ?? null);

  if (!reorderRecommended) {
    return {
      reorder_recommended: false,
      reorder_point_units: Math.round(reorderPointUnits * 10) / 10,
      reorder_qty: null,
      reorder_cost_usd: 0,
      runway_impact_days: null,
      reorder_by_day: null,
      recommendation_title: null,
      recommendation_body: null,
    };
  }

  const daysUntilReorder =
    availableUnits > reorderPointUnits
      ? Math.max(0, Math.floor((availableUnits - reorderPointUnits) / velocityPerDay))
      : 0;
  const reorderByDay = addDaysToDayString(referenceDay, daysUntilReorder);
  const copy = buildReorderRecommendationCopy({
    sku,
    reorder_qty: reorderQty,
    reorder_cost_usd: reorderCostUsd,
    reorder_by_day: reorderByDay,
    runway_impact_days: runwayImpactDays,
    avg_daily_velocity: velocityPerDay,
    days_of_stock: daysOfStock,
  });

  return {
    reorder_recommended: true,
    reorder_point_units: Math.round(reorderPointUnits * 10) / 10,
    reorder_qty: reorderQty,
    reorder_cost_usd: reorderCostUsd,
    runway_impact_days: runwayImpactDays,
    reorder_by_day: reorderByDay,
    recommendation_title: copy.title,
    recommendation_body: copy.body,
  };
}

export function isStockoutRisk(
  daysOfStock: number | null,
  velocityPerDay: number,
  availableUnits: number,
  safetyStockUnits: number,
): boolean {
  if (velocityPerDay <= 0) return false;
  if (availableUnits <= safetyStockUnits) return true;
  return daysOfStock != null && daysOfStock < STOCKOUT_RISK_DAYS;
}

export function isOverstock(
  daysOfStock: number | null,
  velocityPerDay: number,
  availableUnits: number,
): boolean {
  if (availableUnits <= 0) return false;
  if (velocityPerDay <= 0) return true;
  return daysOfStock != null && daysOfStock > OVERSTOCK_DAYS;
}

export function computeOverstockValueUsd(
  availableUnits: number,
  velocityPerDay: number,
  unitCost: number | null,
  overstockDays = OVERSTOCK_DAYS,
): number {
  if (availableUnits <= 0 || unitCost == null || unitCost <= 0) return 0;
  const targetUnits = velocityPerDay > 0 ? velocityPerDay * overstockDays : 0;
  const excessUnits = velocityPerDay > 0 ? Math.max(0, availableUnits - targetUnits) : availableUnits;
  return Math.round(excessUnits * unitCost);
}

export function addDaysToDayString(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function buildSkuInventoryHealth(
  input: SkuInventoryInput,
  referenceDay: string,
  leadTimeDays = DEFAULT_LEAD_TIME_DAYS,
): SkuInventoryHealth {
  const daysOfStock = computeDaysOfStock(input.available_units, input.velocity_per_day);
  const safetyStockUnits = computeSafetyStockFromDemand({
    daily_demand_units: input.daily_demand_units,
    avg_daily_velocity: input.velocity_per_day,
    lead_time_days: leadTimeDays,
  });
  const stockoutRisk = isStockoutRisk(
    daysOfStock,
    input.velocity_per_day,
    input.available_units,
    safetyStockUnits,
  );
  const overstock = isOverstock(daysOfStock, input.velocity_per_day, input.available_units);
  const overstockValue = overstock
    ? computeOverstockValueUsd(input.available_units, input.velocity_per_day, input.unit_cost)
    : 0;
  const reorder = buildReorderRecommendation({
    sku: input.sku,
    availableUnits: input.available_units,
    velocityPerDay: input.velocity_per_day,
    daysOfStock,
    leadTimeDays,
    referenceDay,
    unitCost: input.unit_cost,
    dailyDemandUnits: input.daily_demand_units,
    avgDailyNetOutflow: input.avg_daily_net_outflow,
  });

  return {
    sku: input.sku,
    title: input.title ?? null,
    available_units: input.available_units,
    velocity_per_day: Math.round(input.velocity_per_day * 100) / 100,
    gross_revenue: Math.round(input.gross_revenue * 100) / 100,
    days_of_stock: daysOfStock,
    health_status: inventoryHealthStatus(daysOfStock),
    stockout_risk: stockoutRisk,
    overstock,
    overstock_value_usd: overstockValue,
    lead_time_days: leadTimeDays,
    safety_stock_units: safetyStockUnits,
    reorder_point_units: reorder.reorder_point_units,
    reorder_cost_usd: reorder.reorder_cost_usd,
    runway_impact_days: reorder.runway_impact_days,
    revenue_rank: input.revenue_rank ?? null,
    ...reorder,
  };
}

export function summarizeInventoryHealth(skus: SkuInventoryHealth[]): InventoryHealthSummary {
  const coverValues = skus
    .map((sku) => sku.days_of_stock)
    .filter((days): days is number => days != null);
  const avgDaysOfCover =
    coverValues.length > 0
      ? Math.round((coverValues.reduce((sum, days) => sum + days, 0) / coverValues.length) * 10) / 10
      : null;

  return {
    stockout_risk_count: skus.filter((sku) => sku.stockout_risk).length,
    overstock_count: skus.filter((sku) => sku.overstock).length,
    overstock_value_usd: skus.reduce((sum, sku) => sum + sku.overstock_value_usd, 0),
    total_sku_count: skus.length,
    avg_days_of_cover: avgDaysOfCover,
  };
}

const HEALTH_STATUS_RANK: Record<InventoryHealthStatus, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
};

/** US-UX-12-01 — default inventory list sort: stockout risk first, then fewest days of cover. */
export function rankSkusByStockoutRisk<T extends SkuInventoryHealth>(skus: T[]): T[] {
  return [...skus].sort((left, right) => {
    const riskDelta = Number(right.stockout_risk) - Number(left.stockout_risk);
    if (riskDelta !== 0) return riskDelta;

    const statusDelta = HEALTH_STATUS_RANK[left.health_status] - HEALTH_STATUS_RANK[right.health_status];
    if (statusDelta !== 0) return statusDelta;

    const leftDays = left.days_of_stock ?? Number.POSITIVE_INFINITY;
    const rightDays = right.days_of_stock ?? Number.POSITIVE_INFINITY;
    return leftDays - rightDays;
  });
}

export function rankSkusForInventoryHealth(skus: SkuInventoryHealth[]): SkuInventoryHealth[] {
  return [...skus].sort((left, right) => right.gross_revenue - left.gross_revenue);
}
