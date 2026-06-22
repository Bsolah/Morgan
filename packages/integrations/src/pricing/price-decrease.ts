import { computeMeanAndStdDev } from "../finance/return-drain-leak.js";

export const MIN_PRICE_DECREASE_PCT = 3;
export const MAX_PRICE_DECREASE_PCT = 5;
export const RETURN_SIGMA_MULTIPLIER = 2;

export type SkuPriceDecreaseInput = {
  sku: string;
  title?: string | null;
  category: string;
  current_price: number;
  return_rate: number;
  category_mean_return_rate: number;
  category_stddev_return_rate: number;
  category_median_price: number;
  competitor_price_low?: number | null;
  competitor_price_high?: number | null;
  competitor_price_source?: "external" | "category_peers" | null;
};

export type PriceDecreaseStrategy = "decrease" | "bundle";

export type PriceDecreaseSuggestion = {
  sku: string;
  strategy: PriceDecreaseStrategy;
  current_price: number;
  suggested_price: number | null;
  decrease_pct: number | null;
  expected_return_rate_improvement_pct: number;
};

export type PriceDecreaseEvidence = {
  return_rate_pct: number;
  category_mean_return_rate_pct: number;
  return_rate_threshold_pct: number;
  category_median_price: number;
  competitor_price_low: number | null;
  competitor_price_high: number | null;
  competitor_price_source: "external" | "category_peers" | null;
};

export function buildPriceDecreaseEvidence(
  input: SkuPriceDecreaseInput,
): PriceDecreaseEvidence {
  const threshold =
    input.category_mean_return_rate +
    RETURN_SIGMA_MULTIPLIER * input.category_stddev_return_rate;

  const hasCompetitorRange =
    input.competitor_price_low != null &&
    input.competitor_price_high != null &&
    input.competitor_price_low > 0 &&
    input.competitor_price_high >= input.competitor_price_low;

  return {
    return_rate_pct: Math.round(input.return_rate * 1000) / 10,
    category_mean_return_rate_pct: Math.round(input.category_mean_return_rate * 1000) / 10,
    return_rate_threshold_pct: Math.round(threshold * 1000) / 10,
    category_median_price: Math.round(input.category_median_price * 100) / 100,
    competitor_price_low: hasCompetitorRange ? input.competitor_price_low! : null,
    competitor_price_high: hasCompetitorRange ? input.competitor_price_high! : null,
    competitor_price_source: hasCompetitorRange
      ? input.competitor_price_source ?? "category_peers"
      : null,
  };
}

export function computeCategoryMedianPrice(
  prices: Array<{ category: string; price: number }>,
): Map<string, number> {
  const byCategory = new Map<string, number[]>();
  for (const row of prices) {
    if (row.price <= 0) continue;
    const values = byCategory.get(row.category) ?? [];
    values.push(row.price);
    byCategory.set(row.category, values);
  }

  const medians = new Map<string, number>();
  for (const [category, values] of byCategory) {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    medians.set(category, median);
  }

  return medians;
}

export function computeCategoryPriceStats(
  prices: Array<{ category: string; price: number }>,
): Map<string, { median: number; mean: number; stddev: number }> {
  const byCategory = new Map<string, number[]>();
  for (const row of prices) {
    if (row.price <= 0) continue;
    const values = byCategory.get(row.category) ?? [];
    values.push(row.price);
    byCategory.set(row.category, values);
  }

  const stats = new Map<string, { median: number; mean: number; stddev: number }>();
  for (const [category, values] of byCategory) {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    const { mean, stddev } = computeMeanAndStdDev(values);
    stats.set(category, { median, mean, stddev });
  }

  return stats;
}

function percentile(sortedValues: number[], pct: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0]!;

  const index = (sortedValues.length - 1) * pct;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower]!;

  const weight = index - lower;
  return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
}

export function computeCategoryPeerPriceRange(
  prices: Array<{ category: string; sku: string; price: number }>,
): Map<string, { low: number; high: number }> {
  const byCategory = new Map<string, Array<{ sku: string; price: number }>>();
  for (const row of prices) {
    if (row.price <= 0) continue;
    const values = byCategory.get(row.category) ?? [];
    values.push({ sku: row.sku, price: row.price });
    byCategory.set(row.category, values);
  }

  const ranges = new Map<string, { low: number; high: number }>();
  for (const [category, rows] of byCategory) {
    if (rows.length < 3) continue;

    const sorted = rows.map((row) => row.price).sort((left, right) => left - right);
    ranges.set(category, {
      low: Math.round(percentile(sorted, 0.25) * 100) / 100,
      high: Math.round(percentile(sorted, 0.75) * 100) / 100,
    });
  }

  return ranges;
}

export function resolvePeerPriceRangeForSku(input: {
  category: string;
  sku: string;
  categoryRows: Array<{ category: string; sku: string; price: number }>;
  externalLow?: number | null;
  externalHigh?: number | null;
}): { low: number | null; high: number | null; source: "external" | "category_peers" | null } {
  if (
    input.externalLow != null &&
    input.externalHigh != null &&
    input.externalLow > 0 &&
    input.externalHigh >= input.externalLow
  ) {
    return {
      low: input.externalLow,
      high: input.externalHigh,
      source: "external",
    };
  }

  const peerPrices = input.categoryRows
    .filter((row) => row.category === input.category && row.sku !== input.sku && row.price > 0)
    .map((row) => row.price)
    .sort((left, right) => left - right);

  if (peerPrices.length < 2) {
    return { low: null, high: null, source: null };
  }

  return {
    low: Math.round(percentile(peerPrices, 0.25) * 100) / 100,
    high: Math.round(percentile(peerPrices, 0.75) * 100) / 100,
    source: "category_peers",
  };
}

export function qualifiesForPriceDecrease(input: SkuPriceDecreaseInput): boolean {
  const threshold =
    input.category_mean_return_rate +
    RETURN_SIGMA_MULTIPLIER * input.category_stddev_return_rate;
  return input.return_rate > threshold && input.current_price > input.category_median_price;
}

export function buildPriceDecreaseSuggestion(
  input: SkuPriceDecreaseInput,
): PriceDecreaseSuggestion | null {
  if (!qualifiesForPriceDecrease(input)) return null;

  const excessReturnPct =
    (input.return_rate - input.category_mean_return_rate) * 100;
  const useBundle = excessReturnPct > 15;

  if (useBundle) {
    return {
      sku: input.sku,
      strategy: "bundle",
      current_price: input.current_price,
      suggested_price: null,
      decrease_pct: null,
      expected_return_rate_improvement_pct: Math.min(20, Math.round(excessReturnPct * 0.3)),
    };
  }

  const decreasePct = Math.min(
    MAX_PRICE_DECREASE_PCT,
    Math.max(MIN_PRICE_DECREASE_PCT, Math.round(excessReturnPct / 4)),
  );
  const suggestedPrice = Math.round(input.current_price * (1 - decreasePct / 100) * 100) / 100;

  return {
    sku: input.sku,
    strategy: "decrease",
    current_price: input.current_price,
    suggested_price: suggestedPrice,
    decrease_pct: decreasePct,
    expected_return_rate_improvement_pct: Math.round(decreasePct * 1.5),
  };
}
