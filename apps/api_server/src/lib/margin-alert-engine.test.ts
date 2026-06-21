import { describe, expect, it, beforeEach } from "vitest";
import { resetAlertsStore, getPushLog, setNotificationPrefs, wasPushSent } from "./alerts-store.js";
import {
  computeMarginDropRatio,
  evaluateMarginDropAlert,
  marginDropSeverity,
  maybeSendAlertPush,
  MARGIN_THRESHOLDS,
} from "./margin-alert-engine.js";

describe("margin alert engine", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("fires warning when margin drops >10% vs 7d average", () => {
    const alert = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    });

    expect(alert).not.toBeNull();
    expect(alert!.severity).toBe("warning");
    expect(computeMarginDropRatio({
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "x",
    })).toBeGreaterThan(MARGIN_THRESHOLDS.warning);
  });

  it("fires critical when margin drops >20%", () => {
    const severity = marginDropSeverity(0.22);
    expect(severity).toBe("critical");

    const alert = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 30,
      trailing_7d_avg_pct: 40,
      top_driver: "Ad spend spike",
    });

    expect(alert!.severity).toBe("critical");
  });

  it("includes magnitude, top driver, and brief/chat links", () => {
    const alert = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    });

    expect(alert!.magnitude).toContain("below 7-day average");
    expect(alert!.top_driver).toContain("Refunds");
    expect(alert!.body).toContain(alert!.top_driver);
    expect(alert!.links.brief).toBe("/home");
    expect(alert!.links.chat).toContain("/chat");
    expect(alert!.read_at).toBeNull();
  });

  it("sends push for warning+ when enabled", () => {
    const alert = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    });

    expect(wasPushSent(alert!.id)).toBe(true);
    expect(getPushLog()).toHaveLength(1);
  });

  it("does not duplicate margin alerts on re-evaluation", () => {
    evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    });
    const second = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    });

    expect(getPushLog()).toHaveLength(1);
    expect(second!.id).toBeDefined();
  });
});

describe("maybeSendAlertPush", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("skips push when warnings disabled", () => {
    const alert = evaluateMarginDropAlert("store-1", {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds",
    })!;

    resetAlertsStore();
    setNotificationPrefs("store-1", { push_warnings: false, push_critical: true });

    const sent = maybeSendAlertPush("store-1", { ...alert, id: "new-id" });
    expect(sent).toBe(false);
  });
});
