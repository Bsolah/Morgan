import type { Database } from "@morgan/db";
import type { AlertRecord } from "./alerts-data.js";
import { newAlertId } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";
import { clearAlertByDedupeKey, findAlertByDedupeKey, listAlerts, saveAlert } from "./alerts-repository.js";

export type CampaignDailyPoas = {
  date: string;
  poas: number;
  spend_usd: number;
};

export type CampaignMetrics = {
  campaign_id: string;
  campaign_name: string;
  poas_7d: number;
  spend_7d_usd: number;
  daily_poas: CampaignDailyPoas[];
  recommendation_id: string;
  suggested_action: string;
};

export const AD_WASTE_THRESHOLDS = {
  min_consecutive_days: 7,
  max_poas: 1.0,
  min_spend_usd: 100,
} as const;

/** True when POAS stayed below target for 7+ consecutive days with meaningful spend. */
export function qualifiesForAdWasteAlert(metrics: CampaignMetrics): boolean {
  if (metrics.spend_7d_usd <= AD_WASTE_THRESHOLDS.min_spend_usd) return false;
  if (metrics.poas_7d >= AD_WASTE_THRESHOLDS.max_poas) return false;

  const recent = metrics.daily_poas.slice(-AD_WASTE_THRESHOLDS.min_consecutive_days);
  if (recent.length < AD_WASTE_THRESHOLDS.min_consecutive_days) return false;

  return recent.every(
    (day) => day.poas < AD_WASTE_THRESHOLDS.max_poas && day.spend_usd > 0,
  );
}

export function formatAdWasteMagnitude(metrics: CampaignMetrics): string {
  return `POAS ${metrics.poas_7d.toFixed(2)} · 7d spend $${Math.round(metrics.spend_7d_usd).toLocaleString("en-US")}`;
}

export function buildAdWasteAlert(
  storeId: string,
  metrics: CampaignMetrics,
  now: Date = new Date(),
): AlertRecord | null {
  if (!qualifiesForAdWasteAlert(metrics)) return null;

  const magnitude = formatAdWasteMagnitude(metrics);

  return {
    id: newAlertId(),
    store_id: storeId,
    severity: metrics.poas_7d < 0.5 ? "critical" : "warning",
    type: "ad_waste",
    title: `${metrics.campaign_name} burning cash`,
    body: `${metrics.campaign_name} has POAS ${metrics.poas_7d.toFixed(2)} over the last 7 days ($${Math.round(metrics.spend_7d_usd).toLocaleString("en-US")} spend). ${metrics.suggested_action}.`,
    magnitude,
    top_driver: metrics.suggested_action,
    links: {
      marketing_overview: `/marketing?campaign=${encodeURIComponent(metrics.campaign_id)}`,
      recommendation: `/recommendations/${metrics.recommendation_id}`,
    },
    metric_snapshot: {
      campaign_id: metrics.campaign_id,
      campaign_name: metrics.campaign_name,
      poas_7d: metrics.poas_7d,
      spend_7d_usd: metrics.spend_7d_usd,
      consecutive_days_below_target: AD_WASTE_THRESHOLDS.min_consecutive_days,
      recommendation_id: metrics.recommendation_id,
      suggested_action: metrics.suggested_action,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

function buildDemoDailyPoas(poas: number, spendPerDay: number): CampaignDailyPoas[] {
  const days: CampaignDailyPoas[] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - i);
    days.push({
      date: date.toISOString().slice(0, 10),
      poas,
      spend_usd: spendPerDay,
    });
  }

  return days;
}

/** Demo campaigns for stub stores. */
export function sampleCampaignMetrics(storeId: string): CampaignMetrics[] {
  if (storeId.endsWith("0002") || storeId === "dev-local-store") {
    return [
      {
        campaign_id: "meta_retargeting_bof",
        campaign_name: "Retargeting BOF",
        poas_7d: 0.72,
        spend_7d_usd: 1800,
        daily_poas: buildDemoDailyPoas(0.72, 257),
        recommendation_id: "rec-001",
        suggested_action: "Pause campaign or cut daily budget by 50%",
      },
    ];
  }

  return [];
}

function adWasteDedupeKey(campaignId: string): string {
  return `ad_waste:${campaignId}`;
}

export async function evaluateAdWasteAlerts(
  db: Database | null,
  storeId: string,
  campaigns: CampaignMetrics[] = sampleCampaignMetrics(storeId),
  now: Date = new Date(),
): Promise<AlertRecord[]> {
  const created: AlertRecord[] = [];
  const activeKeys = new Set<string>();

  for (const metrics of campaigns) {
    const dedupeKey = adWasteDedupeKey(metrics.campaign_id);
    const alert = buildAdWasteAlert(storeId, metrics, now);

    if (!alert) {
      await clearAlertByDedupeKey(db, storeId, dedupeKey);
      continue;
    }

    activeKeys.add(dedupeKey);
    const existing = await findAlertByDedupeKey(db, storeId, dedupeKey);
    if (existing) {
      alert.id = existing.id;
      alert.read_at = existing.read_at;
      alert.created_at = existing.created_at;
    }

    const saved = await saveAlert(db, alert, dedupeKey);
    await maybeSendAlertPush(db, storeId, saved, now);
    created.push(saved);
  }

  const existingAlerts = await listAlerts(db, storeId);
  for (const alert of existingAlerts) {
    if (alert.type !== "ad_waste") continue;
    const campaignId = String(alert.metric_snapshot.campaign_id ?? "");
    const dedupeKey = adWasteDedupeKey(campaignId);
    if (!activeKeys.has(dedupeKey)) {
      await clearAlertByDedupeKey(db, storeId, dedupeKey);
    }
  }

  return created;
}
