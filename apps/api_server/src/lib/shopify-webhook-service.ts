import { eq } from "drizzle-orm";
import { stores, webhookEvents, type Database } from "@morgan/db";
import type { EventEnvelope } from "@morgan/shared";
import {
  isInventoryWebhookTopic,
  isOrderWebhookTopic,
  isProductWebhookTopic,
  mapTopicToEventType,
  SHOPIFY_INVENTORY_TOPIC,
  SHOPIFY_ORDERS_TOPIC,
  SHOPIFY_PRODUCTS_TOPIC,
  type IdempotencyStore,
  type IngestRuntime,
} from "@morgan/events";
import { evaluateRefundSpikeOnWebhook } from "./refund-spike-alert-engine.js";

const STUB_STORE_ID = "00000000-0000-4000-8000-000000000002";

export type ShopifyWebhookInput = {
  topic: string;
  shopDomain: string | null;
  eventId: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
};

export type ShopifyWebhookResult =
  | { status: "duplicate"; eventId: string }
  | { status: "accepted"; eventId: string; topic: string };

export async function resolveStoreId(
  db: Database | null,
  shopDomain: string | null,
): Promise<string> {
  if (!db || !shopDomain) return STUB_STORE_ID;

  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  return store?.id ?? STUB_STORE_ID;
}

export function buildOrderEnvelope(input: ShopifyWebhookInput, storeId: string): EventEnvelope {
  return {
    event_id: input.eventId,
    event_type: mapTopicToEventType(input.topic),
    store_id: storeId,
    source: "shopify",
    occurred_at: input.receivedAt.toISOString(),
    payload: {
      ...input.payload,
      shop_domain: input.shopDomain,
      topic: input.topic,
    },
    schema_version: 1,
  };
}

export async function claimWebhookEvent(
  idempotency: IdempotencyStore,
  eventId: string,
  ttlSeconds: number,
): Promise<boolean> {
  return idempotency.claim(`shopify-webhook:${eventId}`, ttlSeconds);
}

export async function recordWebhookEvent(
  db: Database | null,
  input: ShopifyWebhookInput,
  storeId: string,
): Promise<void> {
  if (!db) return;

  await db.insert(webhookEvents).values({
    storeId,
    source: "shopify",
    topic: input.topic,
    shopDomain: input.shopDomain,
    externalId: input.eventId,
    payload: input.payload,
    status: "received",
    receivedAt: input.receivedAt,
  });
}

export async function ingestShopifyWebhook(
  runtime: IngestRuntime,
  db: Database | null,
  input: ShopifyWebhookInput,
  options: { idempotencyTtlSeconds: number; skipIdempotencyClaim?: boolean },
): Promise<ShopifyWebhookResult> {
  if (!options.skipIdempotencyClaim) {
    const claimed = await claimWebhookEvent(
      runtime.idempotency,
      input.eventId,
      options.idempotencyTtlSeconds,
    );
    if (!claimed) {
      return { status: "duplicate", eventId: input.eventId };
    }
  }

  const storeId = await resolveStoreId(db, input.shopDomain);
  const envelope = buildOrderEnvelope(input, storeId);
  const kafkaTopic = isOrderWebhookTopic(input.topic)
    ? SHOPIFY_ORDERS_TOPIC
    : isProductWebhookTopic(input.topic)
      ? SHOPIFY_PRODUCTS_TOPIC
      : isInventoryWebhookTopic(input.topic)
        ? SHOPIFY_INVENTORY_TOPIC
        : "shopify.events";

  await runtime.pipeline.ingest(kafkaTopic, envelope);
  await recordWebhookEvent(db, input, storeId);

  if (input.topic === "refunds/create") {
    await evaluateRefundSpikeOnWebhook(db, storeId, input.payload, input.receivedAt);
  }

  return { status: "accepted", eventId: input.eventId, topic: kafkaTopic };
}
