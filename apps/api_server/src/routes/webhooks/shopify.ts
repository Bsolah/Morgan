import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { verifyShopifyWebhookHmac } from "@morgan/integrations";
import { ORDER_WEBHOOK_TOPICS } from "@morgan/events";
import { env } from "../../config.js";
import { getDb } from "../../lib/db.js";
import { getIngestRuntime } from "../../lib/ingest-runtime.js";
import {
  claimWebhookEvent,
  ingestShopifyWebhook,
  type ShopifyWebhookInput,
} from "../../lib/shopify-webhook-service.js";

export async function shopifyWebhookRoutes(app: FastifyInstance) {
  app.post(
    "/webhooks/shopify",
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const hmacHeader = request.headers["x-shopify-hmac-sha256"];
      const topic = request.headers["x-shopify-topic"];
      const shopDomain = request.headers["x-shopify-shop-domain"];
      const webhookId = request.headers["x-shopify-webhook-id"];

      if (typeof hmacHeader !== "string" || typeof topic !== "string") {
        return reply.status(401).send({ error: "Missing Shopify webhook headers" });
      }

      const secret = env.SHOPIFY_API_SECRET;
      if (!secret) {
        return reply.status(500).send({ error: "SHOPIFY_API_SECRET not configured" });
      }

      const rawBody = request.rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        return reply.status(400).send({ error: "Raw body required for HMAC validation" });
      }

      if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, secret)) {
        return reply.status(401).send({ error: "Invalid HMAC" });
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
      } catch {
        return reply.status(400).send({ error: "Invalid JSON payload" });
      }

      const eventId =
        typeof webhookId === "string" && webhookId.length > 0 ? webhookId : randomUUID();

      const runtime = await getIngestRuntime();
      const claimed = await claimWebhookEvent(
        runtime.idempotency,
        eventId,
        env.WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
      );

      if (!claimed) {
        return reply.status(200).send({ received: true, event_id: eventId, duplicate: true });
      }

      const input: ShopifyWebhookInput = {
        topic,
        shopDomain: typeof shopDomain === "string" ? shopDomain : null,
        eventId,
        payload,
        receivedAt: new Date(),
      };

      reply.status(200).send({ received: true, event_id: eventId });

      setImmediate(async () => {
        try {
          await ingestShopifyWebhook(runtime, getDb(), input, {
            idempotencyTtlSeconds: env.WEBHOOK_IDEMPOTENCY_TTL_SECONDS,
            skipIdempotencyClaim: true,
          });
        } catch (err) {
          request.log.error({ err, topic, eventId }, "Failed to ingest Shopify webhook");
        }
      });
    },
  );
}

export const SHOPIFY_ORDER_WEBHOOK_TOPICS = ORDER_WEBHOOK_TOPICS;

/** Test helper — compute HMAC for integration tests */
export function computeShopifyHmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

export function hmacMatches(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
