import type { Database } from "@morgan/db";
import {
  buildSkuInventoryHealth,
  INVENTORY_HEALTH_WINDOW_DAYS,
  rankSkusForInventoryHealth,
  summarizeInventoryHealth,
  type SkuInventoryHealth,
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
import { getProfitSkuRanking } from "./sku-economics-service.js";

export type InventoryHealthView = {
  store_id: string;
  reference_day: string;
  window_days: number;
  stockout_risk_count: number;
  overstock_count: number;
  overstock_value_usd: number;
  skus: SkuInventoryHealth[];
};

export type InventorySkuDetailView = SkuInventoryHealth & {
  store_id: string;
  reference_day: string;
  window_days: number;
};

async function buildSkuHealthList(
  db: Database,
  storeId: string,
  windowDays: number,
  referenceDay: string,
): Promise<SkuInventoryHealth[]> {
  const [skuRanking, availableBySku, unitCostBySku, titlesBySku, leadTimes] = await Promise.all([
    getProfitSkuRanking(db, storeId, windowDays),
    loadAvailableUnitsBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadLeadTimeDaysBySku(db, storeId),
  ]);

  return skuRanking.skus.map((summary) => {
    const leadTimeDays = resolveLeadTimeDaysForSku(
      summary.sku,
      leadTimes.defaultLeadTimeDays,
      leadTimes.overrides,
    );

    return buildSkuInventoryHealth(
      {
        sku: summary.sku,
        title: titlesBySku.get(summary.sku),
        available_units: availableBySku.get(summary.sku) ?? 0,
        velocity_per_day: summary.velocity_per_day,
        gross_revenue: summary.gross_revenue,
        unit_cost: unitCostBySku.get(summary.sku) ?? null,
      },
      referenceDay,
      leadTimeDays,
    );
  });
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

  const [skuRanking, availableBySku, unitCostBySku, titlesBySku, leadTimes] = await Promise.all([
    getProfitSkuRanking(db, storeId, windowDays),
    loadAvailableUnitsBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadLeadTimeDaysBySku(db, storeId),
  ]);

  const summary = skuRanking.skus.find((row) => row.sku === sku);
  if (!summary) return null;

  const leadTimeDays = resolveLeadTimeDaysForSku(
    summary.sku,
    leadTimes.defaultLeadTimeDays,
    leadTimes.overrides,
  );

  const health = buildSkuInventoryHealth(
    {
      sku: summary.sku,
      title: titlesBySku.get(summary.sku),
      available_units: availableBySku.get(summary.sku) ?? 0,
      velocity_per_day: summary.velocity_per_day,
      gross_revenue: summary.gross_revenue,
      unit_cost: unitCostBySku.get(summary.sku) ?? null,
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
