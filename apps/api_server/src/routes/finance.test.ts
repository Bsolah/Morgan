import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { buildApp } = await import("../app.js");

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

describe("finance config routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/finance/config requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/finance/config" });
    expect(res.statusCode).toBe(401);
  });

  it("PATCH /api/v1/finance/config rejects manual_pct without percentage", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/finance/config",
      headers: { authorization: `Bearer ${token}` },
      payload: { cogs_method: "manual_pct" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("PATCH /api/v1/finance/config rejects invalid manual percentage", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/finance/config",
      headers: { authorization: `Bearer ${token}` },
      payload: { cogs_method: "manual_pct", manual_cogs_pct: 120 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("PATCH /api/v1/finance/config rejects QuickBooks when not connected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/finance/config",
      headers: { authorization: `Bearer ${token}` },
      payload: { cogs_method: "qbo" },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("quickbooks_not_connected");
  });
});
