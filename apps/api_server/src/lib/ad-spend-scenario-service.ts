import { and, desc, eq, gte, lte } from "drizzle-orm";
import { cashRunwaySnapshots, martAdPerformanceDaily, type Database } from "@morgan/db";
import {
  addDays,
  aggregatePoas7d,
  aggregateRoas7d,
  combineAdSpendScenarioResults,
  runAdSpendScenarioForecast,
  type AdSpendScenarioAssumptionOverrides,
  type AdSpendScenarioChannelChange,
  type CombinedAdSpendScenarioResult,
  type ScenarioChannel,
} from "@morgan/integrations";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { merchantLocalDay } from "./cash-runway-service.js";
import { saveScenario } from "./scenario-service.js";

export type AdSpendChannelBaseline = {
  channel: ScenarioChannel;
  baseline_spend_7d_usd: number;
  baseline_revenue_7d_usd: number;
  poas_7d: number | null;
  roas_7d: number | null;
  connected: boolean;
};

export type AdSpendScenarioBaselinesView = {
  reference_day: string;
  runway_days: number | null;
  channels: AdSpendChannelBaseline[];
};

async function fetchChannelMetrics7d(
  db: Database,
  storeId: string,
  channel: ScenarioChannel,
  startDate: string,
  endDate: string,
): Promise<{
  spend: number;
  revenue: number;
  poas: number | null;
  roas: number | null;
}> {
  const rows = await db
    .select({
      adSpend: martAdPerformanceDaily.adSpend,
      revenue: martAdPerformanceDaily.attributedRevenue,
      margin: martAdPerformanceDaily.attributedContributionMargin,
    })
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        eq(martAdPerformanceDaily.channel, channel),
        gte(martAdPerformanceDaily.performanceDate, startDate),
        lte(martAdPerformanceDaily.performanceDate, endDate),
      ),
    );

  if (rows.length === 0) {
    return { spend: 0, revenue: 0, poas: null, roas: null };
  }

  const mapped = rows.map((row) => ({
    ad_spend: Number(row.adSpend ?? 0),
    attributed_revenue: Number(row.revenue ?? 0),
    attributed_contribution_margin: Number(row.margin ?? 0),
  }));

  return {
    spend: mapped.reduce((sum, row) => sum + row.ad_spend, 0),
    revenue: mapped.reduce((sum, row) => sum + row.attributed_revenue, 0),
    poas: aggregatePoas7d(mapped),
    roas: aggregateRoas7d(mapped),
  };
}

async function fetchRunwaySnapshot(
  db: Database,
  storeId: string,
): Promise<{ runwayDays: number | null; avgDailyNetOutflow: number | null }> {
  const [snapshot] = await db
    .select({
      runwayDays: cashRunwaySnapshots.runwayDays,
      avgDailyNetOutflow: cashRunwaySnapshots.avgDailyNetOutflow,
    })
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (!snapshot) {
    return { runwayDays: null, avgDailyNetOutflow: null };
  }

  return {
    runwayDays: snapshot.runwayDays ? Number(snapshot.runwayDays) : null,
    avgDailyNetOutflow: snapshot.avgDailyNetOutflow ? Number(snapshot.avgDailyNetOutflow) : null,
  };
}

