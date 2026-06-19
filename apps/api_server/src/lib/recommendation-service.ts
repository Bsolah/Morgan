import { and, desc, eq } from "drizzle-orm";
import { profitLeaks, type Database } from "@morgan/db";
import { leakBody, leakTitle, type ChatRecommendationContext } from "@morgan/integrations";

export type RecommendationStatus = "open" | "accepted" | "dismissed";

export type RecommendationView = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: RecommendationStatus;
  impact_low_usd: number | null;
  impact_high_usd: number | null;
  confidence: string;
  effort: string;
  created_at: string;
  updated_at: string;
};

function mapStatus(status: string): RecommendationStatus {
  if (status === "accepted") return "accepted";
  if (status === "dismissed") return "dismissed";
  return "open";
}

function mapRow(row: typeof profitLeaks.$inferSelect): RecommendationView {
  const amount = Number(row.amountAtRiskUsd ?? 0);
  const finiteAmount = Number.isFinite(amount) ? amount : null;

  return {
    id: row.id,
    title: leakTitle(row.leakType, row.evidence ?? null),
    body: leakBody(row.leakType, row.evidence ?? null),
    category: row.leakType,
    status: mapStatus(row.status),
    impact_low_usd: finiteAmount,
    impact_high_usd: finiteAmount,
    confidence: row.severity === "critical" ? "high" : "medium",
    effort: row.leakType === "ad_waste" ? "low" : "medium",
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listOpenRecommendations(
  db: Database,
  storeId: string,
): Promise<RecommendationView[]> {
  const rows = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")))
    .orderBy(desc(profitLeaks.amountAtRiskUsd))
    .limit(5);

  return rows.map(mapRow);
}

export async function getRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  const [row] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.id, recommendationId), eq(profitLeaks.storeId, storeId)))
    .limit(1);

  return row ? mapRow(row) : null;
}

export async function getTopOpenRecommendation(
  db: Database,
  storeId: string,
): Promise<RecommendationView | null> {
  const [row] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")))
    .orderBy(desc(profitLeaks.amountAtRiskUsd))
    .limit(1);

  return row ? mapRow(row) : null;
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

  return row ? mapRow(row) : null;
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

  return row ? mapRow(row) : null;
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
