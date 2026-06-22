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

  it("GET /api/v1/integrations/plaid returns plaid status payload", async () => {
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
    const body = res.json() as { provider: string; status: string; privacy_disclosure: string };
    expect(body).toMatchObject({
      provider: "plaid",
      privacy_disclosure: expect.stringContaining("never move money"),
    });
    expect(["connected", "disconnected", "syncing", "error"]).toContain(body.status);
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
    const body = res.json() as {
      integrations: Array<{
        provider: string;
        label: string;
        status: string;
        data_coverage_pct: number;
        coming_soon?: boolean;
      }>;
      overall_data_coverage_pct: number;
    };
    const providers = body.integrations.map((item) => item.provider);
    expect(providers).toContain("shopify");
    expect(providers).toContain("meta");
    expect(providers).toContain("plaid");
    expect(providers).toContain("quickbooks");
    expect(providers).toContain("google_ads");
    expect(providers).toContain("xero");

    const plaidCard = body.integrations.find((item) => item.provider === "plaid");
    expect(plaidCard).toMatchObject({
      label: "Bank (Plaid)",
      data_coverage_pct: expect.any(Number),
    });
    expect(["connected", "disconnected", "syncing", "error"]).toContain(plaidCard?.status);

    const xeroCard = body.integrations.find((item) => item.provider === "xero");
    expect(xeroCard?.coming_soon).toBe(true);

    expect(typeof body.overall_data_coverage_pct).toBe("number");
  });
});
