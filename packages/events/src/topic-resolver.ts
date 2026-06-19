import type { EventEnvelope } from "@morgan/shared";
import {
  isInventoryWebhookTopic,
  isOrderWebhookTopic,
  isProductWebhookTopic,
  SHOPIFY_INVENTORY_TOPIC,
  SHOPIFY_ORDERS_TOPIC,
  SHOPIFY_PRODUCTS_TOPIC,
} from "./types.js";

function shopifyTopicFromPayload(event: EventEnvelope): string | null {
  const payload = event.payload as Record<string, unknown>;
  const topic = typeof payload.topic === "string" ? payload.topic : null;
  if (!topic) return null;

  if (isOrderWebhookTopic(topic)) return SHOPIFY_ORDERS_TOPIC;
  if (isProductWebhookTopic(topic)) return SHOPIFY_PRODUCTS_TOPIC;
  if (isInventoryWebhookTopic(topic)) return SHOPIFY_INVENTORY_TOPIC;
  return "shopify.events";
}

function shopifyTopicFromEventType(eventType: string): string {
  if (eventType.startsWith("orders.") || eventType.startsWith("refunds.")) {
    return SHOPIFY_ORDERS_TOPIC;
  }
  if (eventType.startsWith("products.")) return SHOPIFY_PRODUCTS_TOPIC;
  if (eventType.startsWith("inventory_levels.")) return SHOPIFY_INVENTORY_TOPIC;
  return "shopify.events";
}

/** Derives the Kafka topic used when an envelope was originally ingested. */
export function resolveKafkaTopicForEvent(event: EventEnvelope): string {
  if (event.source === "shopify") {
    return shopifyTopicFromPayload(event) ?? shopifyTopicFromEventType(event.event_type);
  }

  if (event.source === "morgan" && event.event_type === "metrics.recalculate_requested") {
    return "metrics.recalculate";
  }

  return `${event.source}.events`;
}
