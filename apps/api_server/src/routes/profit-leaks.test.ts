import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profitLeaks } from "@morgan/db";
import { getDb } from "../lib/db.js";
import { ensureStubStoreForTests, STUB_STORE_ID } from "../test/stub-store.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const TEST_LEAK_ID = "00000000-0000-4000-8000-000000000199";

const { buildApp } = await import("../app.js");

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

async function seedActiveLeak(db: NonNullable<ReturnType<typeof getDb>>): Promise<void> {
  await db
    .insert(profitLeaks)
    .values({
      id: TEST_LEAK_ID,
      storeId: STUB_STORE_ID,
      leakType: "discount_bleed",
      externalKey: "discount_bleed:store",
      status: "active",
      severity: "warning",
      amountAtRiskUsd: "1234.0000",
      evidence: [{ discount_rate_pct: 18.2, prior_discount_rate_pct: 12.1, discounts_usd: 1234 }],
      dedupeKey: "discount_bleed:store:2026-01-01",
    })
    .onConflictDoUpdate({
      target: [profitLeaks.storeId, profitLeaks.dedupeKey],
      set: { status: "active", updatedAt: new Date() },
    });
}

describe("profit leak routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await ensureStubStoreForTests(db);
      await seedActiveLeak(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/stores/:store_id/profit/leaks requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${STUB_STORE_ID}/profit/leaks`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:store_id/profit/leaks returns list payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${STUB_STORE_ID}/profit/leaks`,
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 403) {
      expect(res.json().code).toBe("forbidden");
      return;
    }
    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      store_id: expect.any(String),
      last_scan_at: expect.anything(),
      items: expect.any(Array),
    });
  });

  it("GET /api/v1/stores/:store_id/profit/leaks/:leak_id returns detail payload", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${STUB_STORE_ID}/profit/leaks/${TEST_LEAK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 403) {
      expect(res.json().code).toBe("forbidden");
      return;
    }
    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: TEST_LEAK_ID,
      leak_type: "discount_bleed",
      recommendation_id: TEST_LEAK_ID,
      evidence_rows: expect.any(Array),
    });
  });
});

