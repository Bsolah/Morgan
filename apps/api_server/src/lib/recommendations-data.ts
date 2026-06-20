export type RecommendationEffort = "low" | "medium" | "high";
export type RecommendationConfidence = "low" | "medium" | "high";
export type RecommendationCategory =
  | "ad_waste"
  | "inventory"
  | "pricing"
  | "cash_flow"
  | "margin";

export type RecommendationStatus = "open" | "accepted" | "dismissed";

export type RecommendationItem = {
  id: string;
  rank: number;
  rank_score: number;
  title: string;
  impact_low_usd: number;
  impact_high_usd: number;
  effort: RecommendationEffort;
  confidence: RecommendationConfidence;
  category: RecommendationCategory;
  subject_key: string;
  expires_at: string;
  status: RecommendationStatus;
  accepted_at?: string;
};

export type RecommendationsResponse = {
  open: RecommendationItem[];
  in_progress: RecommendationItem[];
  archived_count: number;
};

export const SAMPLE_OPEN: Omit<RecommendationItem, "rank" | "status">[] = [
  {
    id: "rec-001",
    rank_score: 0.94,
    title: "Pause Meta Campaign X",
    impact_low_usd: 350,
    impact_high_usd: 490,
    effort: "low",
    confidence: "high",
    category: "ad_waste",
    subject_key: "meta_campaign_x",
    expires_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "rec-002",
    rank_score: 0.89,
    title: "Reorder Blue Tee (M)",
    impact_low_usd: 600,
    impact_high_usd: 800,
    effort: "medium",
    confidence: "high",
    category: "inventory",
    subject_key: "sku_blue_tee_m",
    expires_at: "2026-06-22T00:00:00.000Z",
  },
  {
    id: "rec-003",
    rank_score: 0.82,
    title: "Review stacked discount codes",
    impact_low_usd: 900,
    impact_high_usd: 1100,
    effort: "low",
    confidence: "medium",
    category: "pricing",
    subject_key: "discount_stack",
    expires_at: "2026-06-28T00:00:00.000Z",
  },
  {
    id: "rec-004",
    rank_score: 0.76,
    title: "Shift budget to Google Shopping",
    impact_low_usd: 200,
    impact_high_usd: 320,
    effort: "medium",
    confidence: "medium",
    category: "ad_waste",
    subject_key: "google_shopping_budget",
    expires_at: "2026-06-24T00:00:00.000Z",
  },
  {
    id: "rec-005",
    rank_score: 0.71,
    title: "Liquidate slow-moving SKU bundle",
    impact_low_usd: 450,
    impact_high_usd: 600,
    effort: "high",
    confidence: "medium",
    category: "inventory",
    subject_key: "sku_bundle_b4421",
    expires_at: "2026-06-30T00:00:00.000Z",
  },
  {
    id: "rec-006",
    rank_score: 0.68,
    title: "Reduce Meta Campaign X daily budget",
    impact_low_usd: 280,
    impact_high_usd: 400,
    effort: "low",
    confidence: "medium",
    category: "ad_waste",
    subject_key: "meta_campaign_x",
    expires_at: "2026-06-26T00:00:00.000Z",
  },
];
