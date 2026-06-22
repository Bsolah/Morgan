import { computeDaysOfStock } from "../inventory/inventory-health.js";
import { extractOrderDay } from "./contribution-margin.js";
import { isOrderCancelled } from "./discount-bleed-leak.js";

export const DEAD_STOCK_THRESHOLDS = {
  min_days_of_stock: 90,
  velocity_decline_ratio: 0.7,
  short_velocity_days: 30,
  long_velocity_days: 90,
  liquidate_days_of_stock: 180,
} as const;

export type SkuUnitSale = {
  day: string;
  order_id: string;
  sku: string;
  units_sold: number;
};

export type DeadStockSkuInput = {
  sku: string;
  title?: string | null;
  available_units: number;
  unit_cost: number | null;
  velocity_30d: number;
  velocity_90d: number;
};

export type DeadStockEvidence = {
  sku: string;
  title: string | null;
  days_of_stock: number;
  velocity_30d: number;
  velocity_90d: number;
  available_units: number;
  inventory_value_usd: number;
  suggested_action: "liquidate" | "bundle";
};

export type DeadStockEvaluation = {
  sku: string;
  qualifies: boolean;
  should_resolve: boolean;
  amount_at_risk_usd: number;
  evidence: DeadStockEvidence | null;
};

export function parseOrderSkuUnitSales(
  payload: Record<string, unknown>,
  orderId: string,
): SkuUnitSale[] {
  if (isOrderCancelled(payload)) return [];

  const day = extractOrderDay(payload);
  if (!day) return [];

  const lineItems = payload.line_items ?? payload.lineItems;
  if (!Array.isArray(lineItems)) return [];

  const sales: SkuUnitSale[] = [];
  for (const line of lineItems) {
    if (!line || typeof line !== "object") continue;
    const record = line as Record<string, unknown>;
    const sku = typeof record.sku === "string" ? record.sku.trim() : "";
    if (!sku) continue;

    const quantity = Number(record.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    sales.push({
      day,
      order_id: orderId,
      sku,
      units_sold: quantity,
    });
  }

  return sales;
}

function filterSalesForWindow(
  sales: SkuUnitSale[],
  windowDays: number,
  referenceDay: string,
): SkuUnitSale[] {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  return sales.filter((sale) => {
    const day = new Date(`${sale.day}T00:00:00.000Z`);
    return day >= start && day <= ref;
  });
}

export function sumSkuUnitsSold(
  sales: SkuUnitSale[],
  sku: string,
  windowDays: number,
  referenceDay: string,
): number {
  return filterSalesForWindow(sales, windowDays, referenceDay)
    .filter((sale) => sale.sku === sku)
    .reduce((sum, sale) => sum + sale.units_sold, 0);
}

export function computeSkuVelocity(unitsSold: number, windowDays: number): number {
  if (windowDays <= 0) return 0;
  return unitsSold / windowDays;
}

export function hasDecliningVelocity(velocity30d: number, velocity90d: number): boolean {
  if (velocity90d <= 0) {
    return velocity30d <= 0;
  }

  return velocity30d < velocity90d * DEAD_STOCK_THRESHOLDS.velocity_decline_ratio;
}

export function computeInventoryValueAtCost(availableUnits: number, unitCost: number | null): number {
  if (availableUnits <= 0 || unitCost == null || unitCost <= 0) return 0;
  return Math.round(availableUnits * unitCost);
}

export function suggestDeadStockAction(
  velocity30d: number,
  daysOfStock: number,
): "liquidate" | "bundle" {
  if (
    velocity30d <= 0 ||
    daysOfStock >= DEAD_STOCK_THRESHOLDS.liquidate_days_of_stock
  ) {
    return "liquidate";
  }

  return "bundle";
}

export function qualifiesForDeadStockLeak(input: DeadStockSkuInput): boolean {
  if (input.available_units <= 0) return false;
  if (input.unit_cost == null || input.unit_cost <= 0) return false;
  if (!hasDecliningVelocity(input.velocity_30d, input.velocity_90d)) return false;

  const daysOfStock = computeDaysOfStock(input.available_units, input.velocity_30d);
  if (daysOfStock == null) {
    return input.velocity_30d <= 0;
  }

  return daysOfStock > DEAD_STOCK_THRESHOLDS.min_days_of_stock;
}

export function buildDeadStockEvidence(input: DeadStockSkuInput): DeadStockEvidence {
  const daysOfStock =
    computeDaysOfStock(input.available_units, input.velocity_30d) ??
    Number.POSITIVE_INFINITY;

  return {
    sku: input.sku,
    title: input.title ?? null,
    days_of_stock: Number.isFinite(daysOfStock) ? Math.round(daysOfStock) : 999,
    velocity_30d: Math.round(input.velocity_30d * 100) / 100,
    velocity_90d: Math.round(input.velocity_90d * 100) / 100,
    available_units: input.available_units,
    inventory_value_usd: computeInventoryValueAtCost(input.available_units, input.unit_cost),
    suggested_action: suggestDeadStockAction(input.velocity_30d, daysOfStock),
  };
}

export function evaluateDeadStockLeak(input: DeadStockSkuInput): DeadStockEvaluation {
  const qualifies = qualifiesForDeadStockLeak(input);

  return {
    sku: input.sku,
    qualifies,
    should_resolve: !qualifies,
    amount_at_risk_usd: qualifies
      ? computeInventoryValueAtCost(input.available_units, input.unit_cost)
      : 0,
    evidence: qualifies ? buildDeadStockEvidence(input) : null,
  };
}

export function buildDeadStockSkuInputs(
  sales: SkuUnitSale[],
  inventoryBySku: Map<string, number>,
  unitCostBySku: Map<string, number>,
  titlesBySku: Map<string, string>,
  referenceDay: string,
): DeadStockSkuInput[] {
  const skus = new Set<string>([...inventoryBySku.keys(), ...sales.map((sale) => sale.sku)]);

  return [...skus].map((sku) => {
    const units30d = sumSkuUnitsSold(
      sales,
      sku,
      DEAD_STOCK_THRESHOLDS.short_velocity_days,
      referenceDay,
    );
    const units90d = sumSkuUnitsSold(
      sales,
      sku,
      DEAD_STOCK_THRESHOLDS.long_velocity_days,
      referenceDay,
    );

    return {
      sku,
      title: titlesBySku.get(sku) ?? null,
      available_units: inventoryBySku.get(sku) ?? 0,
      unit_cost: unitCostBySku.get(sku) ?? null,
      velocity_30d: computeSkuVelocity(units30d, DEAD_STOCK_THRESHOLDS.short_velocity_days),
      velocity_90d: computeSkuVelocity(units90d, DEAD_STOCK_THRESHOLDS.long_velocity_days),
    };
  });
}

export function evaluateDeadStockLeaks(inputs: DeadStockSkuInput[]): DeadStockEvaluation[] {
  return inputs.map((input) => evaluateDeadStockLeak(input));
}
