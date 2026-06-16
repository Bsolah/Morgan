import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { verifyShopifyWebhookHmac } from "@morgan/integrations";
import { eventEnvelopeSchema } from "@morgan/shared";
import { env } from "../../config.js";
import { eventPipeline } from "../../lib/events.js";

const STUB_STORE_ID = "00000000-0000-4000-8000-000000000002";

const ORDER_TOPICS = new Set([
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
]);

function mapTopicToEventType(topic: string): string {
  return topic.replace("/", ".");
}

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

      const envelope = eventEnvelopeSchema.parse({
        event_id: eventId,
        event_type: mapTopicToEventType(topic),
        store_id: STUB_STORE_ID,
        source: "shopify",
        occurred_at: new Date().toISOString(),
        payload: {
          topic,
          shop_domain: typeof shopDomain === "string" ? shopDomain : null,
          data: payload,
        },
        schema_version: 1,
      });

      const kafkaTopic = ORDER_TOPICS.has(topic) ? "shopify.orders" : "shopify.events";

      // Respond within 5s — process async after ack
      reply.status(200).send({ received: true, event_id: eventId });

      eventPipeline.ingest(kafkaTopic, envelope).catch((err) => {
        request.log.error({ err, topic, eventId }, "Failed to ingest Shopify webhook");
      });
    },
  );

  // Compliance topics route to same handler in skeleton (app/uninstalled, GDPR)
  app.post(
    "/webhooks/shopify/compliance",
    { config: { rawBody: true } },
    async (request, reply) => {
      const hmacHeader = request.headers["x-shopify-hmac-sha256"];
      const topic = request.headers["x-shopify-topic"];
      const secret = env.SHOPIFY_API_SECRET;

      if (typeof hmacHeader !== "string" || typeof topic !== "string" || !secret) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rawBody = request.rawBody;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        return reply.status(400).send({ error: "Raw body required" });
      }

      if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, secret)) {
        return reply.status(401).send({ error: "Invalid HMAC" });
      }

      request.log.info({ topic }, "Shopify compliance webhook received (stub)");

      return reply.status(200).send({ received: true, topic });
    },
  );
}

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
