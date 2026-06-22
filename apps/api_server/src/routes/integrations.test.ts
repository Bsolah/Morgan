import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.META_APP_ID = "meta-test-app-id";
process.env.META_APP_SECRET = "meta-test-app-secret";
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

describe("integrations routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/integrations/hub requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/integrations/hub" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/meta requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/integrations/meta" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/meta/oauth/start requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/meta/oauth/start?platform=mobile",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/meta/oauth/start returns authorize URL when configured", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/meta/oauth/start?platform=mobile",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().authorize_url).toContain("facebook.com");
    expect(res.json().authorize_url).toContain("ads_read");
  });

  it("GET /api/v1/integrations/meta returns disconnected when not connected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/meta",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: "meta",
      status: "disconnected",
      needs_account_selection: false,
      needs_reauth: false,
      insights_backfill_completed: false,
    });
  });

  it("POST /api/v1/integrations/meta/ad-account rejects invalid payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/meta/ad-account",
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
