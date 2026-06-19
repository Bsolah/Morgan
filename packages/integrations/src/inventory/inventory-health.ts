export const INVENTORY_HEALTH_WINDOW_DAYS = 30;
export const STOCKOUT_RISK_DAYS = 14;
export const STOCKOUT_CRITICAL_DAYS = 7;
export const OVERSTOCK_DAYS = 90;
export const DEFAULT_LEAD_TIME_DAYS = 14;
export const REORDER_SAFETY_DAYS = 14;
export const SAFETY_STOCK_Z_SCORE = 1.65;

export type InventoryHealthStatus = "critical" | "warning" | "healthy" | "unknown";

export type SkuInventoryInput = {
  sku: string;
  title?: string;
  available_units: number;
  velocity_per_day: number;
  gross_revenue: number;
  unit_cost: number | null;
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

export function computeSafetyStockUnits(velocityPerDay: number, leadTimeDays: number): number {
  if (velocityPerDay <= 0 || leadTimeDays <= 0) return 0;
  return Math.ceil(SAFETY_STOCK_Z_SCORE * velocityPerDay * Math.sqrt(leadTimeDays));
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

export function buildReorderRecommendation(input: {
  sku: string;
  availableUnits: number;
  velocityPerDay: number;
  daysOfStock: number | null;
  leadTimeDays?: number;
  referenceDay: string;
}): {
  reorder_recommended: boolean;
  reorder_qty: number | null;
  reorder_by_day: string | null;
  recommendation_title: string | null;
  recommendation_body: string | null;
} {
  const leadTimeDays = input.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const { sku, availableUnits, velocityPerDay, daysOfStock, referenceDay } = input;

  if (velocityPerDay <= 0 || daysOfStock == null || daysOfStock >= STOCKOUT_RISK_DAYS) {
    return {
      reorder_recommended: false,
      reorder_qty: null,
      reorder_by_day: null,
      recommendation_title: null,
      recommendation_body: null,
    };
  }

  const targetCoverDays = leadTimeDays + REORDER_SAFETY_DAYS;
  const reorderQty = Math.max(0, Math.ceil(velocityPerDay * targetCoverDays - availableUnits));
  const daysUntilReorder = Math.max(0, Math.floor(daysOfStock - leadTimeDays));
  const reorderByDay = addDaysToDayString(referenceDay, daysUntilReorder);

  const roundedQty = reorderQty > 0 ? reorderQty : Math.ceil(velocityPerDay * targetCoverDays);

  return {
    reorder_recommended: true,
    reorder_qty: roundedQty,
    reorder_by_day: reorderByDay,
    recommendation_title: `Reorder ${sku}`,
    recommendation_body: `Place a PO for ${roundedQty} units by ${reorderByDay}. At ${velocityPerDay.toFixed(1)}/day you have about ${daysOfStock.toFixed(0)} days of stock left.`,
  };
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
  const safetyStockUnits = computeSafetyStockUnits(input.velocity_per_day, leadTimeDays);
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
    ...reorder,
  };
}

export function summarizeInventoryHealth(skus: SkuInventoryHealth[]): InventoryHealthSummary {
  return {
    stockout_risk_count: skus.filter((sku) => sku.stockout_risk).length,
    overstock_count: skus.filter((sku) => sku.overstock).length,
    overstock_value_usd: skus.reduce((sum, sku) => sum + sku.overstock_value_usd, 0),
  };
}

export function rankSkusForInventoryHealth(skus: SkuInventoryHealth[]): SkuInventoryHealth[] {
  return [...skus].sort((left, right) => right.gross_revenue - left.gross_revenue);
}
