import { and, eq, inArray } from "drizzle-orm";
import {
  integrations,
  martAdPerformanceDaily,
  metaInsightsDaily,
  metaIntegrationState,
  metaSyncJobs,
  type Database,
} from "@morgan/db";
import {
  chunkDateRange,
  fetchMetaInsightsBatch,
  META_INSIGHT_LEVELS,
  type MetaInsightLevel,
  type MetaInsightRow,
} from "@morgan/integrations";
import { env } from "../config.js";
import { getMetaCredentials } from "./meta-integration-service.js";
import { getSelectedMetaAdAccountId, recalculatePoasForStore } from "./poas-service.js";

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number): string {
  return value.toFixed(4);
}

async function ensureMetaStateRow(db: Database, integrationId: string) {
  await db
    .insert(metaIntegrationState)
    .values({ integrationId })
    .onConflictDoNothing();
}

async function markSyncRunning(db: Database, integrationId: string, storeId: string) {
  await ensureMetaStateRow(db, integrationId);

  await db
    .update(integrations)
    .set({ status: "syncing" })
    .where(eq(integrations.id, integrationId));

  await db
    .update(metaSyncJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(
        eq(metaSyncJobs.integrationId, integrationId),
        inArray(metaSyncJobs.status, ["pending", "running"]),
      ),
    );

  const [existingJob] = await db
    .select({ id: metaSyncJobs.id })
    .from(metaSyncJobs)
    .where(
      and(
        eq(metaSyncJobs.integrationId, integrationId),
        inArray(metaSyncJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (!existingJob) {
    await db.insert(metaSyncJobs).values({
      storeId,
      integrationId,
      status: "running",
    });
  }
}

async function upsertInsightDetailRows(
  db: Database,
  storeId: string,
  rows: MetaInsightRow[],
) {
  for (const row of rows) {
    await db
      .insert(metaInsightsDaily)
      .values({
        storeId,
        channel: "meta",
        insightLevel: row.level,
        entityId: row.entity_id,
        entityName: row.entity_name,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        adsetId: row.adset_id,
        adsetName: row.adset_name,
        adId: row.ad_id,
        adName: row.ad_name,
        performanceDate: row.day,
        adSpend: formatMoney(row.spend),
        impressions: row.impressions,
        clicks: row.clicks,
        purchases: row.purchases,
        purchaseValue: formatMoney(row.purchase_value),
      })
      .onConflictDoUpdate({
        target: [
          metaInsightsDaily.storeId,
          metaInsightsDaily.channel,
          metaInsightsDaily.insightLevel,
          metaInsightsDaily.entityId,
          metaInsightsDaily.performanceDate,
        ],
        set: {
          entityName: row.entity_name,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          adsetId: row.adset_id,
          adsetName: row.adset_name,
          adId: row.ad_id,
          adName: row.ad_name,
          adSpend: formatMoney(row.spend),
          impressions: row.impressions,
          clicks: row.clicks,
          purchases: row.purchases,
          purchaseValue: formatMoney(row.purchase_value),
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertCampaignMartRows(
  db: Database,
  storeId: string,
  rows: MetaInsightRow[],
) {
  const campaignRows = rows.filter((row) => row.level === "campaign");

  for (const row of campaignRows) {
    await db
      .insert(martAdPerformanceDaily)
      .values({
        storeId,
        channel: "meta",
        campaignId: row.campaign_id ?? row.entity_id,
        campaignName: row.campaign_name ?? row.entity_name,
        performanceDate: row.day,
        adSpend: formatMoney(row.spend),
        impressions: row.impressions,
        clicks: row.clicks,
        purchases: row.purchases,
        purchaseValue: formatMoney(row.purchase_value),
      })
      .onConflictDoUpdate({
        target: [
          martAdPerformanceDaily.storeId,
          martAdPerformanceDaily.channel,
          martAdPerformanceDaily.campaignId,
          martAdPerformanceDaily.performanceDate,
        ],
        set: {
          campaignName: row.campaign_name ?? row.entity_name,
          adSpend: formatMoney(row.spend),
          impressions: row.impressions,
          clicks: row.clicks,
          purchases: row.purchases,
          purchaseValue: formatMoney(row.purchase_value),
          updatedAt: new Date(),
        },
      });
  }
}

async function pullInsightsForWindow(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string,
  useAsync: boolean,
): Promise<Map<MetaInsightLevel, MetaInsightRow[]>> {
  const requests = META_INSIGHT_LEVELS.map((level) => ({
    level,
    since,
    until,
    useAsync,
  }));

  return fetchMetaInsightsBatch({
    adAccountId,
    accessToken,
    requests,
    maxRetries: env.META_INSIGHTS_RATE_LIMIT_MAX_RETRIES,
    baseDelayMs: env.META_INSIGHTS_RATE_LIMIT_BASE_DELAY_MS,
  });
}

async function recordSyncSuccess(
  db: Database,
  integrationId: string,
  backfillCompleted: boolean,
) {
  const now = new Date();

  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: now })
    .where(eq(integrations.id, integrationId));

  await db
    .update(metaIntegrationState)
    .set({
      lastInsightsError: null,
      insightsBackfillCompleted: backfillCompleted,
      updatedAt: now,
    })
    .where(eq(metaIntegrationState.integrationId, integrationId));

  await db
    .update(metaSyncJobs)
    .set({ status: "completed", completedAt: now, error: null, updatedAt: now })
    .where(
      and(
        eq(metaSyncJobs.integrationId, integrationId),
        inArray(metaSyncJobs.status, ["pending", "running"]),
      ),
    );
}

async function recordSyncFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  await ensureMetaStateRow(db, integrationId);

  await db
    .update(integrations)
    .set({ status: "error" })
    .where(eq(integrations.id, integrationId));

  await db
    .update(metaIntegrationState)
    .set({ lastInsightsError: message, updatedAt: new Date() })
    .where(eq(metaIntegrationState.integrationId, integrationId));

  await db
    .update(metaSyncJobs)
    .set({ status: "failed", error: message, updatedAt: new Date() })
    .where(
      and(eq(metaSyncJobs.integrationId, integrationId), eq(metaSyncJobs.storeId, storeId)),
    );
}

export async function syncMetaInsightsForStore(db: Database, storeId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration || integration.status === "disconnected") return;

  const adAccountId = await getSelectedMetaAdAccountId(db, storeId);
  if (!adAccountId) return;

  const credentials = await getMetaCredentials(db, integration.id, env.ENCRYPTION_KEY);
  if (!credentials?.access_token) return;

  const [state] = await db
    .select()
    .from(metaIntegrationState)
    .where(eq(metaIntegrationState.integrationId, integration.id))
    .limit(1);

  const until = new Date().toISOString().slice(0, 10);
  const isBackfill = !state?.insightsBackfillCompleted;
  const lookbackDays = isBackfill
    ? env.META_INSIGHTS_BACKFILL_DAYS
    : env.META_INSIGHTS_INCREMENTAL_DAYS;
  const since = addDays(until, -(lookbackDays - 1));
  const chunks = chunkDateRange(since, until, env.META_INSIGHTS_CHUNK_DAYS);

  await markSyncRunning(db, integration.id, storeId);

  try {
    for (const chunk of chunks) {
      const levelRows = await pullInsightsForWindow(
        adAccountId,
        credentials.access_token,
        chunk.since,
        chunk.until,
        isBackfill,
      );

      for (const rows of levelRows.values()) {
        await upsertInsightDetailRows(db, storeId, rows);
      }

      const campaignRows = levelRows.get("campaign") ?? [];
      await upsertCampaignMartRows(db, storeId, campaignRows);
    }

    await recalculatePoasForStore(db, storeId, {
      lookbackDays: isBackfill ? env.META_INSIGHTS_BACKFILL_DAYS : env.META_INSIGHTS_INCREMENTAL_DAYS,
    });

    await recordSyncSuccess(db, integration.id, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta insights sync failed";
    await recordSyncFailure(db, integration.id, storeId, message);
    throw error;
  }
}

export async function syncMetaInsightsForConnectedStores(db: Database): Promise<void> {
  const rows = await db
    .select({ storeId: integrations.storeId })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "meta"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  for (const row of rows) {
    try {
      await syncMetaInsightsForStore(db, row.storeId);
    } catch {
      // Error state recorded per store in syncMetaInsightsForStore.
    }
  }
}
