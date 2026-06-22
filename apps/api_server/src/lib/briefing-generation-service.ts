import { and, desc, eq } from "drizzle-orm";
import {
  dailyBriefings,
  merchantFinanceConfig,
  profitLeaks,
  stores,
  type Database,
} from "@morgan/db";
import {
  addDays,
  buildAllowedMetricNumbers,
  buildKpiDelta,
  appendMarginTargetWeeklySummary,
  buildBriefingMarginTarget,
  calculateMer,
  clampNarrative,
  leakBody,
  leakTitle,
  merchantLocalDay,
  shouldGenerateDailyBriefing,
  sumAdSpendForMer,
  type BriefingKpiDelta,
  type BriefingSummaryJson,
  type BriefingTopAction,
} from "@morgan/integrations";
import { generateBriefingNarrative } from "./briefing-llm-client.js";
import { sendDailyBriefReadyPush } from "./push-notification-service.js";
import { loadResolvedBriefingSchedule, applyDueBriefingSchedules } from "./briefing-schedule-service.js";
import { loadTargetMarginPct } from "./finance-config-service.js";
import {
  getStoreMetrics,
  metricValue,
  refreshMetricSnapshotsForStore,
  type StoreMetricsView,
} from "./metric-snapshot-service.js";
import { getSqlAgentService } from "./sql-agent-service.js";

export type GeneratedDailyBriefing = {
  store_id: string;
  briefing_date: string;
  headline: string;
  narrative: string;
  summary_json: BriefingSummaryJson;
  generated_at: string;
  created: boolean;
  version: number;
};

function sumNumber(rows: Record<string, unknown>[], field: string): number {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

async function fetchPriorWindowMetrics(
  db: Database,
  storeId: string,
  referenceDay: string,
  metaConnected: boolean,
): Promise<Record<string, number>> {
  const agent = await getSqlAgentService();
  if (!agent) return {};

  const endDate = addDays(referenceDay, -7);
  const startDate = addDays(endDate, -6);
  const params = {
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  };

  const [orders, ads] = await Promise.all([
    agent.runStandardMetricQuery("orders_daily", params),
    metaConnected ? agent.runStandardMetricQuery("ad_performance", params) : Promise.resolve({ rows: [] }),
  ]);

  const netRevenue = sumNumber(orders.rows, "net_revenue");
  const contributionMargin = sumNumber(orders.rows, "contribution_margin");
  const adSpend = sumAdSpendForMer(
    ads.rows.map((row) => ({
      channel: String(row.channel ?? "meta"),
      ad_spend: row.ad_spend,
    })),
    false,
  );
  const attributedMargin = sumNumber(ads.rows, "attributed_contribution_margin");
  const mer = calculateMer(adSpend, netRevenue) ?? 0;

  return {
    net_revenue_7d: netRevenue,
    contribution_margin_7d: contributionMargin,
    mer_7d: mer,
    poas_7d: adSpend > 0 ? attributedMargin / adSpend : 0,
  };
}

async function resolveTopAction(db: Database, storeId: string): Promise<BriefingTopAction> {
  const [leak] = await db
    .select()
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")))
    .orderBy(desc(profitLeaks.amountAtRiskUsd))
    .limit(1);

  if (leak) {
    const amount = Number(leak.amountAtRiskUsd ?? 0);
    return {
      title: leakTitle(leak.leakType, leak.evidence ?? null),
      body: leakBody(leak.leakType, leak.evidence ?? null),
      category: leak.leakType,
      impact_low_usd: Number.isFinite(amount) ? amount : null,
      impact_high_usd: Number.isFinite(amount) ? amount : null,
      source: "profit_leak",
      external_key: leak.externalKey,
    };
  }

  return {
    title: "Connect your data sources",
    body: "Link Shopify, ads, and banking so Morgan can surface sharper daily actions.",
    category: "setup",
    impact_low_usd: null,
    impact_high_usd: null,
    source: "fallback",
    external_key: null,
  };
}

function buildKpiDeltas(metrics: StoreMetricsView, priorMetrics: Record<string, number>): BriefingKpiDelta[] {
  const currentProfit = metricValue(metrics.metrics, "contribution_margin_7d") ?? 0;
  const currentRevenue = metricValue(metrics.metrics, "net_revenue_7d") ?? 0;
  const currentMer = metricValue(metrics.metrics, "mer_7d") ?? 0;
  const currentPoas = metricValue(metrics.metrics, "poas_7d") ?? 0;

  const deltas: BriefingKpiDelta[] = [
    buildKpiDelta({
      key: "contribution_margin_7d",
      label: "Contribution profit (7d)",
      value: currentProfit,
      priorValue: priorMetrics.contribution_margin_7d ?? 0,
      format: "currency",
    }),
    buildKpiDelta({
      key: "net_revenue_7d",
      label: "Net revenue (7d)",
      value: currentRevenue,
      priorValue: priorMetrics.net_revenue_7d ?? 0,
      format: "currency",
    }),
  ];

  if (metrics.meta_connected) {
    deltas.push(
      buildKpiDelta({
        key: "mer_7d",
        label: "MER (7d)",
        value: currentMer,
        priorValue: priorMetrics.mer_7d ?? 0,
        format: "percent",
      }),
    );
  } else {
    deltas.push(
      buildKpiDelta({
        key: "poas_7d",
        label: "POAS (7d)",
        value: currentPoas,
        priorValue: priorMetrics.poas_7d ?? 0,
        format: "ratio",
      }),
    );
  }

  return deltas;
}

function metricsRecord(metrics: Awaited<ReturnType<typeof getStoreMetrics>>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const row of metrics.metrics) {
    const value = Number(row.value);
    if (Number.isFinite(value)) record[row.metric_key] = value;
  }
  return record;
}

