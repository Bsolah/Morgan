import type { PriceDecreaseSuggestion, SkuPriceDecreaseInput } from "../../pricing/price-decrease.js";
import { buildPriceDecreaseSuggestion } from "../../pricing/price-decrease.js";
import {
  buildPriceIncreaseSuggestion,
  type SkuPriceIncreaseInput,
} from "../../pricing/price-increase.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const PRICE_INCREASE_CATEGORY = "price_increase";
const PRICE_DECREASE_CATEGORY = "price_decrease";

export function buildPriceIncreaseCandidates(
  skus: SkuPriceIncreaseInput[],
  referenceDay: string,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const sku of skus) {
    const suggestion = buildPriceIncreaseSuggestion(sku);
    if (!suggestion) continue;

    const impact = buildCandidateImpact(Math.max(0, suggestion.expected_margin_delta_usd));
    candidates.push({
      engine: "pricing",
      category: PRICE_INCREASE_CATEGORY,
      title: `Raise price on ${sku.sku}`,
      body: `Increase ${sku.sku} from $${suggestion.current_price.toFixed(2)} to $${suggestion.suggested_price.toFixed(2)} (+${suggestion.increase_pct}%). Expected margin lift ~$${Math.round(suggestion.expected_margin_delta_usd).toLocaleString("en-US")}/mo with ~${Math.abs(suggestion.expected_unit_delta_pct).toFixed(1)}% unit volume change.`,
      impact_low: impact.impact_low,
      impact_high: impact.impact_high,
      confidence: suggestion.confidence === "high" ? "high" : "low",
      effort: "low",
      evidence: [
        {
          sku: sku.sku,
          current_price: suggestion.current_price,
          suggested_price: suggestion.suggested_price,
          increase_pct: suggestion.increase_pct,
          margin_rate: sku.margin_rate,
          target_margin_rate: sku.target_margin_rate ?? 0.4,
          velocity_30d: sku.velocity_30d,
          velocity_90d: sku.velocity_90d,
          orders_30d: sku.orders_30d,
          expected_margin_delta_usd: suggestion.expected_margin_delta_usd,
          expected_unit_delta_pct: suggestion.expected_unit_delta_pct,
          expected_unit_delta: suggestion.expected_unit_delta,
        },
      ],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(PRICE_INCREASE_CATEGORY, sku.sku),
      subject_sku: sku.sku,
      source_key: sku.sku,
    });
  }

  return candidates;
}

export function buildPriceDecreaseCandidates(
  skus: SkuPriceDecreaseInput[],
  referenceDay: string,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const sku of skus) {
    const suggestion = buildPriceDecreaseSuggestion(sku);
    if (!suggestion) continue;

    const impact = buildCandidateImpact(
      suggestion.strategy === "decrease"
        ? sku.current_price * 0.05 * 30
        : sku.current_price * 0.03 * 30,
    );

    candidates.push({
      engine: "pricing",
      category: PRICE_DECREASE_CATEGORY,
      title: buildPriceDecreaseTitle(sku.sku, suggestion),
      body: buildPriceDecreaseBody(sku, suggestion),
      impact_low: impact.impact_low,
      impact_high: impact.impact_high,
      confidence: "medium",
      effort: "medium",
      evidence: [
        {
          sku: sku.sku,
          category: sku.category,
          current_price: sku.current_price,
          suggested_price: suggestion.suggested_price,
          strategy: suggestion.strategy,
          decrease_pct: suggestion.decrease_pct,
          return_rate_pct: sku.return_rate * 100,
          category_mean_return_rate_pct: sku.category_mean_return_rate * 100,
          return_rate_threshold_pct:
            (sku.category_mean_return_rate +
              2 * sku.category_stddev_return_rate) *
            100,
          category_median_price: sku.category_median_price,
          competitor_price_low: sku.competitor_price_low ?? null,
          competitor_price_high: sku.competitor_price_high ?? null,
          competitor_price_source: sku.competitor_price_source ?? null,
          expected_return_rate_improvement_pct: suggestion.expected_return_rate_improvement_pct,
        },
      ],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(PRICE_DECREASE_CATEGORY, sku.sku),
      subject_sku: sku.sku,
      source_key: sku.sku,
    });
  }

  return candidates;
}

function buildPriceDecreaseTitle(sku: string, suggestion: PriceDecreaseSuggestion): string {
  if (suggestion.strategy === "bundle") {
    return `Bundle ${sku} to reduce returns`;
  }
  return `Lower price on ${sku} by ${suggestion.decrease_pct}%`;
}

function buildPriceDecreaseBody(
  sku: SkuPriceDecreaseInput,
  suggestion: PriceDecreaseSuggestion,
): string {
  const returnPct = (sku.return_rate * 100).toFixed(1);
  const categoryPct = (sku.category_mean_return_rate * 100).toFixed(1);

  if (suggestion.strategy === "bundle") {
    return `${sku.sku} returns at ${returnPct}% vs category avg ${categoryPct}% while priced above the category median. Bundle with a top seller instead of cutting price.`;
  }

  const competitorText =
    sku.competitor_price_low != null && sku.competitor_price_high != null
      ? ` Competitor range: $${sku.competitor_price_low.toFixed(2)}–$${sku.competitor_price_high.toFixed(2)}.`
      : "";

  return `${sku.sku} returns at ${returnPct}% (category avg ${categoryPct}%) and is priced above peers. Try ${suggestion.decrease_pct}% off to $${suggestion.suggested_price?.toFixed(2)} or bundle instead.${competitorText}`;
}
