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

describe("plaid integration routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/integrations/plaid/link-token requires auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/plaid/link-token",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/integrations/plaid/exchange-public-token requires auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/plaid/exchange-public-token",
      payload: { public_token: "public-sandbox-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/plaid returns disconnected when not connected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/plaid",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: "plaid",
      status: "disconnected",
      privacy_disclosure: expect.stringContaining("never move money"),
    });
  });

  it("GET /api/v1/integrations/hub includes plaid card", async () => {
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
    const providers = (res.json().integrations as Array<{ provider: string }>).map((item) => item.provider);
    expect(providers).toContain("meta");
    expect(providers).toContain("plaid");
    expect(providers).toContain("quickbooks");
    expect(providers).toContain("google_ads");
    expect(providers).toContain("xero");
  });
});
