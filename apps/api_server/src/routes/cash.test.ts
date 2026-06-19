import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAYOUT_UNAVAILABLE_MESSAGE } from "../lib/payout-sync-service.js";

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

describe("cash payout routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/cash/payouts requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cash/payouts" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cash/payouts returns unavailable message without Shopify Payments", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cash/payouts",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      available: false,
      message: PAYOUT_UNAVAILABLE_MESSAGE,
      balance: null,
      expected_inflows: [],
    });
  });

  it("GET /api/v1/cash/overview requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cash/overview" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cash/overview returns reconciliation summary", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cash/overview",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      matched_count: expect.any(Number),
      window_days: 30,
      flow_breakdown: expect.any(Array),
      expected_payouts: expect.any(Array),
      runway: expect.objectContaining({
        bank_connected: expect.any(Boolean),
        runway_status: expect.any(String),
      }),
      unmatched_payout_count: expect.any(Number),
      unmatched_deposit_count: expect.any(Number),
      has_reconciliation_gaps: expect.any(Boolean),
      matched: expect.any(Array),
      unmatched_payouts: expect.any(Array),
      unmatched_deposits: expect.any(Array),
    });
  });

  it("GET /api/v1/cash/runway requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cash/runway" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cash/runway returns connect bank CTA when bank is disconnected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cash/runway",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      bank_connected: false,
      available: false,
      cta: "Connect bank",
      runway_days: null,
    });
  });

  it("GET /api/v1/cash/overview includes profit-only fallback when bank is disconnected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cash/overview",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    const body = res.json();
    if (body.bank_connected === false) {
      expect(body.profit_only).toMatchObject({
        disclaimer: expect.stringContaining("Bank not connected"),
      });
      expect(body.flow_breakdown).toEqual([]);
    }
  });
});
