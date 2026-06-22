import { and, eq, gte, lte } from "drizzle-orm";
import {
  martAdPerformanceDaily,
  metricSnapshots,
  profitLeaks,
  stores,
  type Database,
} from "@morgan/db";
import {
  buildDeadStockSkuInputs,
  evaluateAdWasteLeak,
  evaluateDeadStockLeaks,
  evaluateDiscountBleedLeak,
  evaluateReturnDrainLeaks,
  merchantLocalDay,
  merchantLocalYesterday,
  parseOrderDiscountSnapshot,
  parseOrderSkuReturnActivity,
  parseOrderSkuUnitSales,
  shouldRunProfitLeakScan,
  type CampaignDailyMetrics,
} from "@morgan/integrations";
import { env } from "../config.js";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { createAlertsForNewProfitLeaks } from "./profit-leak-alert-service.js";
import { refreshProfitLeakSnapshots } from "./metric-snapshot-service.js";
import {
  loadAvailableUnitsBySku,
  loadSkuCategoryBySku,
  loadSkuTitlesBySku,
  loadUnitCostBySku,
} from "./product-catalog-reader.js";
import { parseOrderPayload, readOrderFactsForStore } from "./order-fact-reader.js";

const LAST_LEAK_SCAN_METRIC_KEY = "last_profit_leak_scan";
const LAST_LEAK_SCAN_PERIOD = "daily";
const DEFAULT_LOOKBACK_DAYS = 90;

export type ProfitLeakScanResult = {
  store_id: string;
  scanned: boolean;
  skipped_reason?: string;
  duration_ms: number;
  new_leaks: number;
  resolved_leaks: number;
  timed_out: boolean;
  reference_day: string;
};

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function campaignScopeKey(channel: string, campaignId: string): string {
  return `${channel}|${campaignId}`;
}

async function loadActiveLeakDedupeKeys(db: Database, storeId: string): Promise<Set<string>> {
  const rows = await db
    .select({ dedupeKey: profitLeaks.dedupeKey })
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));

  return new Set(rows.map((row) => row.dedupeKey));
}

async function countResolvedSinceScan(
  db: Database,
  storeId: string,
  startedAt: Date,
): Promise<number> {
  const rows = await db
    .select({ id: profitLeaks.id })
    .from(profitLeaks)
    .where(
      and(
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.status, "resolved"),
        gte(profitLeaks.resolvedAt, startedAt),
      ),
    );

  return rows.length;
}

export async function getLastLeakScanAt(db: Database, storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ asOf: metricSnapshots.asOf })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.storeId, storeId),
        eq(metricSnapshots.metricKey, LAST_LEAK_SCAN_METRIC_KEY),
        eq(metricSnapshots.period, LAST_LEAK_SCAN_PERIOD),
      ),
    )
    .limit(1);

  return row?.asOf ? row.asOf.toISOString() : null;
}

export async function getLastLeakScanDay(
  db: Database,
  storeId: string,
  timezone: string,
): Promise<string | null> {
  const [row] = await db
    .select({ asOf: metricSnapshots.asOf })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.storeId, storeId),
        eq(metricSnapshots.metricKey, LAST_LEAK_SCAN_METRIC_KEY),
        eq(metricSnapshots.period, LAST_LEAK_SCAN_PERIOD),
      ),
    )
    .limit(1);

  if (!row?.asOf) return null;
  return merchantLocalDay(timezone, row.asOf);
}

async function recordLeakScanComplete(db: Database, storeId: string, scannedAt: Date): Promise<void> {
  await db
    .insert(metricSnapshots)
    .values({
      storeId,
      metricKey: LAST_LEAK_SCAN_METRIC_KEY,
      value: "1",
      period: LAST_LEAK_SCAN_PERIOD,
      asOf: scannedAt,
      source: "profit_leak_scan",
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.storeId, metricSnapshots.metricKey, metricSnapshots.period],
      set: {
        value: "1",
        asOf: scannedAt,
        source: "profit_leak_scan",
        updatedAt: new Date(),
      },
    });
}

function buildDailyMetricsFromMart(
  spendRows: Array<typeof martAdPerformanceDaily.$inferSelect>,
): Array<CampaignDailyMetrics & { channel: string }> {
  return spendRows.map((row) => ({
    channel: row.channel,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    day: row.performanceDate,
    ad_spend: Number(row.adSpend),
    attributed_revenue: Number(row.attributedRevenue ?? 0),
    attributed_contribution_margin: Number(row.attributedContributionMargin ?? 0),
  }));
}

