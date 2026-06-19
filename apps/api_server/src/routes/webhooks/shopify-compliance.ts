import { verifyShopifyWebhookHmac } from "@morgan/integrations";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ShopifyComplianceTopic } from "@morgan/shared";
import { env } from "../../config.js";
import { getDb } from "../../lib/db.js";
import {
  processComplianceWebhook,
  resolveComplianceTopic,
} from "../../lib/shopify-compliance-service.js";

async function handleComplianceWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
  fallbackTopic?: ShopifyComplianceTopic,
): Promise<void> {
  const hmacHeader = request.headers["x-shopify-hmac-sha256"];
  const topicHeader = request.headers["x-shopify-topic"];
  const shopDomain = request.headers["x-shopify-shop-domain"];
  const secret = env.SHOPIFY_API_SECRET;

  if (typeof hmacHeader !== "string" || !secret) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const rawBody = request.rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return reply.status(400).send({ error: "Raw body required" });
  }

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, secret)) {
    return reply.status(401).send({ error: "Invalid HMAC" });
  }

  const topic =
    resolveComplianceTopic(typeof topicHeader === "string" ? topicHeader : undefined, request.url) ??
    fallbackTopic;

  if (!topic) {
    return reply.status(400).send({ error: "Unknown compliance topic" });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    request.log.warn({ topic }, "Compliance webhook body was not valid JSON");
  }

  reply.status(200).send({ received: true, topic });

  setImmediate(async () => {
    try {
      await processComplianceWebhook(getDb(), {
        topic,
        shopDomain: typeof shopDomain === "string" ? shopDomain : null,
        payload,
        receivedAt: new Date(),
      });
    } catch (err) {
      request.log.error({ err, topic }, "Failed to process Shopify compliance webhook");
    }
  });
}

function registerComplianceRoute(
  app: FastifyInstance,
  path: string,
  fallbackTopic?: ShopifyComplianceTopic,
): void {
  app.post(path, { config: { rawBody: true } }, async (request, reply) => {
    await handleComplianceWebhook(request, reply, fallbackTopic);
  });
}

export async function shopifyComplianceWebhookRoutes(app: FastifyInstance) {
  registerComplianceRoute(app, "/webhooks/shopify/compliance");
  registerComplianceRoute(app, "/webhooks/shopify/customers/data_request", "customers/data_request");
  registerComplianceRoute(app, "/webhooks/shopify/customers/redact", "customers/redact");
  registerComplianceRoute(app, "/webhooks/shopify/shop/redact", "shop/redact");
}
