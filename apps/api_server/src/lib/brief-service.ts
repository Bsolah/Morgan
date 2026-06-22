import type { Database } from "@morgan/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { dailyBriefings } from "@morgan/db";
import { addDays, merchantLocalDay, shouldGenerateDailyBriefing } from "@morgan/integrations";
import type { BriefingKpiDelta, BriefingSummaryJson, BriefingTopAction } from "@morgan/integrations";
import {
  generateDailyBriefing,
  getBriefingForDate,
  loadStoreBriefingConfig,
} from "./briefing-generation-service.js";
import { getMarketingOverview } from "./poas-service.js";
import { loadResolvedBriefingSchedule } from "./briefing-schedule-service.js";

export type BriefingHistoryListItem = {
  date: string;
  headline: string | null;
  has_brief: boolean;
  version: number;
  generated_at: string | null;
};

export type BriefingHistoryListView = {
  days: number;
  items: BriefingHistoryListItem[];
};

export type DailyBriefView = {
  date: string;
  headline: string;
  narrative: string;
  meta_connected: boolean;
  kpi_deltas: BriefingKpiDelta[];
  top_action: BriefingTopAction | null;
  generated_at: string | null;
  has_brief: boolean;
  next_briefing_at: string;
  briefing_time_local: string;
  timezone: string;
  version: number;
  marketing?: {
    poas: number | null;
    roas: number | null;
    ad_spend_7d: number;
    tooltips: {
      poas: string;
      roas: string;
    };
  };
};

async function loadStoreSchedule(db: Database, storeId: string) {
  const resolved = await loadResolvedBriefingSchedule(db, storeId);
  return {
    timezone: resolved?.timezone ?? "UTC",
    briefingTimeLocal: resolved?.briefingTimeLocal ?? "06:00",
    nextBriefingAt: resolved?.nextBriefingAt ?? new Date().toISOString(),
  };
}

function mapSummaryToView(
  briefingDate: string,
  headline: string,
  narrative: string,
  summary: BriefingSummaryJson,
  generatedAt: string | null,
  schedule: { timezone: string; briefingTimeLocal: string; nextBriefingAt: string },
  version: number,
): DailyBriefView {
  return {
    date: briefingDate,
    headline,
    narrative,
    meta_connected: summary.meta_connected,
    kpi_deltas: summary.kpi_deltas,
    top_action: summary.top_action,
    generated_at: generatedAt,
    has_brief: true,
    next_briefing_at: schedule.nextBriefingAt,
    briefing_time_local: schedule.briefingTimeLocal,
    timezone: schedule.timezone,
    version,
  };
}

async function attachMarketing(
  db: Database,
  storeId: string,
  brief: DailyBriefView,
): Promise<DailyBriefView> {
  if (!brief.meta_connected) return brief;

  const overview = await getMarketingOverview(db, storeId, 7);
  return {
    ...brief,
    marketing: {
      poas: overview.summary.poas,
      roas: overview.summary.roas,
      ad_spend_7d: overview.summary.ad_spend,
      tooltips: overview.tooltips,
    },
  };
}

export async function getDailyBrief(db: Database, storeId: string): Promise<DailyBriefView> {
  const schedule = await loadStoreSchedule(db, storeId);
  const today = merchantLocalDay(schedule.timezone);

  let row = await getBriefingForDate(db, storeId, today);
  if (
    !row &&
    shouldGenerateDailyBriefing({
      timezone: schedule.timezone,
      briefingTimeLocal: schedule.briefingTimeLocal,
      lastBriefingDate: null,
    })
  ) {
    await generateDailyBriefing(db, storeId, { referenceDay: today });
    row = await getBriefingForDate(db, storeId, today);
  }

  if (row) {
    const summary = row.summaryJson as BriefingSummaryJson;
    const brief = mapSummaryToView(
      row.briefingDate,
      row.headline,
      row.narrativeText,
      summary,
      row.generatedAt.toISOString(),
      schedule,
      row.version,
    );
    return attachMarketing(db, storeId, brief);
  }

  const overview = await getMarketingOverview(db, storeId, 7);
  const fallback: DailyBriefView = {
    date: today,
    headline: "Your briefing is on the way",
    narrative:
      "Morgan prepares your daily financial briefing each morning after metrics refresh. Check back shortly.",
    meta_connected: overview.meta_connected,
    kpi_deltas: [],
    top_action: null,
    generated_at: null,
    has_brief: false,
    next_briefing_at: schedule.nextBriefingAt,
    briefing_time_local: schedule.briefingTimeLocal,
    timezone: schedule.timezone,
    version: 0,
  };

  return attachMarketing(db, storeId, fallback);
}

export async function getBriefForDate(
  db: Database,
  storeId: string,
  briefingDate: string,
): Promise<DailyBriefView | null> {
  const schedule = await loadStoreSchedule(db, storeId);

  const row = await getBriefingForDate(db, storeId, briefingDate);
  if (!row) return null;

  const summary = row.summaryJson as BriefingSummaryJson;
  const brief = mapSummaryToView(
    row.briefingDate,
    row.headline,
    row.narrativeText,
    summary,
    row.generatedAt.toISOString(),
    schedule,
    row.version,
  );

  return attachMarketing(db, storeId, brief);
}

export async function listBriefingHistory(
  db: Database,
  storeId: string,
  days = 30,
): Promise<BriefingHistoryListView> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const today = merchantLocalDay(timezone);
  const windowDays = Math.min(Math.max(days, 1), 90);
  const startDate = addDays(today, -(windowDays - 1));

  const rows = await db
    .select({
      briefingDate: dailyBriefings.briefingDate,
      headline: dailyBriefings.headline,
      version: dailyBriefings.version,
      generatedAt: dailyBriefings.generatedAt,
    })
    .from(dailyBriefings)
    .where(
      and(
        eq(dailyBriefings.storeId, storeId),
        gte(dailyBriefings.briefingDate, startDate),
        lte(dailyBriefings.briefingDate, today),
      ),
    )
    .orderBy(desc(dailyBriefings.briefingDate));

  const byDate = new Map(rows.map((row) => [row.briefingDate, row]));
  const items: BriefingHistoryListItem[] = [];

  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = addDays(today, -offset);
    const row = byDate.get(date);
    items.push({
      date,
      headline: row?.headline ?? null,
      has_brief: Boolean(row),
      version: row?.version ?? 0,
      generated_at: row?.generatedAt?.toISOString() ?? null,
    });
  }

  return { days: windowDays, items };
}
