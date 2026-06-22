import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS } from "../lib/alerts-data.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

vi.mock("../lib/notification-prefs-service.js", () => ({
  getStoreNotificationPrefs: vi.fn(async () => ({ ...DEFAULT_NOTIFICATION_PREFS })),
  updateStoreNotificationPrefs: vi.fn(async (_db, _storeId, patch) => ({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...patch,
  })),
}));

vi.mock("../lib/db.js", () => ({
  getDb: vi.fn(() => ({})),
}));

const { buildApp } = await import("../app.js");

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

describe("notification preference routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/notifications/preferences requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/notifications/preferences" });
    expect(res.statusCode).toBe(401);
  });

  it("returns default preferences", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/notifications/preferences",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("PATCH /api/v1/notifications/preferences rejects empty body", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/notifications/preferences",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it("PATCH /api/v1/notifications/preferences updates toggles", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/notifications/preferences",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        push_warnings: false,
        quiet_hours_start: 21,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      push_warnings: false,
      quiet_hours_start: 21,
      push_daily_brief: true,
    });
  });
});
