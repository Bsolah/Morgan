import type { Database } from "@morgan/db";
import {
  buildSkuInventoryPlanning,
  INVENTORY_HEALTH_WINDOW_DAYS,
  rankSkusForInventoryHealth,
  summarizeInventoryHealth,
  type SkuInventoryPlanning,
} from "@morgan/integrations";
import { env } from "../config.js";
import {
  loadLeadTimeDaysBySku,
  resolveLeadTimeDaysForSku,
} from "./inventory-config-service.js";
import {
  loadAvailableUnitsBySku,
  loadSkuTitlesBySku,
  loadUnitCostBySku,
} from "./product-catalog-reader.js";
import { getSkuDemandForecastMap } from "./sku-demand-forecast-service.js";
import { getProfitSkuRanking } from "./sku-economics-service.js";
import { getCashRunway } from "./cash-runway-service.js";

export type InventoryHealthView = {
  store_id: string;
  reference_day: string;
  window_days: number;
  stockout_risk_count: number;
  overstock_count: number;
  overstock_value_usd: number;
  skus: SkuInventoryPlanning[];
};

export type InventorySkuDetailView = SkuInventoryPlanning & {
  store_id: string;
  reference_day: string;
  window_days: number;
};

async function buildSkuHealthList(
  db: Database,
  storeId: string,
  windowDays: number,
  referenceDay: string,
): Promise<SkuInventoryPlanning[]> {
  const [skuRanking, availableBySku, unitCostBySku, titlesBySku, leadTimes, demandForecasts, runway] =
    await Promise.all([
      getProfitSkuRanking(db, storeId, windowDays),
      loadAvailableUnitsBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadLeadTimeDaysBySku(db, storeId),
      getSkuDemandForecastMap(db, storeId),
      getCashRunway(db, storeId),
    ]);

  const avgDailyNetOutflow =
    runway.avg_daily_net_outflow != null ? Number(runway.avg_daily_net_outflow) : null;

  return skuRanking.skus.map((summary, index) => {
    const leadTimeDays = resolveLeadTimeDaysForSku(
      summary.sku,
      leadTimes.defaultLeadTimeDays,
      leadTimes.overrides,
    );

    return buildSkuInventoryPlanning(
      {
        sku: summary.sku,
        title: titlesBySku.get(summary.sku),
        available_units: availableBySku.get(summary.sku) ?? 0,
        velocity_per_day: summary.velocity_per_day,
        gross_revenue: summary.gross_revenue,
        unit_cost: unitCostBySku.get(summary.sku) ?? null,
        demand_forecast: demandForecasts.get(summary.sku) ?? null,
        revenue_rank: index + 1,
        avg_daily_net_outflow: avgDailyNetOutflow,
      },
      referenceDay,
      leadTimeDays,
    );
  });
}

export async function getInventoryPlanningSkus(
  db: Database,
  storeId: string,
  windowDays = INVENTORY_HEALTH_WINDOW_DAYS,
  referenceDay = new Date().toISOString().slice(0, 10),
): Promise<SkuInventoryPlanning[]> {
  return buildSkuHealthList(db, storeId, windowDays, referenceDay);
}

export async function getInventoryHealth(
  db: Database,
  storeId: string,
  windowDays = INVENTORY_HEALTH_WINDOW_DAYS,
): Promise<InventoryHealthView> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const skuHealth = await buildSkuHealthList(db, storeId, windowDays, referenceDay);
  const ranked = rankSkusForInventoryHealth(skuHealth).slice(0, 10);
  const summary = summarizeInventoryHealth(skuHealth);

  return {
    store_id: storeId,
    reference_day: referenceDay,
    window_days: windowDays,
    stockout_risk_count: summary.stockout_risk_count,
    overstock_count: summary.overstock_count,
    overstock_value_usd: summary.overstock_value_usd,
    skus: ranked,
  };
}

export async function getInventorySkuDetail(
  db: Database,
  storeId: string,
  sku: string,
  windowDays = INVENTORY_HEALTH_WINDOW_DAYS,
): Promise<InventorySkuDetailView | null> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const overview = await getInventoryHealth(db, storeId, windowDays);
  const fromTop = overview.skus.find((row) => row.sku === sku);

  if (fromTop) {
    return {
      store_id: storeId,
      reference_day: referenceDay,
      window_days: windowDays,
      ...fromTop,
    };
  }

  const [skuRanking, availableBySku, unitCostBySku, titlesBySku, leadTimes, demandForecasts] =
    await Promise.all([
      getProfitSkuRanking(db, storeId, windowDays),
      loadAvailableUnitsBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
      loadLeadTimeDaysBySku(db, storeId),
      getSkuDemandForecastMap(db, storeId),
    ]);

  const summary = skuRanking.skus.find((row) => row.sku === sku);
  if (!summary) return null;

  const leadTimeDays = resolveLeadTimeDaysForSku(
    summary.sku,
    leadTimes.defaultLeadTimeDays,
    leadTimes.overrides,
  );

  const health = buildSkuInventoryPlanning(
    {
      sku: summary.sku,
      title: titlesBySku.get(summary.sku),
      available_units: availableBySku.get(summary.sku) ?? 0,
      velocity_per_day: summary.velocity_per_day,
      gross_revenue: summary.gross_revenue,
      unit_cost: unitCostBySku.get(summary.sku) ?? null,
      demand_forecast: demandForecasts.get(summary.sku) ?? null,
    },
    referenceDay,
    leadTimeDays,
  );

  return {
    store_id: storeId,
    reference_day: referenceDay,
    window_days: windowDays,
    ...health,
  };
}
