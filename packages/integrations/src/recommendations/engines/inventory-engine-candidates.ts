import type { SkuInventoryPlanning } from "../../inventory/inventory-planning.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const INVENTORY_REORDER_CATEGORY = "inventory_reorder";
const INVENTORY_LIQUIDATE_CATEGORY = "inventory_liquidate";

function reorderImpactUsd(sku: SkuInventoryPlanning): number {
  const unitCost = sku.overstock_value_usd > 0 && sku.available_units > 0
    ? sku.overstock_value_usd / Math.max(sku.available_units, 1)
    : 0;
  const qty = sku.reorder_qty ?? Math.ceil(sku.planning_velocity_per_day * sku.lead_time_days);
  const marginPerUnit = sku.gross_revenue > 0 && sku.velocity_per_day > 0
    ? (sku.gross_revenue / Math.max(sku.velocity_per_day * 30, 1)) * 0.4
    : 25;

  const stockoutRiskValue = qty * Math.max(marginPerUnit, unitCost > 0 ? unitCost * 0.3 : 25);
  return Math.round(stockoutRiskValue);
}

function liquidateImpactUsd(sku: SkuInventoryPlanning): number {
  return sku.overstock_value_usd > 0 ? sku.overstock_value_usd : 0;
}

export function buildInventoryEngineCandidates(
  skus: SkuInventoryPlanning[],
  referenceDay: string,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const sku of skus) {
    if (sku.reorder_recommended && sku.reorder_qty != null) {
      const impact = buildCandidateImpact(reorderImpactUsd(sku));
      candidates.push({
        engine: "inventory",
        category: INVENTORY_REORDER_CATEGORY,
        title: sku.recommendation_title ?? `Reorder ${sku.sku}`,
        body:
          sku.recommendation_body ??
          `Place a PO for ${sku.reorder_qty} units by ${sku.reorder_by_day ?? "soon"}.`,
        impact_low: impact.impact_low,
        impact_high: impact.impact_high,
        confidence: sku.forecast_model ? "high" : "medium",
        effort: "medium",
        evidence: [
          {
            sku: sku.sku,
            available_units: sku.available_units,
            planning_velocity_per_day: sku.planning_velocity_per_day,
            forecast_units_30d: sku.forecast_units_30d,
            reorder_qty: sku.reorder_qty,
            reorder_by_day: sku.reorder_by_day,
            lead_time_days: sku.lead_time_days,
          },
        ],
        expires_at: candidateExpiresAt(referenceDay),
        similarity_hash: buildSimilarityHash(INVENTORY_REORDER_CATEGORY, sku.sku),
        subject_sku: sku.sku,
        source_key: sku.sku,
      });
    }

    if (sku.overstock && sku.overstock_value_usd > 0) {
      const impact = buildCandidateImpact(liquidateImpactUsd(sku));
      candidates.push({
        engine: "inventory",
        category: INVENTORY_LIQUIDATE_CATEGORY,
        title: `Clear overstock for ${sku.sku}`,
        body: `${sku.sku} has about ${sku.days_of_stock?.toFixed(0) ?? "90+"} days of supply. Consider a bundle or markdown to recover ~$${Math.round(sku.overstock_value_usd).toLocaleString("en-US")}.`,
        impact_low: impact.impact_low,
        impact_high: impact.impact_high,
        confidence: "medium",
        effort: "high",
        evidence: [
          {
            sku: sku.sku,
            available_units: sku.available_units,
            days_of_stock: sku.days_of_stock,
            overstock_value_usd: sku.overstock_value_usd,
            planning_velocity_per_day: sku.planning_velocity_per_day,
          },
        ],
        expires_at: candidateExpiresAt(referenceDay),
        similarity_hash: buildSimilarityHash(INVENTORY_LIQUIDATE_CATEGORY, sku.sku),
        subject_sku: sku.sku,
        source_key: sku.sku,
      });
    }
  }

  return candidates;
}