export async function detectAdWasteLeaks(
  db: Database,
  storeId: string,
  dailyMetrics: Array<CampaignDailyMetrics & { channel: string }>,
): Promise<void> {
  const campaignKeys = [
    ...new Set(dailyMetrics.map((row) => campaignScopeKey(row.channel, row.campaign_id))),
  ];
  const referenceDay = dailyMetrics.at(-1)?.day ?? new Date().toISOString().slice(0, 10);

  for (const campaignKey of campaignKeys) {
    const [channel, ...campaignIdParts] = campaignKey.split("|");
    const campaignId = campaignIdParts.join("|");
    const campaignRows = dailyMetrics.filter(
      (row) => row.channel === channel && row.campaign_id === campaignId,
    );
    const evaluation = evaluateAdWasteLeak(campaignRows, campaignId, channel, referenceDay);
    const dedupeKey = `ad_waste:${channel}:${campaignId}`;

    if (evaluation.qualifies && evaluation.evidence) {
      await db
        .insert(profitLeaks)
        .values({
          storeId,
          leakType: "ad_waste",
          externalKey: campaignId,
          status: "active",
          severity: "warning",
          amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
          evidence: [evaluation.evidence],
          dedupeKey,
        })
        .onConflictDoUpdate({
          target: [profitLeaks.storeId, profitLeaks.dedupeKey],
          set: {
            status: "active",
            amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
            evidence: [evaluation.evidence],
            resolvedAt: null,
            updatedAt: new Date(),
          },
        });
      continue;
    }

    if (evaluation.should_resolve) {
      await db
        .update(profitLeaks)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(profitLeaks.storeId, storeId),
            eq(profitLeaks.dedupeKey, dedupeKey),
            eq(profitLeaks.status, "active"),
          ),
        );
    }
  }
}

export async function detectDiscountBleedLeaks(
  db: Database,
  storeId: string,
  orderRows: Awaited<ReturnType<typeof readOrderFactsForStore>>,
  referenceDay: string,
): Promise<void> {
  const snapshots = orderRows
    .map((row) =>
      parseOrderDiscountSnapshot(parseOrderPayload(row), row.order_id ?? undefined),
    )
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot != null);

  const evaluation = evaluateDiscountBleedLeak(snapshots, referenceDay);
  const dedupeKey = "discount_bleed:store";

  if (evaluation.qualifies && evaluation.evidence) {
    await db
      .insert(profitLeaks)
      .values({
        storeId,
        leakType: "discount_bleed",
        externalKey: "store",
        status: "active",
        severity: "warning",
        amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
        evidence: [evaluation.evidence],
        dedupeKey,
      })
      .onConflictDoUpdate({
        target: [profitLeaks.storeId, profitLeaks.dedupeKey],
        set: {
          status: "active",
          amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
          evidence: [evaluation.evidence],
          resolvedAt: null,
          updatedAt: new Date(),
        },
      });
    return;
  }

  if (evaluation.should_resolve) {
    await db
      .update(profitLeaks)
      .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(profitLeaks.storeId, storeId),
          eq(profitLeaks.dedupeKey, dedupeKey),
          eq(profitLeaks.status, "active"),
        ),
      );
  }
}

