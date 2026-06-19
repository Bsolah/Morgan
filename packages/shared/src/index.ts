import { z } from "zod";

/** Current envelope schema version written by Morgan producers. */
export const CURRENT_EVENT_SCHEMA_VERSION = 1;

/** Schema versions the ingest pipeline accepts for Kafka publish + silver processing. */
export const SUPPORTED_EVENT_SCHEMA_VERSIONS = [CURRENT_EVENT_SCHEMA_VERSION] as const;

/** Bronze layer retention policy (S3 lifecycle / compliance). */
export const BRONZE_RETENTION_MONTHS = 24;

export const eventEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string(),
  store_id: z.string().uuid(),
  source: z.enum(["shopify", "meta", "plaid", "quickbooks", "google_ads", "xero", "morgan"]),
  occurred_at: z.string().datetime(),
  payload: z.record(z.unknown()),
  schema_version: z.number().int().default(1),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export function isSupportedEventSchemaVersion(schemaVersion: number): boolean {
  return (SUPPORTED_EVENT_SCHEMA_VERSIONS as readonly number[]).includes(schemaVersion);
}

export function parseEventEnvelope(raw: unknown): EventEnvelope {
  return eventEnvelopeSchema.parse(raw);
}

export const shopifyWebhookTopics = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
  "products/update",
  "products/delete",
  "inventory_levels/update",
  "app/uninstalled",
] as const;

export const shopifyComplianceTopics = [
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export type ShopifyComplianceTopic = (typeof shopifyComplianceTopics)[number];

export type ShopifyWebhookTopic = (typeof shopifyWebhookTopics)[number];
