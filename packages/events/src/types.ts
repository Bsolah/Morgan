import type { EventEnvelope } from "@morgan/shared";

export interface EventPublisher {
  publish(topic: string, event: EventEnvelope): Promise<void>;
  subscribe?(topic: string, handler: (event: EventEnvelope) => Promise<void>): void;
  close?(): Promise<void>;
}

export type BronzeWriteResult =
  | { status: "stored"; key: string }
  | { status: "quarantined"; key: string; schema_version: number; reason: string };

export type BronzeListQuery = {
  source: string;
  store_id: string;
  start_date: string;
  end_date: string;
  include_quarantine?: boolean;
};

export type BronzeObjectRef = {
  key: string;
  source: string;
  store_id: string;
  date: string;
  event_id: string;
  quarantined: boolean;
  schema_version?: number;
};

export interface BronzeStorage {
  write(event: EventEnvelope): Promise<BronzeWriteResult>;
  list(query: BronzeListQuery): Promise<BronzeObjectRef[]>;
  read(key: string): Promise<EventEnvelope>;
}

export interface DeadLetterStorage {
  write(topic: string, event: EventEnvelope, error: string, attempts: number): Promise<void>;
}

export interface IdempotencyStore {
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  close?(): Promise<void>;
}

export type OrderProcessor = (event: EventEnvelope) => Promise<void>;

export const ORDER_WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
] as const;

export type OrderWebhookTopic = (typeof ORDER_WEBHOOK_TOPICS)[number];

export const PRODUCT_WEBHOOK_TOPICS = ["products/update", "products/delete"] as const;
export const INVENTORY_WEBHOOK_TOPICS = ["inventory_levels/update"] as const;

export type ProductWebhookTopic = (typeof PRODUCT_WEBHOOK_TOPICS)[number];
export type InventoryWebhookTopic = (typeof INVENTORY_WEBHOOK_TOPICS)[number];

export const SHOPIFY_ORDERS_TOPIC = "shopify.orders";
export const SHOPIFY_PRODUCTS_TOPIC = "shopify.products";
export const SHOPIFY_INVENTORY_TOPIC = "shopify.inventory";

export function isOrderWebhookTopic(topic: string): topic is OrderWebhookTopic {
  return (ORDER_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

export function isProductWebhookTopic(topic: string): topic is ProductWebhookTopic {
  return (PRODUCT_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

export function isInventoryWebhookTopic(topic: string): topic is InventoryWebhookTopic {
  return (INVENTORY_WEBHOOK_TOPICS as readonly string[]).includes(topic);
}

export function mapTopicToEventType(topic: string): string {
  return topic.replace("/", ".");
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
