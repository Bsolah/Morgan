import type { RecommendationItem } from "./recommendations-data.js";
import { SAMPLE_OPEN } from "./recommendations-data.js";
import { withRecommendationStatus } from "./recommendation-actions.js";

export type MetricCitation = {
  metric_key: string;
  label: string;
  value: string;
  period: string;
};

export type RecommendationRelatedLink = {
  type: "leak" | "metric";
  id: string;
  label: string;
  headline: string;
};

export type RecommendationDetail = RecommendationItem & {
  description: string;
  evidence: string[];
  suggested_deadline: string;
  calculation: {
    summary: string;
    citations: MetricCitation[];
  };
  related: RecommendationRelatedLink;
};

const DETAIL_BY_ID: Record<string, Omit<RecommendationDetail, keyof RecommendationItem>> = {
  "rec-001": {
    description:
      "Campaign X spent $1,840 over the last 7 days with POAS 0.62 — below your 1.2 break-even. Pausing it frees budget without hurting top-of-funnel volume from your Shopping campaigns.",
    evidence: [
      "7-day spend: $1,840 on Meta Campaign X",
      "POAS 0.62 vs store break-even POAS 1.2",
      "Incremental orders attributed: 14 ($131 AOV)",
      "Similar campaigns paused last month saved $380–$510/wk",
    ],
    suggested_deadline: "2026-06-20T00:00:00.000Z",
    calculation: {
      summary:
        "Impact = weekly spend × (1 − POAS / target POAS), capped by observed conversion volume.",
      citations: [
        {
          metric_key: "campaign_poas_7d",
          label: "Campaign X POAS (7d)",
          value: "0.62",
          period: "Jun 13–19",
        },
        {
          metric_key: "campaign_spend_7d",
          label: "Campaign X spend (7d)",
          value: "$1,840",
          period: "Jun 13–19",
        },
        {
          metric_key: "store_target_poas",
          label: "Store target POAS",
          value: "1.2",
          period: "Trailing 30d",
        },
      ],
    },
    related: {
      type: "leak",
      id: "leak-ad-waste-001",
      label: "Ad waste leak",
      headline: "$420/wk margin at risk from underperforming Meta spend",
    },
  },
  "rec-002": {
    description:
      "Blue Tee (M) has 6 days of cover at current velocity. Supplier lead time is 10 days — reorder now to avoid a stockout during your weekend traffic spike.",
    evidence: [
      "On-hand: 42 units; 7-day velocity: 7.0 units/day",
      "Days of cover: 6 (below 14-day safety target)",
      "Supplier lead time: 10 business days",
      "Stockout on this SKU last quarter cost ~$720 in lost margin",
    ],
    suggested_deadline: "2026-06-18T00:00:00.000Z",
    calculation: {
      summary:
        "Impact = projected lost contribution margin if stockout occurs during lead time.",
      citations: [
        {
          metric_key: "sku_days_of_cover",
          label: "Blue Tee (M) days of cover",
          value: "6 days",
          period: "As of today",
        },
        {
          metric_key: "sku_velocity_7d",
          label: "7-day unit velocity",
          value: "7.0 / day",
          period: "Jun 13–19",
        },
        {
          metric_key: "sku_contribution_margin",
          label: "Unit contribution margin",
          value: "$18.40",
          period: "Trailing 30d",
        },
      ],
    },
    related: {
      type: "metric",
      id: "metric-inventory-cover",
      label: "Inventory cover",
      headline: "Blue Tee (M) — 6 days cover vs 14-day target",
    },
  },
  "rec-003": {
    description:
      "Three active discount codes stack on checkout for ~18% of orders, eroding margin on your top SKUs. Tightening stack rules could recover $900–$1.1K/month without hurting conversion on full-price items.",
    evidence: [
      "18% of orders used 2+ discount codes (last 30d)",
      "Average stacked discount: 22% vs planned 12%",
      "Affected SKUs: 14 top sellers by revenue",
      "Margin erosion estimate: $900–$1.1K/mo",
    ],
    suggested_deadline: "2026-06-23T00:00:00.000Z",
    calculation: {
      summary:
        "Impact = excess discount $ on stacked orders × gross margin rate, annualized to monthly.",
      citations: [
        {
          metric_key: "stacked_discount_rate",
          label: "Orders with 2+ codes",
          value: "18%",
          period: "Last 30d",
        },
        {
          metric_key: "avg_stack_depth",
          label: "Avg stacked discount",
          value: "22%",
          period: "Last 30d",
        },
        {
          metric_key: "margin_erosion_usd",
          label: "Estimated margin erosion",
          value: "$980/mo",
          period: "Last 30d",
        },
      ],
    },
    related: {
      type: "leak",
      id: "leak-pricing-001",
      label: "Discount stack leak",
      headline: "$980/mo margin lost to overlapping promo codes",
    },
  },
  "rec-004": {
    description:
      "Google Shopping POAS is 2.4 vs Meta prospecting at 0.9. Shifting $500/wk from Meta to Shopping is projected to add $200–$320/wk contribution profit.",
    evidence: [
      "Google Shopping POAS (7d): 2.4",
      "Meta prospecting POAS (7d): 0.9",
      "Shopping impression share headroom: ~22%",
      "Prior budget shift test (+$300/wk Shopping) lifted profit $140/wk",
    ],
    suggested_deadline: "2026-06-19T00:00:00.000Z",
    calculation: {
      summary: "Impact = reallocated spend × (destination POAS − source POAS) / target POAS.",
      citations: [
        {
          metric_key: "google_shopping_poas_7d",
          label: "Google Shopping POAS",
          value: "2.4",
          period: "Jun 13–19",
        },
        {
          metric_key: "meta_prospecting_poas_7d",
          label: "Meta prospecting POAS",
          value: "0.9",
          period: "Jun 13–19",
        },
      ],
    },
    related: {
      type: "leak",
      id: "leak-ad-waste-002",
      label: "Ad waste leak",
      headline: "$260/wk margin at risk from Meta prospecting overspend",
    },
  },
  "rec-005": {
    description:
      "Bundle SKU #B-4421 has sold 3 units in 60 days with $2,400 tied up in inventory. A targeted 15% bundle discount could recover $450–$600 in cash over 30 days.",
    evidence: [
      "60-day units sold: 3; on-hand: 48 units",
      "Inventory value at cost: $2,400",
      "Storage + capital cost: ~$48/mo",
      "Similar liquidation last quarter cleared 80% in 21 days",
    ],
    suggested_deadline: "2026-06-27T00:00:00.000Z",
    calculation: {
      summary:
        "Impact = recoverable cash from partial liquidation minus discount margin give-up.",
      citations: [
        {
          metric_key: "sku_days_since_sale",
          label: "Days since last sale",
          value: "18 days",
          period: "SKU #B-4421",
        },
        {
          metric_key: "sku_inventory_value",
          label: "Inventory at cost",
          value: "$2,400",
          period: "As of today",
        },
      ],
    },
    related: {
      type: "metric",
      id: "metric-slow-mover",
      label: "Slow mover",
      headline: "Bundle #B-4421 — 48 units, 3 sold in 60d",
    },
  },
};

export function getRecommendationDetail(
  storeId: string,
  recommendationId: string,
): RecommendationDetail | null {
  const base = SAMPLE_OPEN.find((item) => item.id === recommendationId);
  const extra = DETAIL_BY_ID[recommendationId];
  if (!base || !extra) return null;

  const sorted = [...SAMPLE_OPEN].sort((a, b) => b.rank_score - a.rank_score);
  const rank = sorted.findIndex((item) => item.id === recommendationId) + 1;
  const withStatus = withRecommendationStatus(storeId, base, rank);

  return {
    ...withStatus,
    ...extra,
  };
}
