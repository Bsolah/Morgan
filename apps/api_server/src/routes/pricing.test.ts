import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureStubStoreForTests } from "../test/stub-store.js";
import { getDb } from "../lib/db.js";

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

describe("pricing routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await ensureStubStoreForTests(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/pricing/suggestions requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/pricing/suggestions" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/pricing/suggestions returns pricing suggestions payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pricing/suggestions",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      reference_day: expect.any(String),
      target_margin_rate: expect.any(Number),
      increase_suggestions: expect.any(Array),
      decrease_suggestions: expect.any(Array),
      recommendation_only: true,
    });

    const increase = res.json().increase_suggestions[0];
    if (increase) {
      expect(increase).toMatchObject({
        sku: expect.any(String),
        current_price: expect.any(Number),
        suggested_price: expect.any(Number),
        expected_margin_delta_usd: expect.any(Number),
        expected_unit_delta: expect.any(Number),
        confidence: expect.stringMatching(/^(high|low)$/),
      });
      expect(increase.increase_pct).toBeLessThanOrEqual(5);
    }

    const decrease = res.json().decrease_suggestions[0];
    if (decrease) {
      expect(decrease).toMatchObject({
        sku: expect.any(String),
        strategy: expect.stringMatching(/^(decrease|bundle)$/),
        current_price: expect.any(Number),
        evidence: expect.objectContaining({
          return_rate_pct: expect.any(Number),
          category_mean_return_rate_pct: expect.any(Number),
          return_rate_threshold_pct: expect.any(Number),
          category_median_price: expect.any(Number),
        }),
      });
    }
  });
});
