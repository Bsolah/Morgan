import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  resetOutcomeTrackingJobs,
} from "./lib/recommendation-outcome-jobs.js";
import {
  resetRankingFeedbackEvents,
} from "./lib/recommendation-ranking-feedback.js";
import { resetRecommendationState } from "./lib/recommendation-state.js";
import { resetDismissalSuppressions } from "./lib/recommendation-suppression.js";
import {
  consumeConnectToken,
  issueConnectToken,
  resetOAuthStores,
} from "./lib/shopify-oauth-state.js";

process.env.SHOPIFY_API_SECRET = "test-shopify-secret-key-for-hmac";
process.env.SHOPIFY_API_KEY = "test-client-id";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.NODE_ENV = "test";

const { buildApp } = await import("./app.js");
const { computeShopifyHmac } = await import("./routes/webhooks/shopify.js");

describe("Morgan API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetRecommendationState();
    resetOutcomeTrackingJobs();
    resetDismissalSuppressions();
    resetRankingFeedbackEvents();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "morgan-api" });
  });

  it("POST /api/v1/auth/shopify/token-exchange returns tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session", shop_domain: "demo.myshopify.com" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.access_token).toBeTypeOf("string");
    expect(body.refresh_token).toBeTypeOf("string");
    expect(body.shop_domain).toBe("demo.myshopify.com");
  });

  it("POST /api/v1/auth/shopify/token-exchange accepts connect_token", async () => {
    resetOAuthStores();
    const connectToken = issueConnectToken({
      userId: "00000000-0000-4000-8000-000000000010",
      orgId: "00000000-0000-4000-8000-000000000011",
      storeId: "00000000-0000-4000-8000-000000000012",
      shopDomain: "demo.myshopify.com",
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { connect_token: connectToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().shop_domain).toBe("demo.myshopify.com");
    expect(consumeConnectToken(connectToken)).toBeNull();
  });

  it("GET /api/v1/auth/shopify/oauth/start rejects invalid shop", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/shopify/oauth/start?shop=&platform=mobile",
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/v1/auth/shopify/oauth/start redirects to Shopify", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/shopify/oauth/start?shop=demo.myshopify.com&platform=mobile",
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("demo.myshopify.com/admin/oauth/authorize");
  });

  it("GET /api/v1/stores/:storeId/sync/status requires auth", async () => {
    const storeId = "00000000-0000-4000-8000-000000000012";
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${storeId}/sync/status`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/v1/stores/:storeId/recommendations returns ranked open items", async () => {
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token, store_id } = exchange.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${store_id}/recommendations`,
      headers: { authorization: `Bearer ${access_token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.open.length).toBeLessThanOrEqual(5);
    expect(body.open[0]).toMatchObject({
      rank: 1,
      title: expect.any(String),
      impact_low_usd: expect.any(Number),
      effort: expect.stringMatching(/^(low|medium|high)$/),
      confidence: expect.stringMatching(/^(low|medium|high)$/),
      category: expect.any(String),
      expires_at: expect.any(String),
    });
    expect(body.archived_count).toBeGreaterThan(0);
  });

  it("POST accept sets accepted_at and moves item to in_progress", async () => {
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token, store_id } = exchange.json();

    const accept = await app.inject({
      method: "POST",
      url: `/api/v1/stores/${store_id}/recommendations/rec-001/accept`,
      headers: { authorization: `Bearer ${access_token}` },
    });

    expect(accept.statusCode).toBe(200);
    expect(accept.json()).toMatchObject({
      id: "rec-001",
      status: "accepted",
      accepted_at: expect.any(String),
      outcome_job_id: expect.any(String),
    });

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${store_id}/recommendations`,
      headers: { authorization: `Bearer ${access_token}` },
    });

    const body = list.json();
    expect(body.open.some((item: { id: string }) => item.id === "rec-001")).toBe(false);
    expect(body.in_progress.some((item: { id: string }) => item.id === "rec-001")).toBe(true);
  });

  it("POST dismiss records reason and suppresses similar recommendations", async () => {
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token, store_id } = exchange.json();

    const dismiss = await app.inject({
      method: "POST",
      url: `/api/v1/stores/${store_id}/recommendations/rec-001/dismiss`,
      headers: { authorization: `Bearer ${access_token}` },
      payload: { reason: "not_relevant", comment: "We paused this campaign already" },
    });

    expect(dismiss.statusCode).toBe(200);
    expect(dismiss.json()).toMatchObject({
      id: "rec-001",
      status: "dismissed",
      reason: "not_relevant",
      feedback_event_id: expect.any(String),
    });

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${store_id}/recommendations`,
      headers: { authorization: `Bearer ${access_token}` },
    });

    const body = list.json();
    expect(body.open.some((item: { id: string }) => item.id === "rec-001")).toBe(false);
    expect(body.open.some((item: { id: string }) => item.id === "rec-006")).toBe(false);
  });

  it("GET /api/v1/stores/:storeId/recommendations/:id returns detail", async () => {
    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token, store_id } = exchange.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/stores/${store_id}/recommendations/rec-001`,
      headers: { authorization: `Bearer ${access_token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: "rec-001",
      description: expect.any(String),
      evidence: expect.any(Array),
      suggested_deadline: expect.any(String),
      calculation: {
        summary: expect.any(String),
        citations: expect.any(Array),
      },
      related: {
        type: expect.stringMatching(/^(leak|metric)$/),
        label: expect.any(String),
        headline: expect.any(String),
      },
    });
  });

  it("GET /api/v1/auth/me requires bearer token", async () => {
    const unauth = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(unauth.statusCode).toBe(401);

    const exchange = await app.inject({
      method: "POST",
      url: "/api/v1/auth/shopify/token-exchange",
      payload: { session_token: "stub-session" },
    });
    const { access_token } = exchange.json();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${access_token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().store_ids).toHaveLength(1);
  });

  it("POST /webhooks/shopify rejects invalid HMAC", async () => {
    const payload = JSON.stringify({ id: 1 });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "invalid",
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-domain": "demo.myshopify.com",
      },
      payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /webhooks/shopify accepts valid HMAC", async () => {
    const payload = JSON.stringify({ id: 42, total_price: "99.00" });
    const hmac = computeShopifyHmac(payload, process.env.SHOPIFY_API_SECRET!);

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/shopify",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": hmac,
        "x-shopify-topic": "orders/create",
        "x-shopify-shop-domain": "demo.myshopify.com",
        "x-shopify-webhook-id": "550e8400-e29b-41d4-a716-446655440000",
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });
});
