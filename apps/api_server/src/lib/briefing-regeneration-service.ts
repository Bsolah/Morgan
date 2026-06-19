import { and, desc, eq } from "drizzle-orm";
import {
  cashRunwaySnapshots,
  dailyBriefingVersions,
  dailyBriefings,
  type Database,
} from "@morgan/db";
import {
  merchantLocalDay,
  shouldAllowCriticalBriefRegeneration,
  type BriefingSummaryJson,
} from "@morgan/integrations";
import { env } from "../config.js";
import {
  generateDailyBriefing,
  getBriefingForDate,
  loadStoreBriefingConfig,
} from "./briefing-generation-service.js";
import { sendBriefUpdatedPush } from "./push-notification-service.js";

export type BriefRegenerationResult = {
  regenerated: boolean;
  reason?: string;
  headline?: string;
  version?: number;
};

export type BriefingVersionView = {
  version: number;
  headline: string;
  narrative: string;
  summary_json: BriefingSummaryJson;
  trigger: string;
  alert_type: string | null;
  generated_at: string;
  is_current: boolean;
};

export type BriefingHistoryView = {
  briefing_date: string;
  current_version: number;
  versions: BriefingVersionView[];
};

async function loadRunwayDays(db: Database, storeId: string): Promise<number | null> {
  const [snapshot] = await db
    .select({ runwayDays: cashRunwaySnapshots.runwayDays })
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (!snapshot?.runwayDays) return null;
  const value = Number(snapshot.runwayDays);
  return Number.isFinite(value) ? value : null;
}

function runwayDaysFromSnapshot(metricSnapshot?: Record<string, unknown>): number | null {
  const value = metricSnapshot?.runway_days;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function archiveBriefingVersion(
  db: Database,
  briefing: typeof dailyBriefings.$inferSelect,
): Promise<void> {
  const summary = briefing.summaryJson as BriefingSummaryJson;
  await db
    .insert(dailyBriefingVersions)
    .values({
      storeId: briefing.storeId,
      briefingDate: briefing.briefingDate,
      version: briefing.version,
      headline: briefing.headline,
      narrativeText: briefing.narrativeText,
      summaryJson: briefing.summaryJson,
      trigger: summary.trigger ?? "scheduled",
      alertType: summary.alert_type ?? null,
      generatedAt: briefing.generatedAt,
    })
    .onConflictDoNothing();
}

export async function maybeRegenerateBriefOnCriticalAlert(
  db: Database,
  input: {
    storeId: string;
    alertType: string;
    metricSnapshot?: Record<string, unknown>;
  },
): Promise<BriefRegenerationResult> {
  const config = await loadStoreBriefingConfig(db, input.storeId);
  if (!config) return { regenerated: false, reason: "store_not_found" };

  const briefingDate = merchantLocalDay(config.timezone);
  const existing = await getBriefingForDate(db, input.storeId, briefingDate);
  const runwayDays =
    runwayDaysFromSnapshot(input.metricSnapshot) ?? (await loadRunwayDays(db, input.storeId));

  if (
    !shouldAllowCriticalBriefRegeneration({
      timezone: config.timezone,
      runwayDays,
      quietStartHour: env.BRIEFING_QUIET_HOURS_START,
      quietEndHour: env.BRIEFING_QUIET_HOURS_END,
      criticalCashOverrideDays: env.BRIEFING_CRITICAL_CASH_OVERRIDE_DAYS,
    })
  ) {
    return { regenerated: false, reason: "quiet_hours" };
  }

  if (existing && existing.criticalRegenerationsCount >= 1) {
    return { regenerated: false, reason: "extra_daily_limit_reached" };
  }

  if (existing) {
    await archiveBriefingVersion(db, existing);
  }

  const result = await generateDailyBriefing(db, input.storeId, {
    referenceDay: briefingDate,
    force: true,
    trigger: "critical_alert",
    alertType: input.alertType,
  });

  if (!result) return { regenerated: false, reason: "generation_failed" };

  if (existing) {
    await db
      .update(dailyBriefings)
      .set({ criticalRegenerationsCount: existing.criticalRegenerationsCount + 1 })
      .where(
        and(
          eq(dailyBriefings.storeId, input.storeId),
          eq(dailyBriefings.briefingDate, briefingDate),
        ),
      );
  }

  await sendBriefUpdatedPush(db, input.storeId, result.headline);

  const updated = await getBriefingForDate(db, input.storeId, briefingDate);
  return {
    regenerated: true,
    headline: result.headline,
    version: updated?.version,
  };
}

function mapVersionView(
  input: {
    version: number;
    headline: string;
    narrativeText: string;
    summaryJson: Record<string, unknown>;
    trigger: string;
    alertType: string | null;
    generatedAt: Date;
  },
  isCurrent: boolean,
): BriefingVersionView {
  return {
    version: input.version,
    headline: input.headline,
    narrative: input.narrativeText,
    summary_json: input.summaryJson as BriefingSummaryJson,
    trigger: input.trigger,
    alert_type: input.alertType,
    generated_at: input.generatedAt.toISOString(),
    is_current: isCurrent,
  };
}

export async function getBriefingHistoryForDate(
  db: Database,
  storeId: string,
  briefingDate: string,
): Promise<BriefingHistoryView | null> {
  const current = await getBriefingForDate(db, storeId, briefingDate);
  const archived = await db
    .select()
    .from(dailyBriefingVersions)
    .where(
      and(
        eq(dailyBriefingVersions.storeId, storeId),
        eq(dailyBriefingVersions.briefingDate, briefingDate),
      ),
    )
    .orderBy(dailyBriefingVersions.version);

  if (!current && archived.length === 0) return null;

  const versions: BriefingVersionView[] = archived.map((row) =>
    mapVersionView(
      {
        version: row.version,
        headline: row.headline,
        narrativeText: row.narrativeText,
        summaryJson: row.summaryJson,
        trigger: row.trigger,
        alertType: row.alertType,
        generatedAt: row.generatedAt,
      },
      false,
    ),
  );

  if (current) {
    const summary = current.summaryJson as BriefingSummaryJson;
    versions.push(
      mapVersionView(
        {
          version: current.version,
          headline: current.headline,
          narrativeText: current.narrativeText,
          summaryJson: current.summaryJson,
          trigger: summary.trigger ?? "scheduled",
          alertType: summary.alert_type ?? null,
          generatedAt: current.generatedAt,
        },
        true,
      ),
    );
  }

  versions.sort((left, right) => left.version - right.version);

  return {
    briefing_date: briefingDate,
    current_version: current?.version ?? versions.at(-1)?.version ?? 1,
    versions,
  };
}
