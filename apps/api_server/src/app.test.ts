import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  consumeConnectToken,
  issueConnectToken,
  resetOAuthStores,
} from "./lib/shopify-oauth-state.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { buildApp } = await import("./app.js");

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
    expect(body.expires_in).toBe(900);
    expect(body.shop_domain).toBe("demo.myshopify.com");
  });

  it("POST /api/v1/auth/shopify/token-exchange accepts connect_token", async () => {
    resetOAuthStores();
    const connectToken = issueConnectToken({
      userId: "00000000-0000-4000-8000-000000000010",
      orgId: "00000000-0000-4000-8000-000000000011",
      storeId: "00000000-0000-4000-8000-000000000012",
      shopDomain: "demo.myshopify.com",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { connect_token: connectToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().shop_domain).toBe("demo.myshopify.com");
    expect(consumeConnectToken(connectToken)).toBeNull();
  });

  it("GET /api/v1/auth/shopify/oauth/start rejects invalid shop", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/shopify/oauth/start?shop=&platform=mobile",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/v1/auth/shopify/oauth/start redirects to Shopify", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/shopify/oauth/start?shop=demo.myshopify.com&platform=mobile",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("demo.myshopify.com/admin/oauth/authorize");
  });

  it("POST /api/v1/auth/refresh returns new access token", async () => {
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
    });
    const { refresh_token } = exchange.json();

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refresh_token },
    });

    expect(refresh.statusCode).toBe(200);
    const body = refresh.json();
    expect(body.access_token).toBeTypeOf("string");
    expect(body.expires_in).toBe(900);
    expect(body.token_type).toBe("Bearer");
  });

  it("POST /api/v1/auth/refresh rejects invalid refresh token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refresh_token: "not-a-valid-token" },
    });
    expect(res.statusCode).toBe(401);
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
});
