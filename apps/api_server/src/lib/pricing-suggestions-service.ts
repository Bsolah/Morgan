import type { Database } from "@morgan/db";
import {
  buildPriceDecreaseEvidence,
  buildPriceDecreaseSuggestion,
  buildPriceIncreaseSuggestion,
  DEFAULT_TARGET_MARGIN_RATE,
  type PriceDecreaseEvidence,
  type PriceDecreaseSuggestion,
  type PriceIncreaseSuggestion,
} from "@morgan/integrations";
import { getPricingOptimizationInputs } from "./pricing-optimization-service.js";

export type PriceIncreaseSuggestionView = PriceIncreaseSuggestion & {
  title?: string | null;
  margin_rate: number;
  target_margin_rate: number;
  velocity_30d: number;
  velocity_90d: number;
  orders_30d: number;
};

export type PriceDecreaseSuggestionView = PriceDecreaseSuggestion & {
  title?: string | null;
  category: string;
  evidence: PriceDecreaseEvidence;
};

export type PricingSuggestionsPayload = {
  reference_day: string;
  target_margin_rate: number;
  increase_suggestions: PriceIncreaseSuggestionView[];
  decrease_suggestions: PriceDecreaseSuggestionView[];
  /** @deprecated use increase_suggestions */
  suggestions: PriceIncreaseSuggestionView[];
  recommendation_only: true;
};

export async function getPricingSuggestions(
  db: Database,
  storeId: string,
): Promise<PricingSuggestionsPayload> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const inputs = await getPricingOptimizationInputs(db, storeId);

  const increase_suggestions = inputs.increase
    .map((sku) => {
      const suggestion = buildPriceIncreaseSuggestion(sku);
      if (!suggestion) return null;

      return {
        ...suggestion,
        title: sku.title ?? null,
        margin_rate: Math.round(sku.margin_rate * 1000) / 1000,
        target_margin_rate: sku.target_margin_rate ?? DEFAULT_TARGET_MARGIN_RATE,
        velocity_30d: Math.round(sku.velocity_30d * 100) / 100,
        velocity_90d: Math.round(sku.velocity_90d * 100) / 100,
        orders_30d: sku.orders_30d,
      };
    })
    .filter((row): row is PriceIncreaseSuggestionView => row != null)
    .sort((left, right) => right.expected_margin_delta_usd - left.expected_margin_delta_usd);

  const decrease_suggestions = inputs.decrease
    .map((sku) => {
      const suggestion = buildPriceDecreaseSuggestion(sku);
      if (!suggestion) return null;

      return {
        ...suggestion,
        title: sku.title ?? null,
        category: sku.category,
        evidence: buildPriceDecreaseEvidence(sku),
      };
    })
    .filter((row): row is PriceDecreaseSuggestionView => row != null)
    .sort(
      (left, right) =>
        right.evidence.return_rate_pct - left.evidence.return_rate_pct ||
        right.expected_return_rate_improvement_pct - left.expected_return_rate_improvement_pct,
    );

  return {
    reference_day: referenceDay,
    target_margin_rate: DEFAULT_TARGET_MARGIN_RATE,
    increase_suggestions,
    decrease_suggestions,
    suggestions: increase_suggestions,
    recommendation_only: true,
  };
}

/** @deprecated use getPricingSuggestions */
export async function getPriceIncreaseSuggestions(
  db: Database,
  storeId: string,
): Promise<PricingSuggestionsPayload> {
  return getPricingSuggestions(db, storeId);
}