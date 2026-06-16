import { z } from "zod";

export const eventEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string(),
  store_id: z.string().uuid(),
  source: z.enum(["shopify", "meta", "plaid", "quickbooks", "google_ads", "xero"]),
  occurred_at: z.string().datetime(),
  payload: z.record(z.unknown()),
  schema_version: z.number().int().default(1),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export const shopifyWebhookTopics = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
  "products/update",
  "inventory_levels/update",
  "app/uninstalled",
] as const;

export type ShopifyWebhookTopic = (typeof shopifyWebhookTopics)[number];
