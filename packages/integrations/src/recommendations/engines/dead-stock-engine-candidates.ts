import type { DeadStockEvidence } from "../../finance/dead-stock-leak.js";
import {
  buildLiquidationSuggestion,
  computeLiquidationImpactRange,
} from "../../inventory/dead-stock-liquidation.js";
import {
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const INVENTORY_LIQUIDATE_CATEGORY = "inventory_liquidate";

export type DeadStockLeakCandidateInput = {
  id: string;
  amount_at_risk_usd: number | null;
  evidence: DeadStockEvidence;
};

export function buildDeadStockLiquidationCandidates(
  leaks: DeadStockLeakCandidateInput[],
  referenceDay: string,
): RecommendationCandidate[] {
  return leaks.map((leak) => {
    const suggestion = buildLiquidationSuggestion(leak.evidence);
    const impactRange = computeLiquidationImpactRange({
      inventory_value_usd: leak.evidence.inventory_value_usd,
      strategy: suggestion.strategy,
      discount_pct: suggestion.discount_pct,
      velocity_30d: leak.evidence.velocity_30d,
    });

    return {
      engine: "inventory",
      category: INVENTORY_LIQUIDATE_CATEGORY,
      title: suggestion.title,
      body: suggestion.body,
      impact_low: impactRange.margin_sacrificed_low_usd,
      impact_high: impactRange.cash_recovered_high_usd,
      confidence: "medium",
      effort: "high",
      evidence: [
        {
          sku: leak.evidence.sku,
          strategy: suggestion.strategy,
          discount_pct: suggestion.discount_pct,
          days_of_stock: leak.evidence.days_of_stock,
          velocity_30d: leak.evidence.velocity_30d,
          velocity_90d: leak.evidence.velocity_90d,
          available_units: leak.evidence.available_units,
          inventory_value_usd: leak.evidence.inventory_value_usd,
          cash_recovered_low_usd: impactRange.cash_recovered_low_usd,
          cash_recovered_high_usd: impactRange.cash_recovered_high_usd,
          margin_sacrificed_low_usd: impactRange.margin_sacrificed_low_usd,
          margin_sacrificed_high_usd: impactRange.margin_sacrificed_high_usd,
          source_leak_id: leak.id,
        },
      ],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(INVENTORY_LIQUIDATE_CATEGORY, leak.evidence.sku),
      subject_sku: leak.evidence.sku,
      source_key: leak.id,
    };
  });
}
