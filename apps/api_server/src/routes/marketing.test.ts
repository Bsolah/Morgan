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

describe("marketing routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/brief/today requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/brief/today" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/marketing/overview requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/marketing/overview" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/marketing/budget-allocation requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/marketing/budget-allocation" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/brief/today returns narrative payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/brief/today",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      headline: expect.any(String),
      narrative: expect.any(String),
      meta_connected: expect.any(Boolean),
      kpi_deltas: expect.any(Array),
      has_brief: expect.any(Boolean),
      next_briefing_at: expect.any(String),
    });
  });

  it("GET /api/v1/brief/history returns last 30 days", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/brief/history?days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      days: 30,
      items: expect.any(Array),
    });
    expect(res.json().items.length).toBe(30);
  });

  it("GET /api/v1/marketing/overview returns POAS tooltips", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/marketing/overview?window_days=7",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().tooltips.poas).toContain("contribution margin");
    expect(res.json().tooltips.roas).toContain("revenue");
    expect(res.json()).toMatchObject({
      google_ads_connected: expect.any(Boolean),
      ads_connected: expect.any(Boolean),
      channels: expect.any(Array),
      campaigns: expect.any(Array),
      trend_days: 7,
      trend: expect.any(Array),
    });
  });

  it("GET /api/v1/marketing/campaigns/:channel/:campaign_id requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/marketing/campaigns/meta/campaign-1",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/marketing/campaigns/:channel/:campaign_id returns trend payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/marketing/campaigns/meta/campaign-1?window_days=7&trend_days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }
    if (res.statusCode === 404) {
      expect(res.json().code).toBe("not_found");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      channel: "meta",
      campaign_id: "campaign-1",
      trend_days: 30,
      trend: expect.any(Array),
    });
  });

  it("GET /api/v1/marketing/mer requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/marketing/mer" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/marketing/mer returns channel breakdown and trend", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/marketing/mer?window_days=30&trend_days=30",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      window_days: 30,
      trend_days: 30,
      channels: expect.any(Array),
      trend: expect.any(Array),
      tooltips: { mer: expect.any(String) },
    });
    expect(body.channels.length).toBeGreaterThanOrEqual(2);
    expect(body.trend.length).toBe(30);
  });

  it("GET /api/v1/marketing/budget-allocation returns campaign POAS inputs", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/marketing/budget-allocation",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      window_days: 30,
      total_budget_usd: expect.any(Number),
      campaigns: expect.any(Array),
      channels: expect.any(Array),
      marginal_poas_curves: expect.any(Array),
      reallocation_scenarios: expect.any(Array),
      suggest_only: true,
    });
  });
});
