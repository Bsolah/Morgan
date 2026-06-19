import { and, eq, gte, lte } from "drizzle-orm";
import {
  integrations,
  martAdPerformanceDaily,
  merchantFinanceConfig,
  metaAdAccounts,
  profitLeaks,
  type Database,
} from "@morgan/db";
import {
  aggregateCampaignWindow,
  buildCampaignDailyTrend,
  buildCampaignPoasInputs,
  calculatePoas,
  calculateRoas,
  computeOrderLineEconomics,
  extractGclidFromOrderPayload,
  extractOrderDay,
  extractUtmFromOrderPayload,
  financeConfigFromMerchantRow,
  hasConsecutiveLowPoasDays,
  MER_TOOLTIP,
  parseOrderRevenue,
  parseShopifyOrderEconomicsInput,
  resolveAttributionChannel,
  ROAS_TOOLTIP,
  summarizeChannelPoas,
  type CampaignDailyMetrics,
  type CampaignDailyTrendPoint,
} from "@morgan/integrations";
import { createMartAdPerformanceWriter } from "@morgan/warehouse";
import { env } from "../config.js";
import { getAttributionRules } from "./attribution-rules-service.js";
import { getQuickBooksCogsRateForStore } from "./quickbooks-account-mapping-service.js";
import { getXeroCogsRateForStore } from "./xero-account-mapping-service.js";
import { loadUnitCostBySku } from "./product-catalog-reader.js";
import { parseOrderPayload, readOrderFactsForStore } from "./order-fact-reader.js";

const AD_WASTE_MIN_SPEND_USD = 100;
const AD_WASTE_CONSECUTIVE_DAYS = 7;
const AD_WASTE_POAS_THRESHOLD = 1;

function normalizeCampaignKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveCampaignId(
  utmCampaign: string | null | undefined,
  campaigns: Array<{ id: string; name: string }>,
): string | null {
  if (!utmCampaign) return null;
  const utmKey = normalizeCampaignKey(utmCampaign);

  for (const campaign of campaigns) {
    const nameKey = normalizeCampaignKey(campaign.name);
    const idKey = normalizeCampaignKey(campaign.id);
    if (utmKey === nameKey || utmKey === idKey) return campaign.id;
    if (nameKey.includes(utmKey) || utmKey.includes(nameKey)) return campaign.id;
  }

  return null;
}

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type MarketingOverview = {
  meta_connected: boolean;
  google_ads_connected: boolean;
  ads_connected: boolean;
  window_days: number;
  reference_day: string;
  summary: {
    ad_spend: number;
    attributed_revenue: number;
    attributed_contribution_margin: number;
    poas: number | null;
    roas: number | null;
  };
  channels: Array<{
    channel: string;
    ad_spend: number;
    attributed_revenue: number;
    attributed_contribution_margin: number;
    poas: number | null;
    campaign_count: number;
  }>;
  campaigns: Array<{
    channel: string;
    campaign_id: string;
    campaign_name: string;
    ad_spend: number;
    attributed_revenue: number;
    attributed_contribution_margin: number;
    poas: number | null;
    roas: number | null;
    ad_waste: boolean;
  }>;
  tooltips: {
    poas: string;
    roas: string;
    mer: string;
  };
};

export type CampaignDetailView = {
  channel: string;
  campaign_id: string;
  campaign_name: string;
  window_days: number;
  reference_day: string;
  ad_spend: number;
  attributed_revenue: number;
  attributed_contribution_margin: number;
  poas: number | null;
  roas: number | null;
  ad_waste: boolean;
  recommendation_id: string | null;
  trend_days: number;
  trend: CampaignDailyTrendPoint[];
};

export async function isMetaConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  return integration?.status === "connected" || integration?.status === "syncing";
}

export async function isGoogleAdsConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  return integration?.status === "connected" || integration?.status === "syncing";
}

function campaignScopeKey(channel: string, campaignId: string): string {
  return `${channel}|${campaignId}`;
}

function attributionDayKey(channel: string, campaignId: string, day: string): string {
  return `${channel}|${campaignId}|${day}`;
}

