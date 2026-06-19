import { META_GRAPH_VERSION } from "./oauth.js";

export type MetaInsightLevel = "account" | "campaign" | "adset" | "ad";

export type MetaInsightRow = {
  level: MetaInsightLevel;
  entity_id: string;
  entity_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
};

export type MetaInsightsFetchOptions = {
  adAccountId: string;
  accessToken: string;
  since: string;
  until: string;
  level: MetaInsightLevel;
  maxRetries?: number;
  baseDelayMs?: number;
};

type InsightsApiRow = {
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
};

type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
};

type PagedResponse = {
  data?: InsightsApiRow[];
  paging?: { next?: string };
  error?: GraphError;
};

type ReportRunResponse = {
  id?: string;
  async_status?: string;
  async_percent_completion?: number;
  error?: GraphError;
};

const INSIGHT_FIELDS =
  "account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values";

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readActionMetric(
  rows: Array<{ action_type?: string; value?: string }> | undefined,
  actionType: string,
): number {
  if (!rows) return 0;
  const match = rows.find((row) => row.action_type === actionType);
  return parseNumber(match?.value);
}

function normalizeAccountId(adAccountId: string): string {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(status: number, error?: GraphError): boolean {
  if (status === 429) return true;
  return error?.code === 17 || error?.code === 32 || error?.code === 613;
}

export async function fetchWithRateLimitBackoff<T>(
  request: () => Promise<Response>,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 5;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await request();
    const body = (await res.json().catch(() => ({}))) as T & { error?: GraphError };

    if (res.ok) {
      return body;
    }

    const error = (body as { error?: GraphError }).error;
    if (!isRateLimitError(res.status, error) || attempt === maxRetries) {
      throw new Error(error?.message ?? `Meta API request failed: ${res.status}`);
    }

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : baseDelayMs * 2 ** attempt;

    await sleep(delayMs);
  }

  throw new Error("Meta API request failed after retries");
}

async function fetchInsightsPage(url: string): Promise<PagedResponse> {
  return fetchWithRateLimitBackoff<PagedResponse>(() => fetch(url));
}

function mapInsightRow(level: MetaInsightLevel, row: InsightsApiRow): MetaInsightRow | null {
  if (!row.date_start) return null;

  const entityId =
    level === "account"
      ? row.account_id
      : level === "campaign"
        ? row.campaign_id
        : level === "adset"
          ? row.adset_id
          : row.ad_id;

  if (!entityId) return null;

  const entityName =
    level === "account"
      ? row.account_name
      : level === "campaign"
        ? row.campaign_name
        : level === "adset"
          ? row.adset_name
          : row.ad_name;

  return {
    level,
    entity_id: entityId,
    entity_name: entityName ?? entityId,
    campaign_id: row.campaign_id ?? null,
    campaign_name: row.campaign_name ?? null,
    adset_id: row.adset_id ?? null,
    adset_name: row.adset_name ?? null,
    ad_id: row.ad_id ?? null,
    ad_name: row.ad_name ?? null,
    day: row.date_start,
    spend: parseNumber(row.spend),
    impressions: parseNumber(row.impressions),
    clicks: parseNumber(row.clicks),
    purchases: readActionMetric(row.actions, "purchase"),
    purchase_value: readActionMetric(row.action_values, "purchase"),
  };
}

