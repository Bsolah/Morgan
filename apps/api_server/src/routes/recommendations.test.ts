import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profitLeaks } from "@morgan/db";
import { getDb } from "../lib/db.js";
import { ensureStubStoreForTests, STUB_STORE_ID } from "../test/stub-store.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const TEST_LEAK_ID = "00000000-0000-4000-8000-000000000099";

const { buildApp } = await import("../app.js");

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

async function seedActiveProfitLeak(db: NonNullable<ReturnType<typeof getDb>>): Promise<void> {
  await db
    .insert(profitLeaks)
    .values({
      id: TEST_LEAK_ID,
      storeId: STUB_STORE_ID,
      leakType: "ad_waste",
      externalKey: "campaign-123",
      status: "active",
      severity: "warning",
      amountAtRiskUsd: "420.0000",
      evidence: [{ campaign: "Summer Sale", poas: 0.62, spend_7d: 420 }],
      dedupeKey: "ad_waste:meta:Summer Sale",
    })
    .onConflictDoUpdate({
      target: [profitLeaks.storeId, profitLeaks.dedupeKey],
      set: {
        id: TEST_LEAK_ID,
        status: "active",
        amountAtRiskUsd: "420.0000",
        updatedAt: new Date(),
      },
    });
}

describe("recommendations routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await ensureStubStoreForTests(db);
      await seedActiveProfitLeak(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/recommendations requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/recommendations" });
    expect(res.statusCode).toBe(401);
  });

  it("lists open recommendations for the authenticated store", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/recommendations",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBeGreaterThanOrEqual(1);
    expect(res.json().items[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      status: "open",
    });
  });

  it("accepts a recommendation and returns confirmation copy", async () => {
    const token = await getAccessToken(app);
    const db = getDb();
    if (db) {
      await seedActiveProfitLeak(db);
    }

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/recommendations/${TEST_LEAK_ID}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().recommendation.status).toBe("accepted");
    expect(res.json().confirmation_message).toContain("accepted");
  });

  it("dismisses a recommendation and returns confirmation copy", async () => {
    const token = await getAccessToken(app);
    const db = getDb();
    if (db) {
      await seedActiveProfitLeak(db);
    }

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/recommendations/${TEST_LEAK_ID}/dismiss`,
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().recommendation.status).toBe("dismissed");
    expect(res.json().confirmation_message).toContain("Dismissed");
  });
});