export async function recalculatePoasForStore(
  db: Database,
  storeId: string,
  options?: { lookbackDays?: number; referenceDay?: string },
): Promise<void> {
  const lookbackDays = options?.lookbackDays ?? 90;
  const referenceDay = options?.referenceDay ?? new Date().toISOString().slice(0, 10);
  const sinceDay = addDays(referenceDay, -(lookbackDays - 1));

  const [financeConfig, attributionRules, spendRows] = await Promise.all([
    db
      .select()
      .from(merchantFinanceConfig)
      .where(eq(merchantFinanceConfig.storeId, storeId))
      .limit(1)
      .then((rows) => rows[0]),
    getAttributionRules(db, storeId),
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
  ]);

  const cogsMethod = financeConfig?.cogsMethod ?? "shopify";
  const unitCostBySku =
    cogsMethod === "shopify" || cogsMethod === "qbo" || cogsMethod === "xero"
      ? await loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId)
      : new Map<string, number>();

  let shopifyRevenueMtd = 0;
  if (cogsMethod === "qbo" || cogsMethod === "xero") {
    const monthStart = `${referenceDay.slice(0, 7)}-01`;
    const mtdOrders = await readOrderFactsForStore(
      env.BRONZE_STORAGE_PATH,
      storeId,
      monthStart,
      referenceDay,
    );
    for (const row of mtdOrders) {
      shopifyRevenueMtd += parseOrderRevenue(parseOrderPayload(row));
    }
  }

  const qboCogsRate =
    cogsMethod === "qbo"
      ? await getQuickBooksCogsRateForStore(db, storeId, shopifyRevenueMtd)
      : cogsMethod === "xero"
        ? await getXeroCogsRateForStore(db, storeId, shopifyRevenueMtd)
        : null;

  const economicsConfig = financeConfigFromMerchantRow({
    cogsMethod: financeConfig?.cogsMethod ?? "shopify",
    manualCogsPct: financeConfig?.manualCogsPct,
    paymentFeePct: financeConfig?.paymentFeePct,
    shippingCostPct: financeConfig?.shippingCostPct,
  });
  economicsConfig.accountingCogsRate = qboCogsRate;

  const campaigns = new Map<string, { id: string; name: string; channel: string }>();
  for (const row of spendRows) {
    campaigns.set(campaignScopeKey(row.channel, row.campaignId), {
      id: row.campaignId,
      name: row.campaignName,
      channel: row.channel,
    });
  }

  const orderRows = await readOrderFactsForStore(env.BRONZE_STORAGE_PATH, storeId, sinceDay, referenceDay);
  const attributedNetRevenueByCampaignDay = new Map<string, number>();

  for (const row of orderRows) {
    const payload = parseOrderPayload(row);
    const day = extractOrderDay(payload);
    if (!day) continue;

    const utm = extractUtmFromOrderPayload(payload);
    const gclid = extractGclidFromOrderPayload(payload);
    const channel = resolveAttributionChannel(utm, gclid, attributionRules);
    if (!channel) continue;

    const channelCampaigns = Array.from(campaigns.values()).filter((campaign) => campaign.channel === channel);
    const campaignId =
      resolveCampaignId(utm.utm_campaign, channelCampaigns) ??
      (utm.utm_campaign ? `utm:${normalizeCampaignKey(utm.utm_campaign)}` : "unattributed");

    const orderInput = parseShopifyOrderEconomicsInput(payload, unitCostBySku);
    const netRevenue = orderInput.lines.reduce((sum, line) => {
      const gross = line.unitPrice * line.quantity;
      return sum + Math.max(0, gross - line.lineDiscount);
    }, 0) - (orderInput.refundAmount ?? 0);

    const key = attributionDayKey(channel, campaignId, day);
    attributedNetRevenueByCampaignDay.set(
      key,
      (attributedNetRevenueByCampaignDay.get(key) ?? 0) + Math.max(0, netRevenue),
    );
  }

  const attributedByCampaignDay = new Map<string, { revenue: number; margin: number }>();

  for (const row of orderRows) {
    const payload = parseOrderPayload(row);
    const day = extractOrderDay(payload);
    if (!day) continue;

    const utm = extractUtmFromOrderPayload(payload);
    const gclid = extractGclidFromOrderPayload(payload);
    const channel = resolveAttributionChannel(utm, gclid, attributionRules);
    if (!channel) continue;

    const channelCampaigns = Array.from(campaigns.values()).filter((campaign) => campaign.channel === channel);
    const campaignId =
      resolveCampaignId(utm.utm_campaign, channelCampaigns) ??
      (utm.utm_campaign ? `utm:${normalizeCampaignKey(utm.utm_campaign)}` : "unattributed");

    const revenue = parseOrderRevenue(payload);
    const key = attributionDayKey(channel, campaignId, day);
    const spendRow = spendRows.find(
      (entry) =>
        entry.channel === channel &&
        entry.campaignId === campaignId &&
        entry.performanceDate === day,
    );
    const orderInput = parseShopifyOrderEconomicsInput(payload, unitCostBySku);
    const margin = computeOrderLineEconomics(orderInput, economicsConfig, {
      campaignSpend: spendRow ? Number(spendRow.adSpend) : 0,
      totalAttributedNetRevenue: attributedNetRevenueByCampaignDay.get(key) ?? revenue,
    }).contribution_margin;
    const existing = attributedByCampaignDay.get(key) ?? { revenue: 0, margin: 0 };
    existing.revenue += revenue;
    existing.margin += margin;
    attributedByCampaignDay.set(key, existing);

    const scopeKey = campaignScopeKey(channel, campaignId);
    if (!campaigns.has(scopeKey)) {
      campaigns.set(scopeKey, {
        id: campaignId,
        name: utm.utm_campaign ?? campaignId,
        channel,
      });
    }
  }

  const writer = await createMartAdPerformanceWriter({
    clickhouseUrl: env.CLICKHOUSE_URL,
    fallbackPath: env.CLICKHOUSE_STORAGE_PATH,
    table: env.CLICKHOUSE_AD_PERFORMANCE_TABLE,
  });

  const dailyMetrics: Array<CampaignDailyMetrics & { channel: string }> = [];

  for (const row of spendRows) {
    const key = attributionDayKey(row.channel, row.campaignId, row.performanceDate);
    const attributed = attributedByCampaignDay.get(key) ?? { revenue: 0, margin: 0 };
    const adSpend = Number(row.adSpend);
    const poas = calculatePoas(attributed.margin, adSpend);
    const roas = calculateRoas(attributed.revenue, adSpend);

    await db
      .update(martAdPerformanceDaily)
      .set({
        attributedRevenue: formatMoney(attributed.revenue),
        attributedContributionMargin: formatMoney(attributed.margin),
        roas: roas != null ? formatMoney(roas) : null,
        poas: poas != null ? formatMoney(poas) : null,
        updatedAt: new Date(),
      })
      .where(eq(martAdPerformanceDaily.id, row.id));

    await writer.upsert({
      store_id: storeId,
      channel: row.channel,
      campaign_id: row.campaignId,
      campaign_name: row.campaignName,
      day: row.performanceDate,
      ad_spend: formatMoney(adSpend),
      attributed_revenue: formatMoney(attributed.revenue),
      attributed_contribution_margin: formatMoney(attributed.margin),
      impressions: row.impressions,
      clicks: row.clicks,
      purchases: row.purchases,
      purchase_value: formatMoney(Number(row.purchaseValue ?? 0)),
      roas: roas != null ? formatMoney(roas) : null,
      poas: poas != null ? formatMoney(poas) : null,
      ingested_at: new Date().toISOString(),
    });

    dailyMetrics.push({
      channel: row.channel,
      campaign_id: row.campaignId,
      campaign_name: row.campaignName,
      day: row.performanceDate,
      ad_spend: adSpend,
      attributed_revenue: attributed.revenue,
      attributed_contribution_margin: attributed.margin,
    });
  }

  await detectAdWasteLeaks(db, storeId, dailyMetrics);
  await writer.close?.();
}

