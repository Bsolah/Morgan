import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrations,
  payoutDepositMatches,
  payoutMatchAuditLog,
  plaidTransactions,
  shopifyPayouts,
} from "@morgan/db";
import { getDb } from "../lib/db.js";
import { ensureStubStoreForTests, STUB_STORE_ID } from "../test/stub-store.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const PLAID_INTEGRATION_ID = "00000000-0000-4000-8000-000000000301";
const TEST_PAYOUT_ID = "00000000-0000-4000-8000-000000000310";
const TEST_DEPOSIT_ID = "00000000-0000-4000-8000-000000000311";

const { buildApp } = await import("../app.js");

async function getAccessToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const exchange = await app.inject({
    method: "POST",
    url: "/api/v1/auth/shopify/token-exchange",
    payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
  });
  return exchange.json().access_token as string;
}

async function seedReconciliationFixtures(db: NonNullable<ReturnType<typeof getDb>>): Promise<void> {
  await ensureStubStoreForTests(db);

  await db
    .insert(integrations)
    .values({
      id: PLAID_INTEGRATION_ID,
      storeId: STUB_STORE_ID,
      provider: "plaid",
      status: "connected",
    })
    .onConflictDoNothing();

  await db
    .insert(shopifyPayouts)
    .values({
      id: TEST_PAYOUT_ID,
      storeId: STUB_STORE_ID,
      shopifyPayoutId: "payout-test-001",
      issuedAt: new Date("2026-06-10T12:00:00.000Z"),
      netAmount: "1250.0000",
      currency: "USD",
      status: "paid",
    })
    .onConflictDoNothing();

  await db
    .insert(plaidTransactions)
    .values({
      id: TEST_DEPOSIT_ID,
      storeId: STUB_STORE_ID,
      integrationId: PLAID_INTEGRATION_ID,
      plaidTransactionId: "txn-test-001",
      plaidAccountId: "acct-test-001",
      transactionDate: "2026-06-12",
      amount: "1248.7500",
      currency: "USD",
      name: "Shopify payout deposit",
      category: "shopify_payout",
      pending: false,
      removed: false,
    })
    .onConflictDoNothing();

  await db
    .delete(payoutDepositMatches)
    .where(
      and(
        eq(payoutDepositMatches.storeId, STUB_STORE_ID),
        eq(payoutDepositMatches.shopifyPayoutRowId, TEST_PAYOUT_ID),
      ),
    );
}

describe("cash match routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    const db = getDb();
    if (db) {
      await seedReconciliationFixtures(db);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/cash/unmatched requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cash/unmatched" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/cash/unmatched lists unmatched payouts and deposits", async () => {
    const token = await getAccessToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/cash/unmatched",
      headers: { authorization: `Bearer ${token}` },
    });

    if (res.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(res.json().code);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      unmatched_payouts: expect.any(Array),
      unmatched_deposits: expect.any(Array),
      matched: expect.any(Array),
    });
  });

  it("POST /api/v1/cash/matches/link logs manual link audit entry", async () => {
    const db = getDb();
    if (!db) return;

    const token = await getAccessToken(app);
    const linkRes = await app.inject({
      method: "POST",
      url: "/api/v1/cash/matches/link",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        shopify_payout_id: TEST_PAYOUT_ID,
        plaid_transaction_id: TEST_DEPOSIT_ID,
      },
    });

    if (linkRes.statusCode === 503) {
      expect(["not_configured", "not_ready"]).toContain(linkRes.json().code);
      return;
    }

    expect(linkRes.statusCode).toBe(200);

    const [auditRow] = await db
      .select()
      .from(payoutMatchAuditLog)
      .where(
        and(
          eq(payoutMatchAuditLog.storeId, STUB_STORE_ID),
          eq(payoutMatchAuditLog.shopifyPayoutRowId, TEST_PAYOUT_ID),
          eq(payoutMatchAuditLog.plaidTransactionRowId, TEST_DEPOSIT_ID),
          eq(payoutMatchAuditLog.action, "link"),
        ),
      )
      .orderBy(desc(payoutMatchAuditLog.createdAt))
      .limit(1);

    expect(auditRow).toBeTruthy();
    expect(auditRow?.source).toBe("manual");

    const matchId = linkRes.json().matched?.[0]?.id as string | undefined;
    if (!matchId) return;

    const unlinkRes = await app.inject({
      method: "POST",
      url: "/api/v1/cash/matches/unlink",
      headers: { authorization: `Bearer ${token}` },
      payload: { match_id: matchId },
    });

    expect(unlinkRes.statusCode).toBe(200);

    const [unlinkAudit] = await db
      .select()
      .from(payoutMatchAuditLog)
      .where(
        and(
          eq(payoutMatchAuditLog.storeId, STUB_STORE_ID),
          eq(payoutMatchAuditLog.matchId, matchId),
          eq(payoutMatchAuditLog.action, "unlink"),
        ),
      )
      .orderBy(desc(payoutMatchAuditLog.createdAt))
      .limit(1);

    expect(unlinkAudit).toBeTruthy();
    expect(unlinkAudit?.source).toBe("manual");
  });
});
