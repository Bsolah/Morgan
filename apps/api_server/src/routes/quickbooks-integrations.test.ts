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

describe("quickbooks integration routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/integrations/quickbooks requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/quickbooks returns disconnected when not connected", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(res.json().code).toBe("not_configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      provider: "quickbooks",
      status: "disconnected",
      needs_company_selection: false,
      needs_reauth: false,
    });
  });

  it("GET /api/v1/integrations/quickbooks/oauth/start requires bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks/oauth/start",
    });
    expect([401, 503]).toContain(res.statusCode);
  });

  it("GET /api/v1/integrations/quickbooks/oauth/start returns authorize_url for mobile", async () => {
    if (!process.env.INTUIT_CLIENT_ID || !process.env.INTUIT_CLIENT_SECRET) {
      const token = await getAccessToken(app);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/integrations/quickbooks/oauth/start?platform=mobile",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().code).toBe("not_configured");
      return;
    }

    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks/oauth/start?platform=mobile",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().authorize_url).toContain("appcenter.intuit.com/connect/oauth2");
    expect(res.json().authorize_url).toContain("com.intuit.quickbooks.accounting");
  });

  it("GET /api/v1/integrations/quickbooks/companies requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks/companies",
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/v1/integrations/quickbooks/company requires auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/quickbooks/company",
      payload: { realm_id: "123" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/integrations/quickbooks/account-mappings requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/quickbooks/account-mappings",
    });
    expect(res.statusCode).toBe(401);
  });

  it("PUT /api/v1/integrations/quickbooks/account-mappings requires auth", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/integrations/quickbooks/account-mappings",
      payload: { mappings: [] },
    });
    expect(res.statusCode).toBe(401);
  });
});
