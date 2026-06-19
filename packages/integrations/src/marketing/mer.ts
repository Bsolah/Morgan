export const MER_TOOLTIP =
  "Marketing Efficiency Ratio = ad spend divided by total net revenue. It shows what share of revenue goes to ads. ROAS is the inverse focus: revenue earned per dollar of ad spend.";

export const ROAS_TOOLTIP =
  "Return on Ad Spend = attributed revenue divided by ad spend. MER uses all net revenue in the denominator; ROAS uses only ad-attributed revenue.";

export function calculateMer(adSpend: number, netRevenue: number): number | null {
  if (netRevenue <= 0 || adSpend < 0) return null;
  return adSpend / netRevenue;
}

export type MerAdSpendRow = {
  channel?: string | null;
  ad_spend?: number | string | null;
};

export function sumAdSpendForMer(
  rows: MerAdSpendRow[],
  googleAdsConnected: boolean,
): number {
  return rows.reduce((sum, row) => {
    const channel = String(row.channel ?? "meta").toLowerCase();
    const spend = Number(row.ad_spend ?? 0);
    if (!Number.isFinite(spend) || spend <= 0) return sum;

    if (channel === "meta") return sum + spend;
    if (googleAdsConnected && channel === "google_ads") return sum + spend;
    return sum;
  }, 0);
}

export type MerChannelKey = "meta" | "google_ads" | "unattributed";

export type MerChannelSpend = {
  meta: number;
  google_ads: number;
  unattributed: number;
  blended: number;
};

export type MerChannelBreakdownRow = {
  channel: MerChannelKey;
  label: string;
  ad_spend: number;
  mer: number | null;
};

export type MerDailyTrendPoint = {
  day: string;
  net_revenue: number;
  ad_spend: number;
  mer: number | null;
  meta_spend: number;
  google_spend: number;
  unattributed_spend: number;
};

export function bucketMerChannelSpend(
  rows: MerAdSpendRow[],
  googleAdsConnected: boolean,
): MerChannelSpend {
  let meta = 0;
  let google_ads = 0;
  let unattributed = 0;

  for (const row of rows) {
    const channel = String(row.channel ?? "meta").toLowerCase();
    const spend = Number(row.ad_spend ?? 0);
    if (!Number.isFinite(spend) || spend <= 0) continue;

    if (channel === "meta") {
      meta += spend;
    } else if (channel === "google_ads") {
      if (googleAdsConnected) google_ads += spend;
      else unattributed += spend;
    } else {
      unattributed += spend;
    }
  }

  return {
    meta,
    google_ads,
    unattributed,
    blended: sumAdSpendForMer(rows, googleAdsConnected),
  };
}

export function buildMerChannelBreakdown(
  spend: MerChannelSpend,
  netRevenue: number,
  googleAdsConnected: boolean,
): MerChannelBreakdownRow[] {
  const rows: MerChannelBreakdownRow[] = [
    {
      channel: "meta",
      label: "Meta",
      ad_spend: spend.meta,
      mer: calculateMer(spend.meta, netRevenue),
    },
  ];

  if (googleAdsConnected) {
    rows.push({
      channel: "google_ads",
      label: "Google",
      ad_spend: spend.google_ads,
      mer: calculateMer(spend.google_ads, netRevenue),
    });
  }

  rows.push({
    channel: "unattributed",
    label: "Unattributed",
    ad_spend: spend.unattributed,
    mer: calculateMer(spend.unattributed, netRevenue),
  });

  return rows;
}

export function buildMerDailyTrend(input: {
  adRows: Array<{ day: string; channel?: string | null; ad_spend: number | string }>;
  netRevenueByDay: Map<string, number>;
  trendDays: number;
  referenceDay: string;
  googleAdsConnected: boolean;
}): MerDailyTrendPoint[] {
  const ref = new Date(`${input.referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (input.trendDays - 1));

  const spendByDay = new Map<string, MerChannelSpend>();

  for (const row of input.adRows) {
    const dayDate = new Date(`${row.day}T00:00:00.000Z`);
    if (dayDate < start || dayDate > ref) continue;

    const spend = Number(row.ad_spend ?? 0);
    if (!Number.isFinite(spend) || spend <= 0) continue;

    const bucket = bucketMerChannelSpend(
      [{ channel: row.channel, ad_spend: spend }],
      input.googleAdsConnected,
    );
    const existing = spendByDay.get(row.day) ?? {
      meta: 0,
      google_ads: 0,
      unattributed: 0,
      blended: 0,
    };

    existing.meta += bucket.meta;
    existing.google_ads += bucket.google_ads;
    existing.unattributed += bucket.unattributed;
    existing.blended += bucket.blended;
    spendByDay.set(row.day, existing);
  }

  const points: MerDailyTrendPoint[] = [];
  for (let offset = 0; offset < input.trendDays; offset += 1) {
    const dayDate = new Date(start);
    dayDate.setUTCDate(dayDate.getUTCDate() + offset);
    const day = dayDate.toISOString().slice(0, 10);
    const spend = spendByDay.get(day) ?? { meta: 0, google_ads: 0, unattributed: 0, blended: 0 };
    const netRevenue = input.netRevenueByDay.get(day) ?? 0;
    const adSpend = spend.meta + spend.google_ads + spend.unattributed;

    points.push({
      day,
      net_revenue: netRevenue,
      ad_spend: adSpend,
      mer: calculateMer(spend.blended, netRevenue),
      meta_spend: spend.meta,
      google_spend: spend.google_ads,
      unattributed_spend: spend.unattributed,
    });
  }

  return points;
}
