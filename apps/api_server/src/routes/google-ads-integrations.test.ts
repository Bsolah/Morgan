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

describe("google ads integration routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/integrations/google-ads requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/google-ads",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/google-ads returns disconnected card marked available", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/google-ads",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: "google_ads",
      availability: "available",
      status: "disconnected",
      needs_manager_selection: false,
      needs_client_selection: false,
    });
  });

  it("GET /api/v1/integrations/google-ads/oauth/start requires bearer token or not_configured", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/google-ads/oauth/start",
    });
    expect([401, 503]).toContain(res.statusCode);
  });

  it("GET /api/v1/integrations/hub includes google ads card", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/hub",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      integrations: Array<{
        provider: string;
        data_coverage_pct: number;
        details: Record<string, unknown>;
      }>;
    };
    const googleAdsCard = body.integrations.find((item) => item.provider === "google_ads");
    expect(googleAdsCard).toMatchObject({
      provider: "google_ads",
      data_coverage_pct: expect.any(Number),
    });
    expect(googleAdsCard?.details).toBeDefined();
  });
});
