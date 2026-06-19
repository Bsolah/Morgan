import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";
process.env.PLAID_WEBHOOK_SKIP_VERIFY = "true";

const { buildApp } = await import("../../app.js");

describe("plaid webhook routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /webhooks/plaid accepts transaction sync webhooks", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/plaid",
      payload: {
        webhook_type: "TRANSACTIONS",
        webhook_code: "SYNC_UPDATES_AVAILABLE",
        item_id: "item-sandbox-1",
      },
    });

    if (res.statusCode === 503) {
      expect(res.json().error).toContain("not configured");
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });

  it("POST /webhooks/plaid ignores non-transaction webhooks", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/plaid",
      payload: {
        webhook_type: "ITEM",
        webhook_code: "WEBHOOK_UPDATE_ACKNOWLEDGED",
        item_id: "item-sandbox-1",
      },
    });

    if (res.statusCode === 503) return;

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true, ignored: true });
  });
});