async function detectAdWasteLeaks(
  db: Database,
  storeId: string,
  dailyMetrics: Array<CampaignDailyMetrics & { channel: string }>,
) {
  const campaignKeys = [
    ...new Set(dailyMetrics.map((row) => campaignScopeKey(row.channel, row.campaign_id))),
  ];

  for (const campaignKey of campaignKeys) {
    const [channel, ...campaignIdParts] = campaignKey.split("|");
    const campaignId = campaignIdParts.join("|");
    const campaignRows = dailyMetrics.filter(
      (row) => row.channel === channel && row.campaign_id === campaignId,
    );
    const window = aggregateCampaignWindow(campaignRows, AD_WASTE_CONSECUTIVE_DAYS, campaignRows.at(-1)?.day ?? "");
    const metrics = window.get(campaignId);
    const isWaste =
      metrics != null &&
      metrics.ad_spend >= AD_WASTE_MIN_SPEND_USD &&
      hasConsecutiveLowPoasDays(
        campaignRows,
        campaignId,
        AD_WASTE_CONSECUTIVE_DAYS,
        AD_WASTE_POAS_THRESHOLD,
      );

    const dedupeKey = `ad_waste:${channel}:${campaignId}`;
    const campaignName = campaignRows[0]?.campaign_name ?? campaignId;

    if (isWaste && metrics) {
      await db
        .insert(profitLeaks)
        .values({
          storeId,
          leakType: "ad_waste",
          externalKey: campaignId,
          status: "active",
          severity: "warning",
          amountAtRiskUsd: formatMoney(metrics.ad_spend),
          evidence: [
            {
              channel,
              campaign: campaignName,
              campaign_id: campaignId,
              poas: metrics.poas,
              spend_7d: metrics.ad_spend,
            },
          ],
          dedupeKey,
        })
        .onConflictDoUpdate({
          target: [profitLeaks.storeId, profitLeaks.dedupeKey],
          set: {
            status: "active",
            amountAtRiskUsd: formatMoney(metrics.ad_spend),
            evidence: [
              {
                channel,
                campaign: campaignName,
                campaign_id: campaignId,
                poas: metrics.poas,
                spend_7d: metrics.ad_spend,
              },
            ],
            resolvedAt: null,
            updatedAt: new Date(),
          },
        });
      continue;
    }

    await db
      .update(profitLeaks)
      .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.dedupeKey, dedupeKey)));
  }
}

