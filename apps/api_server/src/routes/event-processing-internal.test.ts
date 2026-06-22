import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";
process.env.COMPLIANCE_INTERNAL_KEY = "test-internal-key";

const { buildApp } = await import("../app.js");

describe("event processing internal metrics", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/internal/events/processing-metrics requires internal key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/internal/events/processing-metrics",
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/internal/events/processing-metrics returns topic metrics snapshot", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/internal/events/processing-metrics",
      headers: { "x-compliance-internal-key": "test-internal-key" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: expect.stringMatching(/^(ok|runtime_not_initialized)$/),
      updated_at: expect.any(String),
      topics: expect.any(Array),
    });
  });
});
