import { describe, expect, it, beforeEach } from "vitest";
import type { AlertRecord } from "./alerts-data.js";
import { resetAlertsStore, getPushLog, setNotificationPrefs, wasPushSent } from "./alerts-store.js";
import { isQuietHours, maybeSendAlertPush, shouldBypassQuietHours } from "./alerts-push.js";

const sampleAlert = (overrides: Partial<AlertRecord> = {}): AlertRecord => ({
  id: "alert-1",
  store_id: "store-1",
  severity: "warning",
  type: "margin_drop",
  title: "Test",
  body: "Test body",
  magnitude: "Test magnitude",
  top_driver: "Test driver",
  links: {},
  metric_snapshot: {},
  read_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("alerts push", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("blocks warning pushes during quiet hours", async () => {
    setNotificationPrefs("store-1", {
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    });

    const sent = await maybeSendAlertPush(
      null,
      "store-1",
      sampleAlert(),
      new Date("2026-06-17T23:00:00.000Z"),
    );

    expect(sent).toBe(false);
    expect(getPushLog()).toHaveLength(0);
  });

  it("allows critical cash crunch to bypass quiet hours", async () => {
    setNotificationPrefs("store-1", {
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    });

    const alert = sampleAlert({
      id: "cash-critical",
      severity: "critical",
      type: "cash_crunch",
    });

    expect(shouldBypassQuietHours(alert)).toBe(true);

    const sent = await maybeSendAlertPush(
      null,
      "store-1",
      alert,
      new Date("2026-06-17T23:00:00.000Z"),
    );

    expect(sent).toBe(true);
    expect(wasPushSent("cash-critical")).toBe(true);
  });

  it("detects quiet hours across midnight", () => {
    setNotificationPrefs("store-1", {
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    });

    const prefs = {
      push_warnings: true,
      push_critical: true,
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 5,
    };

    expect(isQuietHours(new Date("2026-06-17T23:00:00.000Z"), prefs)).toBe(true);
    expect(isQuietHours(new Date("2026-06-18T03:00:00.000Z"), prefs)).toBe(true);
    expect(isQuietHours(new Date("2026-06-18T12:00:00.000Z"), prefs)).toBe(false);
  });
});