export async function detectReturnDrainLeaks(
  db: Database,
  storeId: string,
  orderRows: Awaited<ReturnType<typeof readOrderFactsForStore>>,
  referenceDay: string,
): Promise<void> {
  const categoryBySku = await loadSkuCategoryBySku(env.BRONZE_STORAGE_PATH, storeId);
  const activities = orderRows.flatMap((row) =>
    parseOrderSkuReturnActivity(
      parseOrderPayload(row),
      row.order_id ?? row.event_id,
      categoryBySku,
    ),
  );

  const evaluations = evaluateReturnDrainLeaks(activities, referenceDay);
  const qualifyingSkus = new Set(
    evaluations.filter((evaluation) => evaluation.qualifies).map((evaluation) => evaluation.sku),
  );

  for (const evaluation of evaluations) {
    const dedupeKey = `return_drain:${evaluation.sku}`;

    if (evaluation.qualifies && evaluation.evidence) {
      await db
        .insert(profitLeaks)
        .values({
          storeId,
          leakType: "return_drain",
          externalKey: evaluation.sku,
          status: "active",
          severity: "warning",
          amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
          evidence: [evaluation.evidence],
          dedupeKey,
        })
        .onConflictDoUpdate({
          target: [profitLeaks.storeId, profitLeaks.dedupeKey],
          set: {
            status: "active",
            amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
            evidence: [evaluation.evidence],
            resolvedAt: null,
            updatedAt: new Date(),
          },
        });
      continue;
    }

    if (evaluation.should_resolve) {
      await db
        .update(profitLeaks)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(profitLeaks.storeId, storeId),
            eq(profitLeaks.dedupeKey, dedupeKey),
            eq(profitLeaks.status, "active"),
          ),
        );
    }
  }

  const activeReturnDrains = await db
    .select({ dedupeKey: profitLeaks.dedupeKey })
    .from(profitLeaks)
    .where(
      and(
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.leakType, "return_drain"),
        eq(profitLeaks.status, "active"),
      ),
    );

  for (const row of activeReturnDrains) {
    const sku = row.dedupeKey.replace("return_drain:", "");
    if (!qualifyingSkus.has(sku)) {
      await db
        .update(profitLeaks)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(profitLeaks.storeId, storeId),
            eq(profitLeaks.dedupeKey, row.dedupeKey),
            eq(profitLeaks.status, "active"),
          ),
        );
    }
  }
}

export async function detectDeadStockLeaks(
  db: Database,
  storeId: string,
  orderRows: Awaited<ReturnType<typeof readOrderFactsForStore>>,
  referenceDay: string,
): Promise<void> {
  const [availableBySku, unitCostBySku, titlesBySku] = await Promise.all([
    loadAvailableUnitsBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId),
    loadSkuTitlesBySku(env.BRONZE_STORAGE_PATH, storeId),
  ]);

  const sales = orderRows.flatMap((row) =>
    parseOrderSkuUnitSales(parseOrderPayload(row), row.order_id ?? row.event_id),
  );

  const inputs = buildDeadStockSkuInputs(
    sales,
    availableBySku,
    unitCostBySku,
    titlesBySku,
    referenceDay,
  );
  const evaluations = evaluateDeadStockLeaks(inputs);
  const qualifyingSkus = new Set(
    evaluations.filter((evaluation) => evaluation.qualifies).map((evaluation) => evaluation.sku),
  );

  for (const evaluation of evaluations) {
    const dedupeKey = `dead_stock:${evaluation.sku}`;

    if (evaluation.qualifies && evaluation.evidence) {
      await db
        .insert(profitLeaks)
        .values({
          storeId,
          leakType: "dead_stock",
          externalKey: evaluation.sku,
          status: "active",
          severity: "warning",
          amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
          evidence: [evaluation.evidence],
          dedupeKey,
        })
        .onConflictDoUpdate({
          target: [profitLeaks.storeId, profitLeaks.dedupeKey],
          set: {
            status: "active",
            amountAtRiskUsd: formatMoney(evaluation.amount_at_risk_usd),
            evidence: [evaluation.evidence],
            resolvedAt: null,
            updatedAt: new Date(),
          },
        });
      continue;
    }

    if (evaluation.should_resolve) {
      await db
        .update(profitLeaks)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(profitLeaks.storeId, storeId),
            eq(profitLeaks.dedupeKey, dedupeKey),
            eq(profitLeaks.status, "active"),
          ),
        );
    }
  }

  const activeDeadStock = await db
    .select({ dedupeKey: profitLeaks.dedupeKey })
    .from(profitLeaks)
    .where(
      and(
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.leakType, "dead_stock"),
        eq(profitLeaks.status, "active"),
      ),
    );

  for (const row of activeDeadStock) {
    const sku = row.dedupeKey.replace("dead_stock:", "");
    if (!qualifyingSkus.has(sku)) {
      await db
        .update(profitLeaks)
        .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(profitLeaks.storeId, storeId),
            eq(profitLeaks.dedupeKey, row.dedupeKey),
            eq(profitLeaks.status, "active"),
          ),
        );
    }
  }
}