export async function fetchMetaInsightsForLevel(
  opts: MetaInsightsFetchOptions,
): Promise<MetaInsightRow[]> {
  const accountId = normalizeAccountId(opts.adAccountId);
  const params = new URLSearchParams({
    level: opts.level,
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: opts.since, until: opts.until }),
    time_increment: "1",
    access_token: opts.accessToken,
    limit: "500",
  });

  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/insights?${params}`;

  while (nextUrl) {
    const page = await fetchInsightsPage(nextUrl);
    for (const row of page.data ?? []) {
      const mapped = mapInsightRow(opts.level, row);
      if (mapped) rows.push(mapped);
    }
    nextUrl = page.paging?.next ?? null;
  }

  return rows;
}

export async function fetchMetaInsightsAsync(
  opts: MetaInsightsFetchOptions,
): Promise<MetaInsightRow[]> {
  const accountId = normalizeAccountId(opts.adAccountId);
  const params = new URLSearchParams({
    level: opts.level,
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since: opts.since, until: opts.until }),
    time_increment: "1",
    access_token: opts.accessToken,
    async: "true",
  });

  const start = await fetchWithRateLimitBackoff<ReportRunResponse>(() =>
    fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${accountId}/insights?${params}`, {
      method: "POST",
    }),
  );

  if (!start.id) {
    throw new Error("Meta async insights job did not start");
  }

  const reportRunId = start.id;
  let status = start.async_status ?? "Job Running";

  for (let attempt = 0; attempt < 120 && status !== "Job Completed"; attempt++) {
    if (status === "Job Failed") {
      throw new Error("Meta async insights job failed");
    }

    await sleep(attempt < 5 ? 1000 : 3000);

    const poll = await fetchWithRateLimitBackoff<ReportRunResponse>(() =>
      fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${reportRunId}?access_token=${encodeURIComponent(opts.accessToken)}`,
      ),
    );

    status = poll.async_status ?? status;
  }

  if (status !== "Job Completed") {
    throw new Error("Meta async insights job timed out");
  }

  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${reportRunId}/insights?access_token=${encodeURIComponent(opts.accessToken)}&limit=500`;

  while (nextUrl) {
    const page = await fetchInsightsPage(nextUrl);
    for (const row of page.data ?? []) {
      const mapped = mapInsightRow(opts.level, row);
      if (mapped) rows.push(mapped);
    }
    nextUrl = page.paging?.next ?? null;
  }

  return rows;
}

export type MetaInsightsBatchRequest = {
  level: MetaInsightLevel;
  since: string;
  until: string;
  useAsync?: boolean;
};

export async function fetchMetaInsightsBatch(opts: {
  adAccountId: string;
  accessToken: string;
  requests: MetaInsightsBatchRequest[];
  maxRetries?: number;
  baseDelayMs?: number;
}): Promise<Map<MetaInsightLevel, MetaInsightRow[]>> {
  const results = new Map<MetaInsightLevel, MetaInsightRow[]>();

  for (const request of opts.requests) {
    const fetcher = request.useAsync ? fetchMetaInsightsAsync : fetchMetaInsightsForLevel;
    const rows = await fetcher({
      adAccountId: opts.adAccountId,
      accessToken: opts.accessToken,
      since: request.since,
      until: request.until,
      level: request.level,
      maxRetries: opts.maxRetries,
      baseDelayMs: opts.baseDelayMs,
    });
    results.set(request.level, rows);
  }

  return results;
}

export function chunkDateRange(
  since: string,
  until: string,
  chunkDays: number,
): Array<{ since: string; until: string }> {
  const chunks: Array<{ since: string; until: string }> = [];
  let cursor = new Date(`${since}T00:00:00.000Z`);
  const end = new Date(`${until}T00:00:00.000Z`);

  while (cursor <= end) {
    const chunkStart = cursor.toISOString().slice(0, 10);
    const chunkEndDate = new Date(cursor);
    chunkEndDate.setUTCDate(chunkEndDate.getUTCDate() + chunkDays - 1);
    if (chunkEndDate > end) chunkEndDate.setTime(end.getTime());
    const chunkEnd = chunkEndDate.toISOString().slice(0, 10);
    chunks.push({ since: chunkStart, until: chunkEnd });
    cursor = new Date(chunkEndDate);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}

export const META_INSIGHT_LEVELS: MetaInsightLevel[] = ["account", "campaign", "adset", "ad"];

/** @deprecated Use fetchMetaInsightsForLevel with level campaign */
export type MetaCampaignInsightRow = MetaInsightRow & { campaign_id: string; campaign_name: string };

export async function fetchMetaCampaignInsights(opts: {
  adAccountId: string;
  accessToken: string;
  since: string;
  until: string;
}): Promise<MetaCampaignInsightRow[]> {
  const rows = await fetchMetaInsightsForLevel({
    ...opts,
    level: "campaign",
  });

  return rows.map((row) => ({
    ...row,
    campaign_id: row.campaign_id ?? row.entity_id,
    campaign_name: row.campaign_name ?? row.entity_name,
  }));
}
