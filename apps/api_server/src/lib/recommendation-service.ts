import { and, desc, eq } from "drizzle-orm";
import { profitLeaks, recommendations, type Database } from "@morgan/db";
import {
  categoryLabelForLeakType,
  computeImpactRange,
  computeRecommendationRankScore,
  confidenceForSeverity,
  effortForLeakType,
  leakBody,
  leakTitle,
  OPEN_RECOMMENDATIONS_LIMIT,
  recommendationCategoryLabel,
  recommendationExpiresAt,
  type ChatRecommendationContext,
} from "@morgan/integrations";
import {
  getMemoryRecommendation,
  listMemoryRecommendations,
  updateMemoryRecommendationStatus,
  useMemoryRecommendationStore,
} from "./recommendation-ranking-service.js";

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

function mapRecommendationRow(row: typeof recommendations.$inferSelect): RecommendationView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    category_label: recommendationCategoryLabel(row.category),
    status: mapStatus(row.status),
    impact_low_usd: Number(row.impactLowUsd),
    impact_high_usd: Number(row.impactHighUsd),
    confidence: row.confidence as RecommendationView["confidence"],
    effort: row.effort as RecommendationView["effort"],
    rank_score: Number(row.rankScore),
    expires_at: row.expiresAt.toISOString().slice(0, 10),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapMemoryRow(row: ReturnType<typeof listMemoryRecommendations>[number]): RecommendationView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    category_label: recommendationCategoryLabel(row.category),
    status: mapStatus(row.status),
    impact_low_usd: row.impact_low_usd,
    impact_high_usd: row.impact_high_usd,
    confidence: row.confidence,
    effort: row.effort,
    rank_score: row.rank_score,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapProfitLeakRow(row: typeof profitLeaks.$inferSelect, referenceDay: string): RecommendationView {
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

async function listLegacyProfitLeakRecommendations(
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
    .map((row) => mapProfitLeakRow(row, referenceDay))
    .sort((left, right) => right.rank_score - left.rank_score);

  return {
    items: ranked.slice(0, OPEN_RECOMMENDATIONS_LIMIT),
    archived_count: Math.max(0, ranked.length - OPEN_RECOMMENDATIONS_LIMIT),
  };
}

export async function listOpenRecommendations(
  db: Database,
  storeId: string,
): Promise<RecommendationsListView> {
  if (useMemoryRecommendationStore()) {
    const items = listMemoryRecommendations(storeId, "open")
      .sort((left, right) => right.rank_score - left.rank_score)
      .slice(0, OPEN_RECOMMENDATIONS_LIMIT)
      .map(mapMemoryRow);

    if (items.length > 0) {
      return { items, archived_count: 0 };
    }

    return listLegacyProfitLeakRecommendations(db, storeId);
  }

  try {
    const rows = await db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.storeId, storeId), eq(recommendations.status, "open")))
      .orderBy(desc(recommendations.rankScore))
      .limit(OPEN_RECOMMENDATIONS_LIMIT);

    if (rows.length > 0) {
      return {
        items: rows.map(mapRecommendationRow),
        archived_count: 0,
      };
    }
  } catch {
    return listLegacyProfitLeakRecommendations(db, storeId);
  }

  return listLegacyProfitLeakRecommendations(db, storeId);
}

export async function getRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  if (useMemoryRecommendationStore()) {
    const memoryRow = getMemoryRecommendation(storeId, recommendationId);
    if (memoryRow) {
      return mapMemoryRow(memoryRow);
    }
    return listLegacyProfitLeakRecommendations(db, storeId).then(
      (list) => list.items.find((item) => item.id === recommendationId) ?? null,
    );
  }

  try {
    const [row] = await db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.id, recommendationId), eq(recommendations.storeId, storeId)))
      .limit(1);

    if (row) {
      return mapRecommendationRow(row);
    }
  } catch {
    // fall through to legacy
  }

  const referenceDay = new Date().toISOString().slice(0, 10);
  const [leakRow] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.id, recommendationId), eq(profitLeaks.storeId, storeId)))
    .limit(1);

  return leakRow ? mapProfitLeakRow(leakRow, referenceDay) : null;
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
  if (useMemoryRecommendationStore()) {
    const updated = updateMemoryRecommendationStatus(storeId, recommendationId, "accepted");
    if (updated) {
      return mapMemoryRow(updated);
    }
  } else {
    try {
      const [row] = await db
        .update(recommendations)
        .set({
          status: "accepted",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recommendations.id, recommendationId),
            eq(recommendations.storeId, storeId),
            eq(recommendations.status, "open"),
          ),
        )
        .returning();

      if (row) {
        return mapRecommendationRow(row);
      }
    } catch {
      // fall through to legacy
    }
  }

  const [leakRow] = await db
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
  return leakRow ? mapProfitLeakRow(leakRow, referenceDay) : null;
}

export async function dismissRecommendation(
  db: Database,
  storeId: string,
  recommendationId: string,
): Promise<RecommendationView | null> {
  if (useMemoryRecommendationStore()) {
    const updated = updateMemoryRecommendationStatus(storeId, recommendationId, "dismissed");
    if (updated) {
      return mapMemoryRow(updated);
    }
  } else {
    try {
      const [row] = await db
        .update(recommendations)
        .set({
          status: "dismissed",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recommendations.id, recommendationId),
            eq(recommendations.storeId, storeId),
            eq(recommendations.status, "open"),
          ),
        )
        .returning();

      if (row) {
        return mapRecommendationRow(row);
      }
    } catch {
      // fall through to legacy
    }
  }

  const [leakRow] = await db
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
  return leakRow ? mapProfitLeakRow(leakRow, referenceDay) : null;
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
