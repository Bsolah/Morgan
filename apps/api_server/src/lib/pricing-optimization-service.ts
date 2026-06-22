import type { Database } from "@morgan/db";
import {
  computeCategoryPriceStats,
  resolvePeerPriceRangeForSku,
  resolveSkuCategory,
  type SkuPriceDecreaseInput,
  type SkuPriceIncreaseInput,
} from "@morgan/integrations";
import { env } from "../config.js";
import { getProfitSkuRanking } from "./sku-economics-service.js";
import { loadPriceBySku, loadSkuCategoryBySku, loadSkuTitlesBySku } from "./product-catalog-reader.js";

export type PricingOptimizationInputs = {
  increase: SkuPriceIncreaseInput[];
  decrease: SkuPriceDecreaseInput[];
};

function computeCategoryReturnBenchmarks(
  skus: Array<{ category: string; return_rate: number }>,
): Map<string, { mean: number; stddev: number }> {
  const byCategory = new Map<string, number[]>();
  for (const row of skus) {
    const values = byCategory.get(row.category) ?? [];
    values.push(row.return_rate);
    byCategory.set(row.category, values);
  }

  const benchmarks = new Map<string, { mean: number; stddev: number }>();
  for (const [category, values] of byCategory) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.length > 1
        ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
        : 0;
    benchmarks.set(category, { mean, stddev: Math.sqrt(variance) });
  }

  return benchmarks;
}

export async function getPricingOptimizationInputs(
  db: Database,
  storeId: string,
): Promise<PricingOptimizationInputs> {
  const [ranking30, ranking90, prices, categoryBySku, titlesBySku] = await Promise.all([
    getProfitSkuRanking(db, storeId, 30),
    getProfitSkuRanking(db, storeId, 90),
    loadPriceBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadSkuCategoryBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
  ]);

  const velocity90BySku = new Map(
    ranking90.skus.map((row) => [row.sku, row.velocity_per_day]),
  );

  const categoryRows = ranking30.skus.map((row) => ({
    sku: row.sku,
    category: resolveSkuCategory(row.sku, categoryBySku),
    return_rate: row.return_rate,
    price: prices.get(row.sku) ?? (row.units_sold > 0 ? row.gross_revenue / row.units_sold : 0),
  }));

  const returnBenchmarks = computeCategoryReturnBenchmarks(categoryRows);
  const priceStats = computeCategoryPriceStats(
    categoryRows.map((row) => ({ category: row.category, price: row.price })),
  );

  const increase: SkuPriceIncreaseInput[] = [];
  const decrease: SkuPriceDecreaseInput[] = [];

  for (const summary of ranking30.skus) {
    const currentPrice =
      prices.get(summary.sku) ??
      (summary.units_sold > 0 ? summary.gross_revenue / summary.units_sold : 0);
    if (currentPrice <= 0) continue;

    const marginRate =
      summary.gross_revenue > 0 ? summary.contribution_margin / summary.gross_revenue : 0;

    increase.push({
      sku: summary.sku,
      title: titlesBySku.get(summary.sku) ?? null,
      current_price: currentPrice,
      margin_rate: marginRate,
      orders_30d: summary.orders_count,
      velocity_30d: summary.velocity_per_day,
      velocity_90d: velocity90BySku.get(summary.sku) ?? summary.velocity_per_day,
    });

    const category = resolveSkuCategory(summary.sku, categoryBySku);
    const benchmark = returnBenchmarks.get(category);
    const priceStat = priceStats.get(category);
    if (!benchmark || !priceStat) continue;

    const peerRange = resolvePeerPriceRangeForSku({
      category,
      sku: summary.sku,
      categoryRows,
    });

    decrease.push({
      sku: summary.sku,
      title: titlesBySku.get(summary.sku) ?? null,
      category,
      current_price: currentPrice,
      return_rate: summary.return_rate,
      category_mean_return_rate: benchmark.mean,
      category_stddev_return_rate: benchmark.stddev,
      category_median_price: priceStat.median,
      competitor_price_low: peerRange.low,
      competitor_price_high: peerRange.high,
      competitor_price_source: peerRange.source,
    });
  }

  return { increase, decrease };
}
