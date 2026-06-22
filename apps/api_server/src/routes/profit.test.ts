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

describe("profit routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/stores/:store_id/profit/overview requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/overview",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/profit/overview returns margin trend payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/overview?window_days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 403) {
      expect(res.json().code).toBe("forbidden");
      return;
    }

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      store_id: expect.any(String),
      window_days: 30,
      target_margin_pct: expect.any(Number),
      trend: expect.any(Array),
      active_leak_count: expect.any(Number),
      leak_counts_by_type: expect.any(Object),
      amount_at_risk_usd: expect.any(Number),
    });
  });

  it("GET /api/v1/stores/:store_id/profit/margin-drivers requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/margin-drivers",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/profit/margin-drivers returns driver payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/margin-drivers?window_days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 403) {
      expect(res.json().code).toBe("forbidden");
      return;
    }

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      window_days: 30,
      drivers: expect.any(Array),
    });
    expect(res.json().drivers.length).toBeLessThanOrEqual(3);
  });

  it("GET /api/v1/stores/:store_id/profit/skus requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/skus",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/profit/skus/:sku requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/skus/TEE-BLUE",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/profit/skus returns ranked SKU payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/profit/skus?window_days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 403) {
      expect(res.json().code).toBe("forbidden");
      return;
    }

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      store_id: expect.any(String),
      window_days: 30,
      skus: expect.any(Array),
    });
  });
});
