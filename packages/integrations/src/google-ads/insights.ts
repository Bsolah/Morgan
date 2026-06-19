import { googleAdsSearchPaginated, googleAdsSearchStream } from "./api.js";

export type GoogleAdsCampaignDailyRow = {
  day: string;
  campaign_id: string;
  campaign_name: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
};

export type GoogleAdsShoppingProductDailyRow = {
  day: string;
  campaign_id: string;
  campaign_name: string;
  product_item_id: string;
  product_title: string;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
};
function readNestedNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function readNestedString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export function parseGoogleAdsCampaignDailyRows(
  rows: Array<Record<string, unknown>>,
): GoogleAdsCampaignDailyRow[] {
  const output: GoogleAdsCampaignDailyRow[] = [];

  for (const row of rows) {
    const campaign = (row.campaign ?? {}) as Record<string, unknown>;
    const metrics = (row.metrics ?? {}) as Record<string, unknown>;
    const segments = (row.segments ?? {}) as Record<string, unknown>;

    const day = readNestedString(segments, "date");
    const campaignId = readNestedString(campaign, "id");
    if (!day || !campaignId) continue;

    const costMicros = readNestedNumber(metrics, "costMicros", "cost_micros");
    output.push({
      day,
      campaign_id: campaignId,
      campaign_name:
        readNestedString(campaign, "name") ?? `Campaign ${campaignId}`,
      cost: costMicros / 1_000_000,
      impressions: Math.round(readNestedNumber(metrics, "impressions")),
      clicks: Math.round(readNestedNumber(metrics, "clicks")),
      conversions: readNestedNumber(metrics, "conversions"),
      conversion_value: readNestedNumber(metrics, "conversionsValue", "conversions_value"),
    });
  }

  return output;
}

export function parseGoogleAdsShoppingProductDailyRows(
  rows: Array<Record<string, unknown>>,
): GoogleAdsShoppingProductDailyRow[] {
  const output: GoogleAdsShoppingProductDailyRow[] = [];

  for (const row of rows) {
    const campaign = (row.campaign ?? {}) as Record<string, unknown>;
    const metrics = (row.metrics ?? {}) as Record<string, unknown>;
    const segments = (row.segments ?? {}) as Record<string, unknown>;

    const day = readNestedString(segments, "date");
    const campaignId = readNestedString(campaign, "id");
    const productItemId =
      readNestedString(segments, "productItemId", "product_item_id") ?? "unknown";
    if (!day || !campaignId) continue;

    const costMicros = readNestedNumber(metrics, "costMicros", "cost_micros");
    output.push({
      day,
      campaign_id: campaignId,
      campaign_name: readNestedString(campaign, "name") ?? `Campaign ${campaignId}`,
      product_item_id: productItemId,
      product_title:
        readNestedString(segments, "productTitle", "product_title") ?? productItemId,
      cost: costMicros / 1_000_000,
      impressions: Math.round(readNestedNumber(metrics, "impressions")),
      clicks: Math.round(readNestedNumber(metrics, "clicks")),
      conversions: readNestedNumber(metrics, "conversions"),
      conversion_value: readNestedNumber(metrics, "conversionsValue", "conversions_value"),
    });
  }

  return output;
}

export async function fetchGoogleAdsCampaignPerformance(opts: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  since: string;
  until: string;
  rateLimitOptions?: { maxRetries?: number; baseDelayMs?: number };
}): Promise<GoogleAdsCampaignDailyRow[]> {
  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${opts.since}' AND '${opts.until}'
      AND campaign.status != 'REMOVED'
  `.trim();

  const rows = await googleAdsSearchStream({
    accessToken: opts.accessToken,
    developerToken: opts.developerToken,
    customerId: opts.customerId,
    loginCustomerId: opts.loginCustomerId,
    query,
    rateLimitOptions: opts.rateLimitOptions,
  });

  return parseGoogleAdsCampaignDailyRows(rows);
}

export async function fetchGoogleAdsShoppingProductPerformance(opts: {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  since: string;
  until: string;
  pageSize?: number;
  rateLimitOptions?: { maxRetries?: number; baseDelayMs?: number };
}): Promise<GoogleAdsShoppingProductDailyRow[]> {
  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      segments.product_item_id,
      segments.product_title,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM shopping_performance_view
    WHERE segments.date BETWEEN '${opts.since}' AND '${opts.until}'
      AND campaign.advertising_channel_type = 'SHOPPING'
      AND campaign.status != 'REMOVED'
  `.trim();

  const rows = await googleAdsSearchPaginated({
    accessToken: opts.accessToken,
    developerToken: opts.developerToken,
    customerId: opts.customerId,
    loginCustomerId: opts.loginCustomerId,
    query,
    pageSize: opts.pageSize,
    rateLimitOptions: opts.rateLimitOptions,
  });

  return parseGoogleAdsShoppingProductDailyRows(rows);
}

export function chunkDateRange(
  since: string,
  until: string,
  chunkDays: number,
): Array<{ since: string; until: string }> {
  const chunks: Array<{ since: string; until: string }> = [];
  let cursor = since;

  while (cursor <= until) {
    const end = addDays(cursor, chunkDays - 1);
    chunks.push({
      since: cursor,
      until: end > until ? until : end,
    });
    cursor = addDays(chunks[chunks.length - 1]!.until, 1);
  }

  return chunks;
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
