import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { profitLeaks } from "@morgan/db";
import { getDb } from "../lib/db.js";
import { ensureStubStoreForTests, STUB_STORE_ID } from "../test/stub-store.js";
process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { buildApp } = await import("../app.js");

const TEST_LEAK_ID = "00000000-0000-4000-8000-000000000099";

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

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

describe("chat routes", () => {
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

  it("POST /api/v1/chat/sessions requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/chat/sessions" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/chat/starters returns at least 3 contextual starters", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/chat/starters",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json().starters.length).toBeGreaterThanOrEqual(3);
    expect(res.json().starters[0]).toMatchObject({
      label: expect.any(String),
      message: expect.any(String),
    });
  });

  it("creates session, streams assistant response, and persists messages", async () => {
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

    expect(create.statusCode).toBe(201);
    const sessionId = create.json().session_id as string;

    const stream = await app.inject({
      method: "POST",
      url: `/api/v1/chat/sessions/${sessionId}/messages`,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      payload: { content: "Why did profit drop yesterday?" },
    });

    if (stream.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(stream.json().code);
      return;
    }

    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(stream.body).toContain("event: token");
    expect(stream.body).toContain("event: citation");
    expect(stream.body).toContain("query_summary");
    expect(stream.body).toContain("raw_values");
    expect(stream.body).toContain("event: done");

    const history = await app.inject({
      method: "GET",
      url: `/api/v1/chat/sessions/${sessionId}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(history.statusCode).toBe(200);
    expect(history.json().messages.length).toBeGreaterThanOrEqual(2);
    expect(history.json().messages.at(-1)).toMatchObject({
      role: "assistant",
      confidence: expect.any(String),
    });
  });

  it("refuses out-of-scope tax advice with required message", async () => {
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
      payload: { content: "How do I file my quarterly taxes for this store?" },
    });

    if (stream.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(stream.json().code);
      return;
    }

    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("tax/legal");
    expect(stream.body).toContain("underlying");
    expect(stream.body).toContain('"text":"profit "');
    expect(stream.body).not.toContain("event: citation");
  });

  it("streams inline action card for campaign questions when a profit leak exists", async () => {
    const db = getDb();
    if (db) {
      await seedActiveProfitLeak(db);
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
      payload: { content: "Which campaigns should I pause?" },
    });

    if (stream.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(stream.json().code);
      return;
    }

    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("event: action");
    expect(stream.body).toContain("recommendation_id");
    expect(stream.body).toContain("impact_label");
  });
});
