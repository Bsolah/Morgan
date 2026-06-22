import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildKpiDelta, formatTopKpiDeltaForPush } from "@morgan/integrations";
import { getStoreNotificationPrefs } from "./notification-prefs-service.js";
import { sendDailyBriefReadyPush } from "./push-notification-service.js";

vi.mock("./notification-prefs-service.js", () => ({
  getStoreNotificationPrefs: vi.fn(async () => ({
    push_daily_brief: true,
    push_warnings: true,
    push_critical: true,
    quiet_hours_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 7,
    weekly_email_digest: false,
  })),
}));

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      FCM_SERVER_KEY: "test-key",
      MOBILE_DEEP_LINK_SCHEME: "morgan",
      FCM_SEND_TIMEOUT_MS: 5000,
    },
  };
});

describe("sendDailyBriefReadyPush", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.FCM_SERVER_KEY = "test-key";
    process.env.MOBILE_DEEP_LINK_SCHEME = "morgan";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.FCM_SERVER_KEY;
  });

  it("uses headline as title and top KPI delta as body", async () => {
    const kpiDeltas = [
      buildKpiDelta({
        key: "contribution_margin_7d",
        label: "Contribution profit (7d)",
        value: 4280,
        priorValue: 3820,
        format: "currency",
      }),
    ];

    let capturedBody: Record<string, unknown> | null = null;
    global.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: 1 }), { status: 200 });
    }) as typeof fetch;

    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ token: "device-token-1234567890" }],
        }),
      }),
    };

    const result = await sendDailyBriefReadyPush(db as never, "store-1", {
      headline: "Profit up on strong MER",
      kpiDeltas,
      briefingDate: "2026-06-17",
    });

    expect(result.skipped).toBe(false);
    expect(result.sent).toBe(1);
    expect(capturedBody).toMatchObject({
      notification: {
        title: "Profit up on strong MER",
        body: "Contribution profit (7d): $4,280 (+12.0% vs prior week)",
      },
      data: {
        type: "daily_brief",
        deep_link: "morgan://home",
        briefing_date: "2026-06-17",
      },
    });
  });

  it("skips push when daily brief notifications are disabled", async () => {
    vi.mocked(getStoreNotificationPrefs).mockResolvedValueOnce({
      push_daily_brief: false,
      push_warnings: true,
      push_critical: true,
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      weekly_email_digest: false,
    });

    global.fetch = vi.fn() as typeof fetch;

    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ token: "device-token-1234567890" }],
        }),
      }),
    };

    const result = await sendDailyBriefReadyPush(db as never, "store-1", {
      headline: "Profit up on strong MER",
      kpiDeltas: [],
      briefingDate: "2026-06-17",
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("push_daily_brief_disabled");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("formatTopKpiDeltaForPush", () => {
  it("formats currency KPI with delta", () => {
    const body = formatTopKpiDeltaForPush([
      buildKpiDelta({
        key: "contribution_margin_7d",
        label: "Contribution profit (7d)",
        value: 4280,
        priorValue: 3820,
        format: "currency",
      }),
    ]);

    expect(body).toBe("Contribution profit (7d): $4,280 (+12.0% vs prior week)");
  });
});
