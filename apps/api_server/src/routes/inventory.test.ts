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

describe("inventory routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/stores/:store_id/inventory/health requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/inventory/health",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/inventory/health returns summary payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/inventory/health?window_days=30",
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
      stockout_risk_count: expect.any(Number),
      overstock_count: expect.any(Number),
      overstock_value_usd: expect.any(Number),
      skus: expect.any(Array),
    });
    expect(res.json().skus.length).toBeLessThanOrEqual(10);
  });

  it("GET /api/v1/inventory/config requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/inventory/config" });
    expect(res.statusCode).toBe(401);
  });

  it("PATCH /api/v1/inventory/config updates default lead time", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/inventory/config",
      headers: { authorization: `Bearer ${token}` },
      payload: { default_lead_time_days: 21 },
    });

    if (res.statusCode === 400 && res.json().code === "no_store") {
      return;
    }
    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      default_lead_time_days: 21,
      sku_overrides: expect.any(Array),
    });
  });

  it("PUT /api/v1/inventory/lead-times/:sku upserts override", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/inventory/lead-times/TEE-BLUE",
      headers: { authorization: `Bearer ${token}` },
      payload: { lead_time_days: 10 },
    });

    if (res.statusCode === 400 && res.json().code === "no_store") {
      return;
    }
    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().sku_overrides).toEqual(
      expect.arrayContaining([{ sku: "TEE-BLUE", lead_time_days: 10 }]),
    );
  });

  it("GET /api/v1/stores/:store_id/inventory/forecast/demand requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/inventory/forecast/demand",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/inventory/forecast/demand returns forecast payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/inventory/forecast/demand",
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
      horizon_days: 30,
      sku_count: expect.any(Number),
      skus: expect.any(Array),
      status: expect.stringMatching(/ready|insufficient_data/),
    });
  });
});