async function runDetectors(
  db: Database,
  storeId: string,
  referenceDay: string,
  lookbackDays: number,
): Promise<void> {
  const sinceDay = addDays(referenceDay, -(lookbackDays - 1));

  const [spendRows, orderRows] = await Promise.all([
    db
      .select()
      .from(martAdPerformanceDaily)
      .where(
        and(
          eq(martAdPerformanceDaily.storeId, storeId),
          gte(martAdPerformanceDaily.performanceDate, sinceDay),
          lte(martAdPerformanceDaily.performanceDate, referenceDay),
        ),
      ),
    readOrderFactsForStore(env.BRONZE_STORAGE_PATH, storeId, sinceDay, referenceDay),
  ]);

  const dailyMetrics = buildDailyMetricsFromMart(spendRows);

  await detectAdWasteLeaks(db, storeId, dailyMetrics);
  await detectDiscountBleedLeaks(db, storeId, orderRows, referenceDay);
  await detectReturnDrainLeaks(db, storeId, orderRows, referenceDay);
  await detectDeadStockLeaks(db, storeId, orderRows, referenceDay);
}

async function withScanTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("profit_leak_scan_timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runProfitLeakScanForStore(
  db: Database,
  storeId: string,
  options: {
    referenceDay?: string;
    lookbackDays?: number;
    force?: boolean;
    timeoutMs?: number;
  } = {},
): Promise<ProfitLeakScanResult> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = options.referenceDay ?? merchantLocalYesterday(timezone);
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const timeoutMs = options.timeoutMs ?? env.LEAK_SCAN_TIMEOUT_MS;
  const startedAt = new Date();
  const beforeKeys = await loadActiveLeakDedupeKeys(db, storeId);

  if (!options.force) {
    const lastScanDay = await getLastLeakScanDay(db, storeId, timezone);
    if (
      !shouldRunProfitLeakScan({
        timezone,
        lastScanDay,
        scanTimeLocal: env.LEAK_SCAN_TIME_LOCAL,
        at: startedAt,
      })
    ) {
      return {
        store_id: storeId,
        scanned: false,
        skipped_reason: "not_due",
        duration_ms: 0,
        new_leaks: 0,
        resolved_leaks: 0,
        timed_out: false,
        reference_day: referenceDay,
      };
    }
  }

  let timedOut = false;
  try {
    await withScanTimeout(
      runDetectors(db, storeId, referenceDay, lookbackDays),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "profit_leak_scan_timeout") {
      timedOut = true;
    } else {
      throw error;
    }
  }

  const afterKeys = await loadActiveLeakDedupeKeys(db, storeId);
  const newLeaks = [...afterKeys].filter((key) => !beforeKeys.has(key)).length;
  const resolvedLeaks = await countResolvedSinceScan(db, storeId, startedAt);
  const scannedAt = new Date();

  await recordLeakScanComplete(db, storeId, scannedAt);
  await refreshProfitLeakSnapshots(db, storeId);
  await createAlertsForNewProfitLeaks(db, storeId, beforeKeys);

  return {
    store_id: storeId,
    scanned: true,
    duration_ms: scannedAt.getTime() - startedAt.getTime(),
    new_leaks: newLeaks,
    resolved_leaks: resolvedLeaks,
    timed_out: timedOut,
    reference_day: referenceDay,
  };
}

export type ProfitLeakSummary = {
  active_leak_count: number;
  leak_counts_by_type: Record<string, number>;
  amount_at_risk_usd: number;
  last_leak_scan_at: string | null;
};

export async function summarizeActiveProfitLeaks(
  db: Database,
  storeId: string,
): Promise<ProfitLeakSummary> {
  const rows = await db
    .select({
      leakType: profitLeaks.leakType,
      amountAtRiskUsd: profitLeaks.amountAtRiskUsd,
    })
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));

  const leakCountsByType: Record<string, number> = {};
  let amountAtRisk = 0;

  for (const row of rows) {
    leakCountsByType[row.leakType] = (leakCountsByType[row.leakType] ?? 0) + 1;
    amountAtRisk += Number(row.amountAtRiskUsd ?? 0);
  }

  return {
    active_leak_count: rows.length,
    leak_counts_by_type: leakCountsByType,
    amount_at_risk_usd: Math.round(amountAtRisk),
    last_leak_scan_at: await getLastLeakScanAt(db, storeId),
  };
}

export async function scanDueProfitLeakScans(
  db: Database,
  options: { force?: boolean } = {},
): Promise<ProfitLeakScanResult[]> {
  const storeRows = await db.select({ id: stores.id }).from(stores);
  const results: ProfitLeakScanResult[] = [];

  for (const store of storeRows) {
    const result = await runProfitLeakScanForStore(db, store.id, { force: options.force });
    if (result.scanned) {
      results.push(result);
    }
  }

  return results;
}
