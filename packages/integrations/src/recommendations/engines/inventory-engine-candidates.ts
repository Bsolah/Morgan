import type { SkuInventoryPlanning } from "../../inventory/inventory-planning.js";
import { isEligibleForReorderRecommendation } from "../../inventory/inventory-reorder.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const INVENTORY_REORDER_CATEGORY = "inventory_reorder";

function reorderImpactUsd(sku: SkuInventoryPlanning): number {
  if (sku.reorder_cost_usd > 0) {
    return sku.reorder_cost_usd;
  }

  const unitCost =
    sku.overstock_value_usd > 0 && sku.available_units > 0
      ? sku.overstock_value_usd / Math.max(sku.available_units, 1)
      : 0;
  const qty = sku.reorder_qty ?? 0;
  const marginPerUnit =
    sku.gross_revenue > 0 && sku.velocity_per_day > 0
      ? (sku.gross_revenue / Math.max(sku.velocity_per_day * 30, 1)) * 0.4
      : 25;

  const stockoutRiskValue = qty * Math.max(marginPerUnit, unitCost > 0 ? unitCost * 0.3 : 25);
  return Math.round(stockoutRiskValue);
}

export function buildInventoryEngineCandidates(
  skus: SkuInventoryPlanning[],
  referenceDay: string,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const sku of skus) {
    if (
      !isEligibleForReorderRecommendation({
        reorder_recommended: sku.reorder_recommended,
        revenue_rank: sku.revenue_rank,
        days_of_stock: sku.days_of_stock,
      })
    ) {
      continue;
    }

    if (sku.reorder_qty == null) {
      continue;
    }

    const impact = buildCandidateImpact(reorderImpactUsd(sku));
    candidates.push({
      engine: "inventory",
      category: INVENTORY_REORDER_CATEGORY,
      title: sku.recommendation_title ?? `Reorder ${sku.sku}`,
      body:
        sku.recommendation_body ??
        `Order ${sku.reorder_qty} units of ${sku.sku} by ${sku.reorder_by_day ?? "soon"}.`,
      impact_low: impact.impact_low,
      impact_high: impact.impact_high,
      confidence: sku.forecast_model ? "high" : "medium",
      effort: "medium",
      evidence: [
        {
          sku: sku.sku,
          reorder_qty: sku.reorder_qty,
          reorder_point_units: sku.reorder_point_units,
          safety_stock_units: sku.safety_stock_units,
          reorder_cost_usd: sku.reorder_cost_usd,
          runway_impact_days: sku.runway_impact_days,
          available_units: sku.available_units,
          planning_velocity_per_day: sku.planning_velocity_per_day,
          forecast_units_30d: sku.forecast_units_30d,
          reorder_by_day: sku.reorder_by_day,
          lead_time_days: sku.lead_time_days,
          revenue_rank: sku.revenue_rank,
        },
      ],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(INVENTORY_REORDER_CATEGORY, sku.sku),
      subject_sku: sku.sku,
      source_key: sku.sku,
    });
  }

  return candidates;
}