export async function getMarketingOverview(
  db: Database,
  storeId: string,
  windowDays = 7,
): Promise<MarketingOverview> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const sinceDay = addDays(referenceDay, -(windowDays - 1));
  const [metaConnected, googleAdsConnected] = await Promise.all([
    isMetaConnected(db, storeId),
    isGoogleAdsConnected(db, storeId),
  ]);

  const rows = await db
    .select()
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        gte(martAdPerformanceDaily.performanceDate, sinceDay),
        lte(martAdPerformanceDaily.performanceDate, referenceDay),
      ),
    );

  const dailyRows = rows.map((row) => ({
    channel: row.channel,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    day: row.performanceDate,
    ad_spend: Number(row.adSpend),
    attributed_revenue: Number(row.attributedRevenue),
    attributed_contribution_margin: Number(row.attributedContributionMargin),
  }));

  const campaignInputs = buildCampaignPoasInputs(dailyRows, windowDays, referenceDay);
  const channels = summarizeChannelPoas(campaignInputs);
  const activeLeaks = await db
    .select({ dedupeKey: profitLeaks.dedupeKey })
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.leakType, "ad_waste"), eq(profitLeaks.status, "active")));

  const wasteCampaignKeys = new Set(activeLeaks.map((leak) => leak.dedupeKey.replace("ad_waste:", "")));

  const campaigns = campaignInputs
    .map((campaign) => ({
      channel: campaign.channel,
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      ad_spend: campaign.ad_spend,
      attributed_revenue: campaign.attributed_revenue,
      attributed_contribution_margin: campaign.attributed_contribution_margin,
      poas: campaign.poas,
      roas: calculateRoas(campaign.attributed_revenue, campaign.ad_spend),
      ad_waste: wasteCampaignKeys.has(`${campaign.channel}:${campaign.campaign_id}`),
    }))
    .sort((a, b) => (b.poas ?? -1) - (a.poas ?? -1));

  const summarySpend = campaigns.reduce((sum, row) => sum + row.ad_spend, 0);
  const summaryRevenue = campaigns.reduce((sum, row) => sum + row.attributed_revenue, 0);
  const summaryMargin = campaigns.reduce((sum, row) => sum + row.attributed_contribution_margin, 0);

  return {
    meta_connected: metaConnected,
    google_ads_connected: googleAdsConnected,
    ads_connected: metaConnected || googleAdsConnected,
    window_days: windowDays,
    reference_day: referenceDay,
    summary: {
      ad_spend: summarySpend,
      attributed_revenue: summaryRevenue,
      attributed_contribution_margin: summaryMargin,
      poas: calculatePoas(summaryMargin, summarySpend),
      roas: calculateRoas(summaryRevenue, summarySpend),
    },
    channels,
    campaigns,
    tooltips: {
      poas: "Profit on Ad Spend = attributed contribution margin divided by ad spend.",
      roas: ROAS_TOOLTIP,
      mer: MER_TOOLTIP,
    },
  };
}

