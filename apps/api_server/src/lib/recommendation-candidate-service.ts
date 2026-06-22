import { and, eq, gte } from "drizzle-orm";
import {
  profitLeaks,
  recommendationCandidates,
  type Database,
} from "@morgan/db";
import {
  buildInventoryEngineCandidates,
  buildLeakEngineCandidates,
  buildMarketingEngineCandidates,
  buildChannelBudgetOptimizationCandidate,
  buildDeadStockLiquidationCandidates,
  buildPriceDecreaseCandidates,
  buildPriceIncreaseCandidates,
  dedupeRecommendationCandidates,
  RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS,
  type DeadStockEvidence,
  type RecommendationCandidate,
} from "@morgan/integrations";
import { getPricingOptimizationInputs } from "./pricing-optimization-service.js";
import { env } from "../config.js";
import { getMarketingBudgetAllocation } from "./marketing-budget-allocation-service.js";
import { getInventoryPlanningSkus } from "./inventory-health-service.js";

export type RecommendationCandidateView = {
  id: string;
  engine: RecommendationCandidate["engine"];
  category: string;
  title: string;
  body: string;
  impact_low: number;
  impact_high: number;
  confidence: RecommendationCandidate["confidence"];
  effort: RecommendationCandidate["effort"];
  evidence: Array<Record<string, unknown>>;
  expires_at: string;
  similarity_hash: string;
  subject_sku: string | null;
  source_key: string | null;
  status: string;
  generated_day: string;
  created_at: string;
};

type StoredCandidate = RecommendationCandidateView & { id: string };

const memoryCandidatesByStore = new Map<string, StoredCandidate[]>();

function useMemoryCandidateStore(): boolean {
  return env.NODE_ENV === "test";
}

export type GenerateRecommendationCandidatesResult = {
  store_id: string;
  generated_day: string;
  emitted: number;
  inserted: number;
  skipped_duplicates: number;
  by_engine: {
    leak: number;
    inventory: number;
    marketing: number;
    pricing: number;
  };
};

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toView(row: typeof recommendationCandidates.$inferSelect): RecommendationCandidateView {
  return {
    id: row.id,
    engine: row.engine as RecommendationCandidate["engine"],
    category: row.category,
    title: row.title,
    body: row.body,
    impact_low: Number(row.impactLowUsd),
    impact_high: Number(row.impactHighUsd),
    confidence: row.confidence as RecommendationCandidate["confidence"],
    effort: row.effort as RecommendationCandidate["effort"],
    evidence: row.evidence ?? [],
    expires_at: row.expiresAt.toISOString(),
    similarity_hash: row.similarityHash,
    subject_sku: row.subjectSku,
    source_key: row.sourceKey,
    status: row.status,
    generated_day: row.generatedDay,
    created_at: row.createdAt.toISOString(),
  };
}

async function loadRecentCandidateHashes(db: Database, storeId: string, referenceDay: string) {
  const windowStartDay = addDays(referenceDay, -(RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS - 1));

  if (useMemoryCandidateStore()) {
    return (memoryCandidatesByStore.get(storeId) ?? [])
      .filter((row) => row.generated_day >= windowStartDay)
      .map((row) => ({
        similarity_hash: row.similarity_hash,
        created_at: row.created_at,
      }));
  }

  const rows = await db
    .select({
      similarityHash: recommendationCandidates.similarityHash,
      createdAt: recommendationCandidates.createdAt,
    })
    .from(recommendationCandidates)
    .where(
      and(
        eq(recommendationCandidates.storeId, storeId),
        gte(recommendationCandidates.generatedDay, windowStartDay),
      ),
    );

  return rows.map((row) => ({
    similarity_hash: row.similarityHash,
    created_at: row.createdAt.toISOString(),
  }));
}

async function persistCandidates(
  db: Database,
  storeId: string,
  referenceDay: string,
  deduped: RecommendationCandidate[],
): Promise<void> {
  if (deduped.length === 0) return;

  if (useMemoryCandidateStore()) {
    const existing = memoryCandidatesByStore.get(storeId) ?? [];
    const createdAt = new Date().toISOString();
    const inserted = deduped.map((candidate, index) => ({
      id: `rec-candidate-test-${referenceDay}-${index}`,
      engine: candidate.engine,
      category: candidate.category,
      title: candidate.title,
      body: candidate.body,
      impact_low: candidate.impact_low,
      impact_high: candidate.impact_high,
      confidence: candidate.confidence,
      effort: candidate.effort,
      evidence: candidate.evidence,
      expires_at: candidate.expires_at,
      similarity_hash: candidate.similarity_hash,
      subject_sku: candidate.subject_sku ?? null,
      source_key: candidate.source_key ?? null,
      status: "pending",
      generated_day: referenceDay,
      created_at: createdAt,
    }));
    memoryCandidatesByStore.set(storeId, [...existing, ...inserted]);
    return;
  }

  await db.insert(recommendationCandidates).values(
    deduped.map((candidate) => ({
      storeId,
      engine: candidate.engine,
      category: candidate.category,
      title: candidate.title,
      body: candidate.body,
      impactLowUsd: candidate.impact_low.toFixed(4),
      impactHighUsd: candidate.impact_high.toFixed(4),
      confidence: candidate.confidence,
      effort: candidate.effort,
      evidence: candidate.evidence,
      expiresAt: new Date(candidate.expires_at),
      similarityHash: candidate.similarity_hash,
      subjectSku: candidate.subject_sku ?? null,
      sourceKey: candidate.source_key ?? null,
      status: "pending",
      generatedDay: referenceDay,
      updatedAt: new Date(),
    })),
  );
}

