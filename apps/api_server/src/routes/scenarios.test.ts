import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { martAdPerformanceDaily } from "@morgan/db";
import { getDb } from "../lib/db.js";
import { ensureStubStoreForTests, STUB_STORE_ID } from "../test/stub-store.js";

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

async function seedMetaAdPerformance(db: NonNullable<ReturnType<typeof getDb>>): Promise<void> {
  const days = ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15", "2026-06-16"];
  for (const performanceDate of days) {
    await db
      .insert(martAdPerformanceDaily)
      .values({
        storeId: STUB_STORE_ID,
        channel: "meta",
        campaignId: "camp-1",
        campaignName: "Summer Sale",
        performanceDate,
        adSpend: "285.7143",
        attributedRevenue: "714.2857",
        attributedContributionMargin: "342.8571",
        poas: "1.2000",
      })
      .onConflictDoUpdate({
        target: [
          martAdPerformanceDaily.storeId,
          martAdPerformanceDaily.channel,
          martAdPerformanceDaily.campaignId,
          martAdPerformanceDaily.performanceDate,
        ],
        set: {
          adSpend: "285.7143",
          attributedContributionMargin: "342.8571",
          poas: "1.2000",
          updatedAt: new Date(),
        },
      });
  }
}

describe("scenarios routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await ensureStubStoreForTests(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/scenarios requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/scenarios", payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it("saves an ad spend scenario", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/scenarios",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        scenario_type: "ad_spend",
        channel: "meta",
        spend_change_pct: 20,
        title: "Meta spend increase 20%",
        inputs: { baseline_spend_7d_usd: 2000 },
        results: { profit_change_low_usd: 400, profit_change_high_usd: 600 },
        source: "chat",
      },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(201);
    expect(res.json().scenario).toMatchObject({
      id: expect.any(String),
      title: "Meta spend increase 20%",
      scenario_type: "ad_spend",
    });
  });
});

describe("chat scenario streaming", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await ensureStubStoreForTests(db);
      await seedMetaAdPerformance(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("streams scenario forecast for what-if spend questions", async () => {
    const db = getDb();
    if (db) {
      await seedMetaAdPerformance(db);
    }

    const token = await getAccessToken(app);
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/chat/sessions",
      headers: { authorization: `Bearer ${token}` },
    });

    if (create.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(create.json().code);
      return;
    }

    const sessionId = create.json().session_id as string;
    const stream = await app.inject({
      method: "POST",
      url: `/api/v1/chat/sessions/${sessionId}/messages`,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      payload: { content: "What if I increase Meta spend 20%?" },
    });

    if (stream.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(stream.json().code);
      return;
    }

    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("event: scenario");
    expect(stream.body).toContain("profit_change_low_usd");
    expect(stream.body).toContain("Assumes current POAS");
    expect(stream.body).toContain('"text":"projected "');
  });
});
