import { desc, eq } from "drizzle-orm";
import { cashRunwaySnapshots, type Database } from "@morgan/db";
import { runInventoryPurchaseScenarioForecast, type InventoryPurchaseScenarioResult } from "@morgan/integrations";
import { getInventorySkuDetail } from "./inventory-health-service.js";
import { getProfitSkuDetail } from "./sku-economics-service.js";
import { saveScenario } from "./scenario-service.js";

export type RunInventoryPurchaseScenarioInput = {
  sku: string;
  quantity: number;
  unit_cost_usd: number;
  save?: boolean;
  source?: string;
};

export type RunInventoryPurchaseScenarioResult = InventoryPurchaseScenarioResult & {
  reference_day: string;
  saved_scenario_id: string | null;
};

async function fetchRunwaySnapshot(
  db: Database,
  storeId: string,
): Promise<{ runwayDays: number | null; avgDailyNetOutflow: number | null }> {
  const [snapshot] = await db
    .select({
      runwayDays: cashRunwaySnapshots.runwayDays,
      avgDailyNetOutflow: cashRunwaySnapshots.avgDailyNetOutflow,
    })
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (!snapshot) {
    return { runwayDays: null, avgDailyNetOutflow: null };
  }

  return {
    runwayDays: snapshot.runwayDays ? Number(snapshot.runwayDays) : null,
    avgDailyNetOutflow: snapshot.avgDailyNetOutflow ? Number(snapshot.avgDailyNetOutflow) : null,
  };
}

function buildScenarioTitle(sku: string, quantity: number): string {
  return `Buy ${quantity.toLocaleString("en-US")} units of ${sku}`;
}

export async function runInventoryPurchaseScenarioForStore(
  db: Database,
  storeId: string,
  input: RunInventoryPurchaseScenarioInput,
): Promise<RunInventoryPurchaseScenarioResult> {
  const [skuDetail, profitDetail, runway] = await Promise.all([
    getInventorySkuDetail(db, storeId, input.sku),
    getProfitSkuDetail(db, storeId, input.sku),
    fetchRunwaySnapshot(db, storeId),
  ]);

  const referenceDay = skuDetail?.reference_day ?? new Date().toISOString().slice(0, 10);
  const velocityPerDay = skuDetail?.velocity_per_day ?? profitDetail?.summary.velocity_per_day ?? 0;
  const availableUnits = skuDetail?.available_units ?? 0;
  const unitMargin =
    profitDetail?.summary.unit_margin != null && profitDetail.summary.unit_margin > 0
      ? profitDetail.summary.unit_margin
      : null;

  const forecast = runInventoryPurchaseScenarioForecast({
    sku: input.sku,
    title: skuDetail?.title ?? null,
    quantity: input.quantity,
    unit_cost_usd: input.unit_cost_usd,
    available_units: availableUnits,
    velocity_per_day: velocityPerDay,
    unit_margin_usd: unitMargin,
    runway_days_baseline: runway.runwayDays,
    avg_daily_net_outflow: runway.avgDailyNetOutflow,
    reference_day: referenceDay,
  });

  if (!forecast) {
    throw new Error("invalid_inventory_purchase_input");
  }

  let savedScenarioId: string | null = null;
  if (input.save) {
    const saved = await saveScenario(db, storeId, {
      scenario_type: "inventory_purchase",
      title: buildScenarioTitle(input.sku, input.quantity),
      inputs: {
        sku: input.sku,
        quantity: input.quantity,
        unit_cost_usd: input.unit_cost_usd,
        reference_day: referenceDay,
      },
      results: forecast,
      source: input.source ?? "scenario_planner",
    });
    savedScenarioId = saved.id;
  }

  return {
    ...forecast,
    reference_day: referenceDay,
    saved_scenario_id: savedScenarioId,
  };
}
