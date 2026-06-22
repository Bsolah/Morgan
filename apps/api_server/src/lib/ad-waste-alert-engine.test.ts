import { describe, expect, it, beforeEach } from "vitest";
import { resetAlertsStore, getPushLog, wasPushSent } from "./alerts-store.js";
import {
  AD_WASTE_THRESHOLDS,
  buildAdWasteAlert,
  evaluateAdWasteAlerts,
  qualifiesForAdWasteAlert,
  type CampaignMetrics,
} from "./ad-waste-alert-engine.js";

const qualifyingCampaign = (): CampaignMetrics => ({
  campaign_id: "meta_retargeting_bof",
  campaign_name: "Retargeting BOF",
  poas_7d: 0.72,
  spend_7d_usd: 1800,
  daily_poas: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-06-${10 + i}`,
    poas: 0.72,
    spend_usd: 260,
  })),
  recommendation_id: "rec-001",
  suggested_action: "Pause campaign or cut daily budget by 50%",
});

describe("ad waste alert engine", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("fires when POAS <1.0 for 7 consecutive days and spend >$100", () => {
    expect(qualifiesForAdWasteAlert(qualifyingCampaign())).toBe(true);

    const alert = buildAdWasteAlert("store-1", qualifyingCampaign());
    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning");
  });

  it("does not fire when spend is at or below $100", () => {
    const metrics = {
      ...qualifyingCampaign(),
      spend_7d_usd: 100,
      daily_poas: qualifyingCampaign().daily_poas.map((day) => ({
        ...day,
        spend_usd: 14,
      })),
    };

    expect(qualifiesForAdWasteAlert(metrics)).toBe(false);
    expect(buildAdWasteAlert("store-1", metrics)).toBeNull();
  });

  it("does not fire when fewer than 7 consecutive low-POAS days", () => {
    const metrics = {
      ...qualifyingCampaign(),
      daily_poas: qualifyingCampaign().daily_poas.slice(0, 6),
    };

    expect(qualifiesForAdWasteAlert(metrics)).toBe(false);
  });

  it("includes campaign name, 7d spend, POAS, and suggested action", () => {
    const metrics = qualifyingCampaign();
    const alert = buildAdWasteAlert("store-1", metrics)!;

    expect(alert.title).toContain(metrics.campaign_name);
    expect(alert.magnitude).toContain("POAS 0.72");
    expect(alert.magnitude).toContain("1,800");
    expect(alert.body).toContain(metrics.suggested_action);
    expect(alert.top_driver).toBe(metrics.suggested_action);
    expect(alert.metric_snapshot).toMatchObject({
      campaign_name: metrics.campaign_name,
      poas_7d: 0.72,
      spend_7d_usd: 1800,
      suggested_action: metrics.suggested_action,
    });
  });

  it("links to Marketing Overview and recommendation", () => {
    const alert = buildAdWasteAlert("store-1", qualifyingCampaign())!;

    expect(alert.links.marketing_overview).toContain("/marketing");
    expect(alert.links.marketing_overview).toContain("meta_retargeting_bof");
    expect(alert.links.recommendation).toBe("/recommendations/rec-001");
  });

  it("sends push for warning+ when enabled", async () => {
    await evaluateAdWasteAlerts(null, "store-1", [qualifyingCampaign()]);
    const alerts = await evaluateAdWasteAlerts(null, "store-1", [qualifyingCampaign()]);

    expect(alerts).toHaveLength(1);
    expect(wasPushSent(alerts[0]!.id)).toBe(true);
    expect(getPushLog()).toHaveLength(1);
  });

  it("does not duplicate alerts for the same campaign", async () => {
    await evaluateAdWasteAlerts(null, "store-1", [qualifyingCampaign()]);
    await evaluateAdWasteAlerts(null, "store-1", [qualifyingCampaign()]);

    expect(getPushLog()).toHaveLength(1);
  });

  it("uses critical severity when POAS is very low", () => {
    const metrics = { ...qualifyingCampaign(), poas_7d: 0.42 };
    const alert = buildAdWasteAlert("store-1", metrics)!;
    expect(alert.severity).toBe("critical");
  });

  it("respects threshold constants", () => {
    expect(AD_WASTE_THRESHOLDS.min_consecutive_days).toBe(7);
    expect(AD_WASTE_THRESHOLDS.max_poas).toBe(1.0);
    expect(AD_WASTE_THRESHOLDS.min_spend_usd).toBe(100);
  });
});