function channelAssumptionOverrides(
  channel: ScenarioChannel,
  overrides?: AdSpendScenarioAssumptionOverrides,
): AdSpendScenarioAssumptionOverrides | undefined {
  if (!overrides) return undefined;

  const mapped: AdSpendScenarioAssumptionOverrides = {};
  if (overrides.confidence_band_pct != null) {
    mapped.confidence_band_pct = overrides.confidence_band_pct;
  }

  if (channel === "meta") {
    if (overrides.meta_poas_7d != null) mapped.poas_7d = overrides.meta_poas_7d;
    if (overrides.meta_roas_7d != null) mapped.roas_7d = overrides.meta_roas_7d;
    if (overrides.meta_baseline_spend_7d != null) {
      mapped.baseline_spend_7d = overrides.meta_baseline_spend_7d;
    }
  } else {
    if (overrides.google_poas_7d != null) mapped.poas_7d = overrides.google_poas_7d;
    if (overrides.google_roas_7d != null) mapped.roas_7d = overrides.google_roas_7d;
    if (overrides.google_baseline_spend_7d != null) {
      mapped.baseline_spend_7d = overrides.google_baseline_spend_7d;
    }
  }

  if (overrides.poas_7d != null) mapped.poas_7d = overrides.poas_7d;
  if (overrides.roas_7d != null) mapped.roas_7d = overrides.roas_7d;
  if (overrides.baseline_spend_7d != null) mapped.baseline_spend_7d = overrides.baseline_spend_7d;

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

export async function getAdSpendScenarioBaselines(
  db: Database,
  storeId: string,
): Promise<AdSpendScenarioBaselinesView> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const referenceDay = merchantLocalDay(config?.timezone ?? "UTC");
  const startDate = addDays(referenceDay, -6);

  const [meta, google, runway] = await Promise.all([
    fetchChannelMetrics7d(db, storeId, "meta", startDate, referenceDay),
    fetchChannelMetrics7d(db, storeId, "google", startDate, referenceDay),
    fetchRunwaySnapshot(db, storeId),
  ]);

  return {
    reference_day: referenceDay,
    runway_days: runway.runwayDays,
    channels: [
      {
        channel: "meta",
        baseline_spend_7d_usd: Math.round(meta.spend),
        baseline_revenue_7d_usd: Math.round(meta.revenue),
        poas_7d: meta.poas,
        roas_7d: meta.roas,
        connected: meta.spend > 0,
      },
      {
        channel: "google",
        baseline_spend_7d_usd: Math.round(google.spend),
        baseline_revenue_7d_usd: Math.round(google.revenue),
        poas_7d: google.poas,
        roas_7d: google.roas,
        connected: google.spend > 0,
      },
    ],
  };
}

export type RunAdSpendScenarioInput = {
  channel_changes: AdSpendScenarioChannelChange[];
  assumption_overrides?: AdSpendScenarioAssumptionOverrides;
  save?: boolean;
  source?: string;
};

export type RunAdSpendScenarioResult = CombinedAdSpendScenarioResult & {
  saved_scenario_id: string | null;
};

function buildScenarioTitle(channel: ScenarioChannel, spendChangePct: number): string {
  const label = channel === "google" ? "Google" : "Meta";
  const direction = spendChangePct >= 0 ? "increase" : "decrease";
  return `${label} spend ${direction} ${Math.abs(spendChangePct)}%`;
}

export async function runAdSpendScenarioForStore(
  db: Database,
  storeId: string,
  input: RunAdSpendScenarioInput,
): Promise<RunAdSpendScenarioResult> {
  const baselines = await getAdSpendScenarioBaselines(db, storeId);
  const runway = await fetchRunwaySnapshot(db, storeId);

  const scenarios = input.channel_changes
    .filter((change) => change.spend_change_pct !== 0)
    .map((change) => {
      const baseline = baselines.channels.find((row) => row.channel === change.channel);
      if (!baseline || baseline.baseline_spend_7d_usd <= 0) return null;

      return runAdSpendScenarioForecast({
        channel: change.channel,
        spendChangePct: change.spend_change_pct,
        baselineSpend7dUsd: baseline.baseline_spend_7d_usd,
        baselineRevenue7dUsd: baseline.baseline_revenue_7d_usd,
        poas7d: baseline.poas_7d,
        runwayDays: runway.runwayDays,
        avgDailyNetOutflow: runway.avgDailyNetOutflow,
        referenceDay: baselines.reference_day,
        assumptionOverrides: channelAssumptionOverrides(change.channel, input.assumption_overrides),
      });
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const combined = combineAdSpendScenarioResults(
    scenarios,
    baselines.reference_day,
    runway.avgDailyNetOutflow,
  );

  let savedScenarioId: string | null = null;
  if (input.save && scenarios.length === 1) {
    const scenario = scenarios[0]!;
    const saved = await saveScenario(db, storeId, {
      scenario_type: "ad_spend",
      channel: scenario.channel,
      spend_change_pct: scenario.spend_change_pct,
      title: buildScenarioTitle(scenario.channel, scenario.spend_change_pct),
      inputs: {
        reference_day: baselines.reference_day,
        assumption_items: scenario.assumption_items,
      },
      results: scenario,
      source: input.source ?? "scenario_planner",
    });
    savedScenarioId = saved.id;
  }

  return {
    ...combined,
    saved_scenario_id: savedScenarioId,
  };
}
