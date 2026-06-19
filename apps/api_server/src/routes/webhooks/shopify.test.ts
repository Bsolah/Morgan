import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";
process.env.BRONZE_STORAGE_PATH = "./data/bronze-test";
process.env.DEAD_LETTER_STORAGE_PATH = "./data/dead-letter-test";
process.env.CLICKHOUSE_STORAGE_PATH = "./data/clickhouse-test";
process.env.KAFKA_ENABLED = "false";

const { buildApp } = await import("../../app.js");
const { computeShopifyHmac } = await import("./shopify.js");
const { SHOPIFY_ORDERS_TOPIC, SHOPIFY_PRODUCTS_TOPIC, SHOPIFY_INVENTORY_TOPIC } = await import(
  "@morgan/events"
);
const { getInMemoryPublisher, resetIngestRuntimeForTests } = await import(
  "../../lib/ingest-runtime.js"
);

describe("Shopify order webhooks", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetIngestRuntimeForTests();
    getInMemoryPublisher()?.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  function postWebhook(body: Record<string, unknown>, webhookId: string, topic = "orders/create") {
    const payload = JSON.stringify(body);
    const hmac = computeShopifyHmac(payload, process.env.SHOPIFY_API_SECRET!);
    return app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": topic,
        "x-shopify-shop-domain": "demo.myshopify.com",
        "x-shopify-webhook-id": webhookId,
      },
      payload,
    });
  }

  it("rejects invalid HMAC with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "invalid",
        "x-shopify-topic": "orders/create",
      },
      payload: JSON.stringify({ id: 1 }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts valid order webhooks and publishes to shopify.orders", async () => {
    const webhookId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await postWebhook({ id: 42, total_price: "99.00" }, webhookId);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true, event_id: webhookId });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const publisher = getInMemoryPublisher();
    expect(publisher?.events).toHaveLength(1);
    expect(publisher?.events[0]?.topic).toBe(SHOPIFY_ORDERS_TOPIC);
    expect(publisher?.events[0]?.event).toMatchObject({
      event_id: webhookId,
      store_id: expect.any(String),
      occurred_at: expect.any(String),
      payload: expect.objectContaining({ id: 42 }),
    });
  });

  it("ignores duplicate event_id within 24h", async () => {
    const webhookId = "550e8400-e29b-41d4-a716-446655440010";
    const first = await postWebhook({ id: 99 }, webhookId);
    const second = await postWebhook({ id: 99 }, webhookId);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ duplicate: true });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const publisher = getInMemoryPublisher();
    expect(publisher?.events).toHaveLength(1);
  });

  it.each(["orders/create", "orders/updated", "orders/cancelled", "refunds/create"])(
    "routes %s to shopify.orders",
    async (topic) => {
      const webhookId = `550e8400-e29b-41d4-a716-44665544${topic.length}001`;
      await postWebhook({ id: 1 }, webhookId, topic);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const publisher = getInMemoryPublisher();
      const match = publisher?.events.find((entry) => entry.event.event_id === webhookId);
      expect(match?.topic).toBe(SHOPIFY_ORDERS_TOPIC);
    },
  );

  it.each(["products/update", "products/delete"])("routes %s to shopify.products", async (topic) => {
    const webhookId = `550e8400-e29b-41d4-a716-44665544${topic.length}002`;
    await postWebhook(
      {
        id: 10,
        title: "Blue Tee",
        status: "ACTIVE",
        variants: [{ id: 20, sku: "BLUE-M", price: "29.00" }],
      },
      webhookId,
      topic,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const publisher = getInMemoryPublisher();
    const match = publisher?.events.find((entry) => entry.event.event_id === webhookId);
    expect(match?.topic).toBe(SHOPIFY_PRODUCTS_TOPIC);
  });

  it("routes inventory_levels/update to shopify.inventory", async () => {
    const webhookId = "550e8400-e29b-41d4-a716-446655440099";
    await postWebhook(
      { inventory_item_id: 55, location_id: 1, available: 12 },
      webhookId,
      "inventory_levels/update",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const publisher = getInMemoryPublisher();
    const match = publisher?.events.find((entry) => entry.event.event_id === webhookId);
    expect(match?.topic).toBe(SHOPIFY_INVENTORY_TOPIC);
  });
});