export async function loadStoreBriefingConfig(db: Database, storeId: string) {
  const resolved = await loadResolvedBriefingSchedule(db, storeId);
  if (!resolved) return null;

  return {
    storeId,
    timezone: resolved.timezone,
    briefingTimeLocal: resolved.briefingTimeLocal,
  };
}

export async function getBriefingForDate(
  db: Database,
  storeId: string,
  briefingDate: string,
): Promise<typeof dailyBriefings.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(dailyBriefings)
    .where(and(eq(dailyBriefings.storeId, storeId), eq(dailyBriefings.briefingDate, briefingDate)))
    .limit(1);

  return row ?? null;
}

export async function generateDailyBriefing(
  db: Database,
  storeId: string,
  options: {
    referenceDay?: string;
    force?: boolean;
    trigger?: "scheduled" | "critical_alert";
    alertType?: string;
  } = {},
): Promise<GeneratedDailyBriefing | null> {
  const config = await loadStoreBriefingConfig(db, storeId);
  if (!config) return null;

  const referenceDay = options.referenceDay ?? merchantLocalDay(config.timezone);
  const existing = await getBriefingForDate(db, storeId, referenceDay);
  if (existing && !options.force) {
    return {
      store_id: storeId,
      briefing_date: existing.briefingDate,
      headline: existing.headline,
      narrative: existing.narrativeText,
      summary_json: existing.summaryJson as BriefingSummaryJson,
      generated_at: existing.generatedAt.toISOString(),
      created: false,
      version: existing.version,
    };
  }

  await refreshMetricSnapshotsForStore(db, storeId, referenceDay);
  const metricsView = await getStoreMetrics(db, storeId);
  const priorMetrics = await fetchPriorWindowMetrics(
    db,
    storeId,
    referenceDay,
    metricsView.meta_connected,
  );
  const kpiDeltas = buildKpiDeltas(metricsView, priorMetrics);
  const topAction = await resolveTopAction(db, storeId);
  const metrics = metricsRecord(metricsView);
  const allowedNumbers = buildAllowedMetricNumbers(metrics, kpiDeltas);

  const { output, source } = await generateBriefingNarrative({
    briefingDate: referenceDay,
    kpiDeltas,
    topAction,
    metaConnected: metricsView.meta_connected,
    metrics,
    allowedNumbers,
  });

  const targetMarginPct = await loadTargetMarginPct(db, storeId);
  const currentProfit = metricValue(metricsView.metrics, "contribution_margin_7d") ?? 0;
  const currentRevenue = metricValue(metricsView.metrics, "net_revenue_7d") ?? 0;
  const marginTarget = buildBriefingMarginTarget({
    contributionMargin7d: currentProfit,
    netRevenue7d: currentRevenue,
    priorContributionMargin7d: priorMetrics.contribution_margin_7d,
    priorNetRevenue7d: priorMetrics.net_revenue_7d,
    targetMarginPct,
  });
  const narrative = marginTarget
    ? clampNarrative(appendMarginTargetWeeklySummary(output.narrative, marginTarget))
    : output.narrative;

  const summaryJson: BriefingSummaryJson = {
    kpi_deltas: kpiDeltas,
    top_action: topAction,
    metrics_as_of: metricsView.snapshots_as_of,
    meta_connected: metricsView.meta_connected,
    source,
    trigger: options.trigger ?? "scheduled",
    alert_type: options.alertType ?? null,
    ...(marginTarget ? { margin_target: marginTarget } : {}),
  };

  const generatedAt = new Date();
  const [row] = await db
    .insert(dailyBriefings)
    .values({
      storeId,
      briefingDate: referenceDay,
      headline: output.headline,
      narrativeText: narrative,
      summaryJson,
      generatedAt,
    })
    .onConflictDoUpdate({
      target: [dailyBriefings.storeId, dailyBriefings.briefingDate],
      set: {
        headline: output.headline,
        narrativeText: narrative,
        summaryJson,
        generatedAt,
        version: existing ? existing.version + 1 : 1,
      },
    })
    .returning();

  if (!row) return null;

  const result: GeneratedDailyBriefing = {
    store_id: storeId,
    briefing_date: row.briefingDate,
    headline: row.headline,
    narrative: row.narrativeText,
    summary_json: row.summaryJson as BriefingSummaryJson,
    generated_at: row.generatedAt.toISOString(),
    created: !existing,
    version: row.version,
  };

  const trigger = options.trigger ?? "scheduled";
  if (result.created && trigger === "scheduled") {
    await sendDailyBriefReadyPush(db, storeId, {
      headline: result.headline,
      kpiDeltas: kpiDeltas,
      briefingDate: result.briefing_date,
    });
  }

  return result;
}

export async function generateDueDailyBriefings(db: Database): Promise<number> {
  await applyDueBriefingSchedules(db);

  const storeRows = await db
    .select({
      id: stores.id,
    })
    .from(stores);

  let generated = 0;

  for (const store of storeRows) {
    const config = await loadStoreBriefingConfig(db, store.id);
    if (!config) continue;

    const timezone = config.timezone;
    const briefingTimeLocal = config.briefingTimeLocal;
    const localDay = merchantLocalDay(timezone);
    const existing = await getBriefingForDate(db, store.id, localDay);

    if (
      !shouldGenerateDailyBriefing({
        timezone,
        briefingTimeLocal,
        lastBriefingDate: existing?.briefingDate ?? null,
      })
    ) {
      continue;
    }

    const result = await generateDailyBriefing(db, store.id, {
      referenceDay: localDay,
      trigger: "scheduled",
    });
    if (result?.created) generated += 1;
  }

  return generated;
}
