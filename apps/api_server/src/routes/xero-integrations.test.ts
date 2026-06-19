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

describe("xero integration routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/integrations/xero requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/xero",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/xero returns disconnected when not connected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/xero",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: "xero",
      status: "disconnected",
      needs_tenant_selection: false,
      needs_reauth: false,
      availability: "available",
    });
  });

  it("GET /api/v1/integrations/xero/oauth/start requires bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/xero/oauth/start",
    });
    expect([401, 503]).toContain(res.statusCode);
  });
});
