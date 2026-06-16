import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { buildApp } = await import("./app.js");
const { computeShopifyHmac } = await import("./routes/webhooks/shopify.js");

describe("Morgan API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "morgan-api" });
  });

  it("POST /api/v1/auth/shopify/token-exchange returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.access_token).toBeTypeOf("string");
    expect(body.refresh_token).toBeTypeOf("string");
    expect(body.shop_domain).toBe("demo.myshopify.com");
  });

  it("GET /api/v1/auth/me requires bearer token", async () => {
    const unauth = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(unauth.statusCode).toBe(401);

    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token } = exchange.json();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${access_token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().store_ids).toHaveLength(1);
  });

  it("POST /webhooks/shopify rejects invalid HMAC", async () => {
    const payload = JSON.stringify({ id: 1 });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "invalid",
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-domain": "demo.myshopify.com",
      },
      payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /webhooks/shopify accepts valid HMAC", async () => {
    const payload = JSON.stringify({ id: 42, total_price: "99.00" });
    const hmac = computeShopifyHmac(payload, process.env.SHOPIFY_API_SECRET!);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-domain": "demo.myshopify.com",
        "x-shopify-webhook-id": "550e8400-e29b-41d4-a716-446655440000",
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });
});
