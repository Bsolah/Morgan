import { and, eq, inArray } from "drizzle-orm";
import {
  googleAdsIntegrationState,
  googleAdsShoppingPerformanceDaily,
  googleAdsSyncJobs,
  integrations,
  martAdPerformanceDaily,
  type Database,
} from "@morgan/db";
import {
  chunkDateRange,
  fetchGoogleAdsCampaignPerformance,
  fetchGoogleAdsShoppingProductPerformance,
} from "@morgan/integrations";
import { env } from "../config.js";
import {
  getGoogleAdsCredentials,
  getSelectedGoogleAdsClientCustomerId,
} from "./google-ads-integration-service.js";
import { recalculatePoasForStore } from "./poas-service.js";

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number): string {
  return value.toFixed(4);
}

async function ensureGoogleAdsStateRow(db: Database, integrationId: string) {
  await db.insert(googleAdsIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function markSyncRunning(db: Database, integrationId: string, storeId: string) {
  await ensureGoogleAdsStateRow(db, integrationId);

  await db
    .update(integrations)
    .set({ status: "syncing" })
    .where(eq(integrations.id, integrationId));

  await db
    .update(googleAdsSyncJobs)
    .set({ status: "running", updatedAt: new Date() })
    .where(
      and(
        eq(googleAdsSyncJobs.integrationId, integrationId),
        inArray(googleAdsSyncJobs.status, ["pending", "running"]),
      ),
    );

  const [existingJob] = await db
    .select({ id: googleAdsSyncJobs.id })
    .from(googleAdsSyncJobs)
    .where(
      and(
        eq(googleAdsSyncJobs.integrationId, integrationId),
        inArray(googleAdsSyncJobs.status, ["pending", "running"]),
      ),
    )
    .limit(1);

  if (!existingJob) {
    await db.insert(googleAdsSyncJobs).values({
      storeId,
      integrationId,
      status: "running",
    });
  }
}

async function upsertCampaignMartRows(
  db: Database,
  storeId: string,
  rows: Awaited<ReturnType<typeof fetchGoogleAdsCampaignPerformance>>,
) {
  for (const row of rows) {
    await db
      .insert(martAdPerformanceDaily)
      .values({
        storeId,
        channel: "google_ads",
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        performanceDate: row.day,
        adSpend: formatMoney(row.cost),
        impressions: row.impressions,
        clicks: row.clicks,
        purchases: Math.round(row.conversions),
        purchaseValue: formatMoney(row.conversion_value),
      })
      .onConflictDoUpdate({
        target: [
          martAdPerformanceDaily.storeId,
          martAdPerformanceDaily.channel,
          martAdPerformanceDaily.campaignId,
          martAdPerformanceDaily.performanceDate,
        ],
        set: {
          campaignName: row.campaign_name,
          adSpend: formatMoney(row.cost),
          impressions: row.impressions,
          clicks: row.clicks,
          purchases: Math.round(row.conversions),
          purchaseValue: formatMoney(row.conversion_value),
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertShoppingProductRows(
  db: Database,
  storeId: string,
  rows: Awaited<ReturnType<typeof fetchGoogleAdsShoppingProductPerformance>>,
) {
  for (const row of rows) {
    await db
      .insert(googleAdsShoppingPerformanceDaily)
      .values({
        storeId,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        productItemId: row.product_item_id,
        productTitle: row.product_title,
        performanceDate: row.day,
        adSpend: formatMoney(row.cost),
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: formatMoney(row.conversions),
        conversionValue: formatMoney(row.conversion_value),
      })
      .onConflictDoUpdate({
        target: [
          googleAdsShoppingPerformanceDaily.storeId,
          googleAdsShoppingPerformanceDaily.campaignId,
          googleAdsShoppingPerformanceDaily.productItemId,
          googleAdsShoppingPerformanceDaily.performanceDate,
        ],
        set: {
          campaignName: row.campaign_name,
          productTitle: row.product_title,
          adSpend: formatMoney(row.cost),
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: formatMoney(row.conversions),
          conversionValue: formatMoney(row.conversion_value),
          updatedAt: new Date(),
        },
      });
  }
}

async function recordSyncSuccess(db: Database, integrationId: string, backfillCompleted: boolean) {
  const now = new Date();

  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: now })
    .where(eq(integrations.id, integrationId));

  await db
    .update(googleAdsIntegrationState)
    .set({
      lastInsightsError: null,
      insightsBackfillCompleted: backfillCompleted,
      updatedAt: now,
    })
    .where(eq(googleAdsIntegrationState.integrationId, integrationId));

  await db
    .update(googleAdsSyncJobs)
    .set({ status: "completed", completedAt: now, error: null, updatedAt: now })
    .where(
      and(
        eq(googleAdsSyncJobs.integrationId, integrationId),
        inArray(googleAdsSyncJobs.status, ["pending", "running"]),
      ),
    );
}

async function recordSyncFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  await ensureGoogleAdsStateRow(db, integrationId);

  await db
    .update(integrations)
    .set({ status: "error" })
    .where(eq(integrations.id, integrationId));

  await db
    .update(googleAdsIntegrationState)
    .set({ lastInsightsError: message, updatedAt: new Date() })
    .where(eq(googleAdsIntegrationState.integrationId, integrationId));

  await db
    .update(googleAdsSyncJobs)
    .set({ status: "failed", error: message, updatedAt: new Date() })
    .where(and(eq(googleAdsSyncJobs.integrationId, integrationId), eq(googleAdsSyncJobs.storeId, storeId)));
}

export async function syncGoogleAdsInsightsForStore(db: Database, storeId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  if (!integration || integration.status === "disconnected") return;

  const selection = await getSelectedGoogleAdsClientCustomerId(db, storeId);
  if (!selection) return;

  const credentials = await getGoogleAdsCredentials(db, integration.id, env.ENCRYPTION_KEY);
  if (!credentials?.access_token || !env.GOOGLE_ADS_DEVELOPER_TOKEN) return;

  const [state] = await db
    .select()
    .from(googleAdsIntegrationState)
    .where(eq(googleAdsIntegrationState.integrationId, integration.id))
    .limit(1);

  if (state?.pendingManagerSelection || state?.pendingClientSelection) return;

  const until = new Date().toISOString().slice(0, 10);
  const isBackfill = !state?.insightsBackfillCompleted;
  const lookbackDays = isBackfill
    ? env.GOOGLE_ADS_INSIGHTS_BACKFILL_DAYS
    : env.GOOGLE_ADS_INSIGHTS_INCREMENTAL_DAYS;
  const since = addDays(until, -(lookbackDays - 1));
  const chunks = chunkDateRange(since, until, env.GOOGLE_ADS_INSIGHTS_CHUNK_DAYS);

  await markSyncRunning(db, integration.id, storeId);

  const rateLimitOptions = {
    maxRetries: env.GOOGLE_ADS_API_MAX_RETRIES,
    baseDelayMs: env.GOOGLE_ADS_API_RETRY_BASE_MS,
  };

  try {
    for (const chunk of chunks) {
      const [campaignRows, shoppingRows] = await Promise.all([
        fetchGoogleAdsCampaignPerformance({
          accessToken: credentials.access_token,
          developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
          customerId: selection.clientCustomerId,
          loginCustomerId: selection.managerCustomerId ?? selection.clientCustomerId,
          since: chunk.since,
          until: chunk.until,
          rateLimitOptions,
        }),
        fetchGoogleAdsShoppingProductPerformance({
          accessToken: credentials.access_token,
          developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
          customerId: selection.clientCustomerId,
          loginCustomerId: selection.managerCustomerId ?? selection.clientCustomerId,
          since: chunk.since,
          until: chunk.until,
          pageSize: env.GOOGLE_ADS_SHOPPING_PAGE_SIZE,
          rateLimitOptions,
        }),
      ]);

      await upsertCampaignMartRows(db, storeId, campaignRows);
      await upsertShoppingProductRows(db, storeId, shoppingRows);
    }

    await recalculatePoasForStore(db, storeId, {
      lookbackDays: isBackfill ? env.GOOGLE_ADS_INSIGHTS_BACKFILL_DAYS : env.GOOGLE_ADS_INSIGHTS_INCREMENTAL_DAYS,
    });

    await recordSyncSuccess(db, integration.id, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Ads insights sync failed";
    await recordSyncFailure(db, integration.id, storeId, message);
    throw error;
  }
}

export async function syncGoogleAdsInsightsForConnectedStores(db: Database): Promise<void> {
  const rows = await db
    .select({ storeId: integrations.storeId })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "google_ads"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  for (const row of rows) {
    try {
      await syncGoogleAdsInsightsForStore(db, row.storeId);
    } catch {
      // Per-store failure recorded in sync service.
    }
  }
}
