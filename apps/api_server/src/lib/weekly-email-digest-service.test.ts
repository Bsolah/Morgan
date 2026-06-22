import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildUnsubscribeUrl } from "./weekly-email-digest-service.js";

vi.mock("./notification-prefs-service.js", () => ({
  getStoreNotificationPrefs: vi.fn(async () => ({
    push_daily_brief: true,
    push_warnings: true,
    push_critical: true,
    quiet_hours_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 7,
    weekly_email_digest: true,
  })),
  updateStoreNotificationPrefs: vi.fn(async (_db, _storeId, patch) => ({
    push_daily_brief: true,
    push_warnings: true,
    push_critical: true,
    quiet_hours_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 7,
    weekly_email_digest: false,
    ...patch,
  })),
}));

vi.mock("../config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      WEEKLY_DIGEST_TIME_LOCAL: "07:00",
      MORGAN_POSTAL_ADDRESS: "123 Market Street",
    },
    getAppPublicUrl: () => "https://api.getmorgan.test",
    isResendConfigured: () => true,
  };
});

vi.mock("@morgan/emails", () => ({
  renderWeeklyDigestEmail: vi.fn(async () => ({
    subject: "Weekly Morgan summary",
    html: "<p>digest</p>",
    text: "digest",
  })),
}));

vi.mock("./email-service.js", () => ({
  sendTransactionalEmail: vi.fn(async () => ({
    sent: true,
    skipped: false,
    messageId: "msg_123",
  })),
}));

vi.mock("./metric-snapshot-service.js", () => ({
  getStoreMetrics: vi.fn(async () => ({
    metrics: [{ metric_key: "contribution_margin_7d", value: "4280" }],
  })),
  metricValue: vi.fn(() => 4280),
}));

vi.mock("./profit-overview-service.js", () => ({
  getProfitOverview: vi.fn(async () => ({
    current_margin_pct: 41.2,
    margin_delta_pct: 2.1,
  })),
}));

vi.mock("./profit-leak-service.js", () => ({
  listActiveProfitLeaks: vi.fn(async () => ({
    items: [{ title: "Pause campaign X", leak_label: "Ad waste", amount_at_risk_usd: 420 }],
  })),
}));

vi.mock("./recommendation-service.js", () => ({
  getTopOpenRecommendation: vi.fn(async () => ({
    title: "Raise prices on SKU-123",
    body: "Margin is below category median.",
  })),
}));

vi.mock("./cash-runway-service.js", () => ({
  getCashRunway: vi.fn(async () => ({
    bank_connected: true,
    runway_days: 45,
    runway_status: "healthy",
    message: null,
  })),
}));

describe("weekly email digest service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds CAN-SPAM unsubscribe url", () => {
    expect(buildUnsubscribeUrl("abc123")).toBe(
      "https://api.getmorgan.test/api/v1/notifications/unsubscribe?token=abc123",
    );
  });
});

describe("sendWeeklyEmailDigest", () => {
  it("skips when weekly digest pref is disabled", async () => {
    const { getStoreNotificationPrefs } = await import("./notification-prefs-service.js");
    vi.mocked(getStoreNotificationPrefs).mockResolvedValueOnce({
      push_daily_brief: true,
      push_warnings: true,
      push_critical: true,
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      weekly_email_digest: false,
    });

    const { sendWeeklyEmailDigest } = await import("./weekly-email-digest-service.js");
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "store-1",
                shopDomain: "demo.myshopify.com",
                timezone: "America/New_York",
              },
            ],
          }),
        }),
      }),
    };

    const result = await sendWeeklyEmailDigest(db as never, "store-1", { force: false });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("weekly_email_digest_disabled");
  });
});
