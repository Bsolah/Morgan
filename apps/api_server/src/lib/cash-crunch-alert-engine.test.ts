import { describe, expect, it, beforeEach } from "vitest";
import { resetAlertsStore, getPushLog, setNotificationPrefs, wasPushSent } from "./alerts-store.js";
import {
  CASH_CRUNCH_THRESHOLDS,
  buildCashCrunchAlert,
  cashCrunchSeverity,
  evaluateCashCrunchAlert,
  qualifiesForCashCrunchAlert,
  type CashMetrics,
} from "./cash-crunch-alert-engine.js";

const warningMetrics = (): CashMetrics => ({
  cash_balance_usd: 18400,
  daily_burn_usd: 820,
  runway_days: 22,
  suggested_actions: ["Review upcoming payables", "Delay non-essential spend"],
});

const criticalMetrics = (): CashMetrics => ({
  cash_balance_usd: 4100,
  daily_burn_usd: 820,
  runway_days: 5,
  suggested_actions: [
    "Pause discretionary ad spend",
    "Review payables due this week",
    "Ask Morgan for cash levers",
  ],
});

describe("cash crunch alert engine", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("fires warning when runway <30 days", () => {
    expect(cashCrunchSeverity(22)).toBe("warning");
    expect(qualifiesForCashCrunchAlert(warningMetrics())).toBe(true);

    const alert = buildCashCrunchAlert("store-1", warningMetrics());
    expect(alert!.severity).toBe("warning");
  });

  it("fires critical when runway <7 days", () => {
    expect(cashCrunchSeverity(5)).toBe("critical");

    const alert = buildCashCrunchAlert("store-1", criticalMetrics());
    expect(alert!.severity).toBe("critical");
  });

  it("does not fire when runway is 30 days or more", () => {
    expect(cashCrunchSeverity(30)).toBeNull();
    expect(
      buildCashCrunchAlert("store-1", { ...warningMetrics(), runway_days: 30 }),
    ).toBeNull();
  });

  it("includes balance, daily burn, and suggested actions", () => {
    const metrics = criticalMetrics();
    const alert = buildCashCrunchAlert("store-1", metrics)!;

    expect(alert.body).toContain("$4,100");
    expect(alert.body).toContain("$820");
    expect(alert.body).toContain("Pause discretionary ad spend");
    expect(alert.top_driver).toBe("Pause discretionary ad spend");
    expect(alert.metric_snapshot).toMatchObject({
      cash_balance_usd: 4100,
      daily_burn_usd: 820,
      runway_days: 5,
      suggested_actions: metrics.suggested_actions,
    });
  });

  it("sends push for warning+ when enabled", async () => {
    const alert = await evaluateCashCrunchAlert(null, "store-1", criticalMetrics());
    expect(wasPushSent(alert!.id)).toBe(true);
    expect(getPushLog()).toHaveLength(1);
  });

  it("allows critical cash crunch push during quiet hours", async () => {
    setNotificationPrefs("store-1", {
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    });

    const alert = await evaluateCashCrunchAlert(
      null,
      "store-1",
      criticalMetrics(),
      new Date("2026-06-17T23:00:00.000Z"),
    );

    expect(wasPushSent(alert!.id)).toBe(true);
  });

  it("does not duplicate cash crunch alerts on re-evaluation", async () => {
    await evaluateCashCrunchAlert(null, "store-1", criticalMetrics());
    await evaluateCashCrunchAlert(null, "store-1", criticalMetrics());
    expect(getPushLog()).toHaveLength(1);
  });

  it("respects threshold constants", () => {
    expect(CASH_CRUNCH_THRESHOLDS.warning_days).toBe(30);
    expect(CASH_CRUNCH_THRESHOLDS.critical_days).toBe(7);
  });
});