async function loadActiveProfitLeaks(db: Database, storeId: string) {
  return db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));
}

export async function generateRecommendationCandidatesForStore(
  db: Database,
  storeId: string,
  referenceDay = new Date().toISOString().slice(0, 10),
): Promise<GenerateRecommendationCandidatesResult> {
  const [activeLeaks, inventorySkus, marketingAllocation, pricingInputs, recentHashes] =
    await Promise.all([
    loadActiveProfitLeaks(db, storeId),
    getInventoryPlanningSkus(db, storeId, 30, referenceDay),
    getMarketingBudgetAllocation(db, storeId, 30),
    getPricingOptimizationInputs(db, storeId),
    loadRecentCandidateHashes(db, storeId, referenceDay),
  ]);

  const leakCandidates = buildLeakEngineCandidates(
    activeLeaks.map((leak) => ({
      id: leak.id,
      leak_type: leak.leakType,
      external_key: leak.externalKey,
      severity: leak.severity,
      amount_at_risk_usd:
        leak.amountAtRiskUsd != null ? Number(leak.amountAtRiskUsd) : null,
      evidence: leak.evidence ?? null,
    })),
    referenceDay,
  );

  const deadStockLeaks = activeLeaks.filter((leak) => leak.leakType === "dead_stock");
  const deadStockCandidates = buildDeadStockLiquidationCandidates(
    deadStockLeaks
      .map((leak) => {
        const evidence = leak.evidence?.[0];
        if (!evidence || typeof evidence.sku !== "string") {
          return null;
        }
        return {
          id: leak.id,
          amount_at_risk_usd:
            leak.amountAtRiskUsd != null ? Number(leak.amountAtRiskUsd) : null,
          evidence: evidence as DeadStockEvidence,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null),
    referenceDay,
  );

  const inventoryCandidates = buildInventoryEngineCandidates(inventorySkus, referenceDay);
  const marketingCandidates = buildMarketingEngineCandidates({
    campaigns: marketingAllocation.campaigns,
    dailyRows: marketingAllocation.daily_rows,
    referenceDay,
    windowDays: marketingAllocation.window_days,
  });
  const channelBudgetCandidate = marketingAllocation.channel_optimization
    ? buildChannelBudgetOptimizationCandidate({
        recommendations: marketingAllocation.channel_optimization.recommendations,
        projected_total_margin_usd:
          marketingAllocation.channel_optimization.projected_total_margin_usd,
        referenceDay,
      })
    : null;
  const pricingCandidates = [
    ...buildPriceIncreaseCandidates(pricingInputs.increase, referenceDay),
    ...buildPriceDecreaseCandidates(pricingInputs.decrease, referenceDay),
  ];

  const emitted = [
    ...leakCandidates,
    ...inventoryCandidates,
    ...deadStockCandidates,
    ...marketingCandidates,
    ...(channelBudgetCandidate ? [channelBudgetCandidate] : []),
    ...pricingCandidates,
  ];
  const deduped = dedupeRecommendationCandidates(emitted, recentHashes, referenceDay);

  await persistCandidates(db, storeId, referenceDay, deduped);

  return {
    store_id: storeId,
    generated_day: referenceDay,
    emitted: emitted.length,
    inserted: deduped.length,
    skipped_duplicates: emitted.length - deduped.length,
    by_engine: {
      leak: leakCandidates.length,
      inventory: inventoryCandidates.length + deadStockCandidates.length,
      marketing:
        marketingCandidates.length + (channelBudgetCandidate ? 1 : 0),
      pricing: pricingCandidates.length,
    },
  };
}

export async function listPendingRecommendationCandidates(
  db: Database,
  storeId: string,
): Promise<RecommendationCandidateView[]> {
  if (useMemoryCandidateStore()) {
    return (memoryCandidatesByStore.get(storeId) ?? []).filter((row) => row.status === "pending");
  }

  const rows = await db
    .select()
    .from(recommendationCandidates)
    .where(
      and(
        eq(recommendationCandidates.storeId, storeId),
        eq(recommendationCandidates.status, "pending"),
      ),
    );

  return rows.map(toView);
}

export async function updateRecommendationCandidateStatuses(
  db: Database,
  storeId: string,
  updates: Array<{ id: string; status: "promoted" | "skipped" }>,
): Promise<void> {
  if (updates.length === 0) return;

  if (useMemoryCandidateStore()) {
    const existing = memoryCandidatesByStore.get(storeId) ?? [];
    const statusById = new Map(updates.map((update) => [update.id, update.status]));
    memoryCandidatesByStore.set(
      storeId,
      existing.map((row) => {
        const nextStatus = statusById.get(row.id);
        return nextStatus ? { ...row, status: nextStatus } : row;
      }),
    );
    return;
  }

  const now = new Date();
  for (const update of updates) {
    await db
      .update(recommendationCandidates)
      .set({ status: update.status, updatedAt: now })
      .where(
        and(
          eq(recommendationCandidates.id, update.id),
          eq(recommendationCandidates.storeId, storeId),
        ),
      );
  }
}