export async function getCampaignDetail(
  db: Database,
  storeId: string,
  channel: string,
  campaignId: string,
  windowDays = 7,
  trendDays = 30,
): Promise<CampaignDetailView | null> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const sinceDay = addDays(referenceDay, -(Math.max(windowDays, trendDays) - 1));

  const rows = await db
    .select()
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        eq(martAdPerformanceDaily.channel, channel),
        eq(martAdPerformanceDaily.campaignId, campaignId),
        gte(martAdPerformanceDaily.performanceDate, sinceDay),
        lte(martAdPerformanceDaily.performanceDate, referenceDay),
      ),
    );

  if (rows.length === 0) return null;

  const dailyRows = rows.map((row) => ({
    channel: row.channel,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    day: row.performanceDate,
    ad_spend: Number(row.adSpend),
    attributed_revenue: Number(row.attributedRevenue),
    attributed_contribution_margin: Number(row.attributedContributionMargin),
  }));

  const campaignInputs = buildCampaignPoasInputs(dailyRows, windowDays, referenceDay);
  const summary = campaignInputs.find(
    (campaign) => campaign.channel === channel && campaign.campaign_id === campaignId,
  );

  const dedupeKey = `ad_waste:${channel}:${campaignId}`;
  const [leak] = await db
    .select({ id: profitLeaks.id })
    .from(profitLeaks)
    .where(
      and(
        eq(profitLeaks.storeId, storeId),
        eq(profitLeaks.dedupeKey, dedupeKey),
        eq(profitLeaks.leakType, "ad_waste"),
        eq(profitLeaks.status, "active"),
      ),
    )
    .limit(1);

  const trendRows = dailyRows.map((row) => ({
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    day: row.day,
    ad_spend: row.ad_spend,
    attributed_revenue: row.attributed_revenue,
    attributed_contribution_margin: row.attributed_contribution_margin,
  }));

  const campaignName = summary?.campaign_name ?? rows[0]?.campaignName ?? campaignId;
  const adSpend = summary?.ad_spend ?? 0;
  const attributedRevenue = summary?.attributed_revenue ?? 0;
  const attributedMargin = summary?.attributed_contribution_margin ?? 0;

  return {
    channel,
    campaign_id: campaignId,
    campaign_name: campaignName,
    window_days: windowDays,
    reference_day: referenceDay,
    ad_spend: adSpend,
    attributed_revenue: attributedRevenue,
    attributed_contribution_margin: attributedMargin,
    poas: summary?.poas ?? calculatePoas(attributedMargin, adSpend),
    roas: calculateRoas(attributedRevenue, adSpend),
    ad_waste: leak != null,
    recommendation_id: leak?.id ?? null,
    trend_days: trendDays,
    trend: buildCampaignDailyTrend(trendRows, trendDays, referenceDay),
  };
}

export async function getSelectedMetaAdAccountId(db: Database, storeId: string): Promise<string | null> {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  if (!integration) return null;

  const [account] = await db
    .select({ externalId: metaAdAccounts.externalId })
    .from(metaAdAccounts)
    .where(and(eq(metaAdAccounts.integrationId, integration.id), eq(metaAdAccounts.isSelected, true)))
    .limit(1);

  return account?.externalId ?? null;
}
