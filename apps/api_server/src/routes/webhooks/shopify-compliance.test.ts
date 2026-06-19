import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const processComplianceWebhook = vi.fn(async () => undefined);

vi.mock("../../lib/shopify-compliance-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/shopify-compliance-service.js")>();
  return {
    ...actual,
    processComplianceWebhook,
  };
});

const { buildApp } = await import("../../app.js");
const { computeShopifyHmac } = await import("./shopify.js");

describe("Shopify compliance webhooks", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    processComplianceWebhook.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  function postCompliance(
    path: string,
    body: Record<string, unknown>,
    topic?: string,
    shopDomain = "demo.myshopify.com",
  ) {
    const payload = JSON.stringify(body);
    const hmac = computeShopifyHmac(payload, process.env.SHOPIFY_API_SECRET!);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-shop-domain": shopDomain,
    };
    if (topic) {
      headers["x-shopify-topic"] = topic;
    }

    return app.inject({
      method: "POST",
      url: path,
      headers,
      payload,
    });
  }

  it("returns 401 for invalid HMAC", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify/compliance",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "invalid",
        "x-shopify-topic": "app/uninstalled",
      },
      payload: JSON.stringify({}),
    });

    expect(res.statusCode).toBe(401);
  });

  it("accepts app/uninstalled with valid HMAC", async () => {
    const res = await postCompliance("/webhooks/shopify/compliance", {}, "app/uninstalled");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true, topic: "app/uninstalled" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(processComplianceWebhook).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        topic: "app/uninstalled",
        shopDomain: "demo.myshopify.com",
      }),
    );
  });

  it("accepts customers/data_request on dedicated path", async () => {
    const body = {
      shop_id: 1,
      customer: { id: 42, email: "buyer@example.com" },
      data_request: { id: 99 },
      orders_requested: [{ id: 1001 }],
    };
    const res = await postCompliance("/webhooks/shopify/customers/data_request", body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true, topic: "customers/data_request" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(processComplianceWebhook).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        topic: "customers/data_request",
        payload: expect.objectContaining({
          customer: expect.objectContaining({ id: 42 }),
        }),
      }),
    );
  });

  it("accepts customers/redact with valid HMAC", async () => {
    const body = {
      shop_id: 1,
      customer: { id: 42, email: "buyer@example.com" },
    };
    const res = await postCompliance(
      "/webhooks/shopify/compliance",
      body,
      "customers/redact",
    );
    expect(res.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(processComplianceWebhook).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ topic: "customers/redact" }),
    );
  });

  it("accepts shop/redact on dedicated path", async () => {
    const res = await postCompliance("/webhooks/shopify/shop/redact", { shop_id: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true, topic: "shop/redact" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(processComplianceWebhook).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ topic: "shop/redact" }),
    );
  });
});
