import { and, desc, eq, inArray } from "drizzle-orm";
import { profitLeaks, type Database } from "@morgan/db";
import {
  categoryLabelForLeakType,
  computeImpactRange,
  computeRecommendationRankScore,
  confidenceForSeverity,
  effortForLeakType,
  leakBody,
  leakTitle,
  OPEN_RECOMMENDATIONS_LIMIT,
  recommendationExpiresAt,
  type ChatRecommendationContext,
} from "@morgan/integrations";

export type RecommendationStatus = "open" | "accepted" | "dismissed" | "archived";

export type RecommendationView = {
  id: string;
  title: string;
  body: string;
  category: string;
  category_label: string;
  status: RecommendationStatus;
  impact_low_usd: number | null;
  impact_high_usd: number | null;
  confidence: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  rank_score: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type RecommendationsListView = {
  items: RecommendationView[];
  archived_count: number;
};

function mapStatus(status: string): RecommendationStatus {
  if (status === "accepted") return "accepted";
  if (status === "dismissed") return "dismissed";
  if (status === "archived") return "archived";
  return "open";
}

function mapRow(row: typeof profitLeaks.$inferSelect, referenceDay: string): RecommendationView {
  const amount = Number(row.amountAtRiskUsd ?? 0);
  const finiteAmount = Number.isFinite(amount) && amount > 0 ? amount : null;
  const impact = computeImpactRange(finiteAmount);
  const effort = effortForLeakType(row.leakType);
  const confidence = confidenceForSeverity(row.severity);
  const severity =
    row.severity === "critical" ? "critical" : row.severity === "info" ? "info" : "warning";

  return {
    id: row.id,
    title: leakTitle(row.leakType, row.evidence ?? null),
    body: leakBody(row.leakType, row.evidence ?? null),
    category: row.leakType,
    category_label: categoryLabelForLeakType(row.leakType),
    status: mapStatus(row.status),
    impact_low_usd: impact.impact_low_usd,
    impact_high_usd: impact.impact_high_usd,
    confidence,
    effort,
    rank_score: computeRecommendationRankScore({
      impactUsd: finiteAmount ?? 0,
      confidence,
      effort,
      severity,
    }),
    expires_at: recommendationExpiresAt(referenceDay),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listOpenRecommendations(
  db: Database,
  storeId: string,
): Promise<RecommendationsListView> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")))
    .orderBy(desc(profitLeaks.amountAtRiskUsd));

  const ranked = rows
    .map((row) => mapRow(row, referenceDay))
    .sort((left, right) => right.rank_score - left.rank_score);

  const items = ranked.slice(0, OPEN_RECOMMENDATIONS_LIMIT);
  const overflowIds = ranked.slice(OPEN_RECOMMENDATIONS_LIMIT).map((row) => row.id);

  if (overflowIds.length > 0) {
    await db
      .update(profitLeaks)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(profitLeaks.storeId, storeId), inArray(profitLeaks.id, overflowIds)));
  }

  return {
    items,
    archived_count: overflowIds.length,
  };
}

export async function getRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.id, recommendationId), eq(profitLeaks.storeId, storeId)))
    .limit(1);

  return row ? mapRow(row, referenceDay) : null;
}

export async function getTopOpenRecommendation(
  db: Database,
  storeId: string,
): Promise<RecommendationView | null> {
  const list = await listOpenRecommendations(db, storeId);
  return list.items[0] ?? null;
}

export async function acceptRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  const [row] = await db
    .update(profitLeaks)
    .set({
      status: "accepted",
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(profitLeaks.id, recommendationId),
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.status, "active"),
      ),
    )
    .returning();

  const referenceDay = new Date().toISOString().slice(0, 10);
  return row ? mapRow(row, referenceDay) : null;
}

export async function dismissRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  const [row] = await db
    .update(profitLeaks)
    .set({
      status: "dismissed",
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(profitLeaks.id, recommendationId),
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.status, "active"),
      ),
    )
    .returning();

  const referenceDay = new Date().toISOString().slice(0, 10);
  return row ? mapRow(row, referenceDay) : null;
}

export function recommendationToChatContext(recommendation: RecommendationView): ChatRecommendationContext {
  return {
    id: recommendation.id,
    title: recommendation.title,
    body: recommendation.body,
    category: recommendation.category,
    impact_low_usd: recommendation.impact_low_usd,
    impact_high_usd: recommendation.impact_high_usd,
    status: recommendation.status === "open" ? "active" : recommendation.status,
  };
}
