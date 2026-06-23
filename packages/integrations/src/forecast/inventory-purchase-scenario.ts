import { addDaysToDayString } from "../cash/runway.js";
import { computeDaysOfStock } from "../inventory/inventory-health.js";
import { computeRunwayImpactDays } from "../inventory/inventory-reorder.js";

export const INVENTORY_PURCHASE_RUNWAY_WARNING_DAYS = 30;

export type InventoryPurchaseScenarioInput = {
  sku: string;
  title?: string | null;
  quantity: number;
  unit_cost_usd: number;
  available_units: number;
  velocity_per_day: number;
  unit_margin_usd?: number | null;
  runway_days_baseline: number | null;
  avg_daily_net_outflow: number | null;
  reference_day: string;
};

export type InventoryPurchaseScenarioResult = {
  scenario_type: "inventory_purchase";
  sku: string;
  title: string | null;
  quantity: number;
  unit_cost_usd: number;
  purchase_cost_usd: number;
  available_units_baseline: number;
  units_after_purchase: number;
  velocity_per_day: number;
  unit_margin_usd: number | null;
  expected_profit_usd: number | null;
  runway_days_baseline: number | null;
  runway_days_after_purchase: number | null;
  runway_days_delta: number | null;
  runway_warning: boolean;
  runway_warning_threshold_days: number;
  stockout_date_baseline: string | null;
  stockout_date_after_purchase: string | null;
  days_of_stock_baseline: number | null;
  days_of_stock_after_purchase: number | null;
  assumptions: string[];
};

function projectStockoutDate(
  referenceDay: string,
  availableUnits: number,
  velocityPerDay: number,
): { daysOfStock: number | null; stockoutDate: string | null } {
  const daysOfStock = computeDaysOfStock(availableUnits, velocityPerDay);
  if (daysOfStock == null) {
    return { daysOfStock: null, stockoutDate: null };
  }

  const wholeDays = Math.max(0, Math.ceil(daysOfStock));
  return {
    daysOfStock,
    stockoutDate: addDaysToDayString(referenceDay, wholeDays),
  };
}

function resolveRunwayAfterPurchase(
  runwayBaseline: number | null,
  runwayDelta: number | null,
): number | null {
  if (runwayBaseline == null || runwayDelta == null) return null;
  return Math.round((runwayBaseline - runwayDelta) * 10) / 10;
}

export function runInventoryPurchaseScenarioForecast(
  input: InventoryPurchaseScenarioInput,
): InventoryPurchaseScenarioResult | null {
  if (!input.sku.trim()) return null;
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return null;
  if (!Number.isFinite(input.unit_cost_usd) || input.unit_cost_usd <= 0) return null;

  const purchaseCostUsd = Math.round(input.quantity * input.unit_cost_usd);
  const unitsAfterPurchase = input.available_units + input.quantity;
  const unitMargin =
    input.unit_margin_usd != null && Number.isFinite(input.unit_margin_usd)
      ? input.unit_margin_usd
      : null;
  const expectedProfitUsd =
    unitMargin != null && unitMargin > 0 ? Math.round(input.quantity * unitMargin) : null;

  const runwayDelta = computeRunwayImpactDays(purchaseCostUsd, input.avg_daily_net_outflow);
  const runwayAfter = resolveRunwayAfterPurchase(input.runway_days_baseline, runwayDelta);
  const runwayWarning =
    runwayAfter != null && runwayAfter < INVENTORY_PURCHASE_RUNWAY_WARNING_DAYS;

  const baselineStockout = projectStockoutDate(
    input.reference_day,
    input.available_units,
    input.velocity_per_day,
  );
  const afterStockout = projectStockoutDate(
    input.reference_day,
    unitsAfterPurchase,
    input.velocity_per_day,
  );

  const assumptions = [
    `Purchase cost: $${purchaseCostUsd.toLocaleString("en-US")} (${input.quantity.toLocaleString("en-US")} units @ $${input.unit_cost_usd.toFixed(2)})`,
    `Uses ${input.velocity_per_day.toFixed(2)} units/day sell-through for stockout projection`,
    unitMargin != null
      ? `Expected profit assumes $${unitMargin.toFixed(2)} contribution margin per unit (30d trailing)`
      : "Expected profit unavailable — insufficient SKU margin history",
    input.runway_days_baseline != null
      ? `Cash runway baseline: ${input.runway_days_baseline.toFixed(1)} days before purchase`
      : "Connect bank / cash data to model runway impact",
    "Excludes inbound lead time and payment terms on the purchase order",
  ];

  return {
    scenario_type: "inventory_purchase",
    sku: input.sku,
    title: input.title ?? null,
    quantity: input.quantity,
    unit_cost_usd: input.unit_cost_usd,
    purchase_cost_usd: purchaseCostUsd,
    available_units_baseline: input.available_units,
    units_after_purchase: unitsAfterPurchase,
    velocity_per_day: Math.round(input.velocity_per_day * 100) / 100,
    unit_margin_usd: unitMargin != null ? Math.round(unitMargin * 100) / 100 : null,
    expected_profit_usd: expectedProfitUsd,
    runway_days_baseline: input.runway_days_baseline,
    runway_days_after_purchase: runwayAfter,
    runway_days_delta: runwayDelta,
    runway_warning: runwayWarning,
    runway_warning_threshold_days: INVENTORY_PURCHASE_RUNWAY_WARNING_DAYS,
    stockout_date_baseline: baselineStockout.stockoutDate,
    stockout_date_after_purchase: afterStockout.stockoutDate,
    days_of_stock_baseline: baselineStockout.daysOfStock,
    days_of_stock_after_purchase: afterStockout.daysOfStock,
    assumptions,
  };
}
