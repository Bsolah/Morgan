import { and, eq, inArray } from "drizzle-orm";
import {
  chatMessages,
  customerDataRequests,
  integrationCredentials,
  integrations,
  orderBackfillJobs,
  productCatalogSyncJobs,
  shopDataPurgeJobs,
  stores,
  subscriptions,
  webhookEvents,
  type Database,
} from "@morgan/db";
import type { ShopifyComplianceTopic } from "@morgan/shared";
import { env } from "../config.js";
import {
  extractCustomerFromCompliancePayload,
  normalizeEmail,
  payloadMatchesCustomer,
  redactWebhookPayload,
} from "./customer-pii.js";
import { purgeStoreData } from "./compliance-purge-service.js";

const ACTIVE_BACKFILL_STATUSES = ["pending", "bulk_running", "processing"] as const;
const ACTIVE_CATALOG_STATUSES = ["pending", "syncing"] as const;

export type ComplianceWebhookInput = {
  topic: ShopifyComplianceTopic;
  shopDomain: string | null;
  payload: Record<string, unknown>;
  receivedAt: Date;
};

export function resolveComplianceTopic(
  topicHeader: string | undefined,
  path: string,
): ShopifyComplianceTopic | null {
  if (topicHeader === "app/uninstalled") return "app/uninstalled";
  if (topicHeader === "customers/data_request") return "customers/data_request";
  if (topicHeader === "customers/redact") return "customers/redact";
  if (topicHeader === "shop/redact") return "shop/redact";

  if (path.endsWith("/customers/data_request")) return "customers/data_request";
  if (path.endsWith("/customers/redact")) return "customers/redact";
  if (path.endsWith("/shop/redact")) return "shop/redact";

  return null;
}

export async function findStoreByShopDomain(
  db: Database,
  shopDomain: string,
): Promise<{ id: string; status: string } | null> {
  const [store] = await db
    .select({ id: stores.id, status: stores.status })
    .from(stores)
    .where(eq(stores.shopDomain, shopDomain))
    .limit(1);

  return store ?? null;
}

export async function revokeShopifyTokens(db: Database, storeId: string): Promise<void> {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "shopify")))
    .limit(1);

  if (!integration) return;

  await db
    .delete(integrationCredentials)
    .where(eq(integrationCredentials.integrationId, integration.id));

  await db
    .update(integrations)
    .set({ status: "disconnected" })
    .where(eq(integrations.id, integration.id));
}

export async function cancelStoreJobs(db: Database, storeId: string): Promise<void> {
  await db
    .update(orderBackfillJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(orderBackfillJobs.storeId, storeId),
        inArray(orderBackfillJobs.status, [...ACTIVE_BACKFILL_STATUSES]),
      ),
    );

  await db
    .update(productCatalogSyncJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(productCatalogSyncJobs.storeId, storeId),
        inArray(productCatalogSyncJobs.status, [...ACTIVE_CATALOG_STATUSES]),
      ),
    );

  await db
    .update(subscriptions)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptions.storeId, storeId), eq(subscriptions.status, "active")));
}

export async function handleAppUninstalled(db: Database, shopDomain: string | null): Promise<void> {
  if (!shopDomain) return;

  const store = await findStoreByShopDomain(db, shopDomain);
  if (!store) return;

  await revokeShopifyTokens(db, store.id);
  await cancelStoreJobs(db, store.id);

  await db
    .update(stores)
    .set({ status: "uninstalled", updatedAt: new Date() })
    .where(eq(stores.id, store.id));
}

export async function scheduleShopRedact(db: Database, shopDomain: string | null): Promise<void> {
  if (!shopDomain) return;

  const store = await findStoreByShopDomain(db, shopDomain);
  if (!store) return;

  await revokeShopifyTokens(db, store.id);
  await cancelStoreJobs(db, store.id);

  const now = new Date();
  const purgeDueBy = new Date(now);
  purgeDueBy.setUTCDate(purgeDueBy.getUTCDate() + env.SHOP_REDACT_RETENTION_DAYS);

  await db
    .insert(shopDataPurgeJobs)
    .values({
      storeId: store.id,
      status: "soft_deleted",
      softDeletedAt: now,
      purgeDueBy,
    })
    .onConflictDoUpdate({
      target: shopDataPurgeJobs.storeId,
      set: {
        status: "soft_deleted",
        softDeletedAt: now,
        purgeDueBy,
        purgedAt: null,
        updatedAt: now,
      },
    });

  await db
    .update(stores)
    .set({ status: "uninstalled", updatedAt: now })
    .where(eq(stores.id, store.id));
}

export async function collectCustomerDataExport(
  db: Database,
  storeId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const customer = extractCustomerFromCompliancePayload(payload);
  const ordersRequested = Array.isArray(payload.orders_requested)
    ? (payload.orders_requested as Array<Record<string, unknown>>)
    : [];

  const events = await db
    .select({
      id: webhookEvents.id,
      topic: webhookEvents.topic,
      payload: webhookEvents.payload,
      receivedAt: webhookEvents.receivedAt,
    })
    .from(webhookEvents)
    .where(eq(webhookEvents.storeId, storeId));

  const matchingEvents = events
    .filter((event) => payloadMatchesCustomer(event.payload, customer))
    .map((event) => ({
      topic: event.topic,
      received_at: event.receivedAt.toISOString(),
      payload: event.payload,
    }));

  const chatRows = (
    await db.select().from(chatMessages).where(eq(chatMessages.storeId, storeId))
  ).filter(
    (message) =>
      (customer.id != null && message.shopifyCustomerId === String(customer.id)) ||
      normalizeEmail(message.customerEmail) === normalizeEmail(customer.email),
  );

  return {
    exported_at: new Date().toISOString(),
    store_id: storeId,
    shopify_customer: customer,
    data_request_id:
      (payload.data_request as Record<string, unknown> | undefined)?.id ?? null,
    orders_requested: ordersRequested,
    webhook_events: matchingEvents,
    chat_messages: chatRows.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt.toISOString(),
    })),
  };
}

export async function handleCustomerDataRequest(
  db: Database,
  shopDomain: string | null,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!shopDomain) return null;

  const store = await findStoreByShopDomain(db, shopDomain);
  if (!store) return null;

  const customer = extractCustomerFromCompliancePayload(payload);
  const exportJson = await collectCustomerDataExport(db, store.id, payload);
  const dataRequestId =
    (payload.data_request as Record<string, unknown> | undefined)?.id != null
      ? String((payload.data_request as Record<string, unknown>).id)
      : null;

  const [row] = await db
    .insert(customerDataRequests)
    .values({
      storeId: store.id,
      shopifyCustomerId: customer.id != null ? String(customer.id) : null,
      customerEmail: normalizeEmail(customer.email),
      dataRequestId,
      ordersRequested: Array.isArray(payload.orders_requested)
        ? (payload.orders_requested as Array<Record<string, unknown>>)
        : [],
      exportJson,
      status: "completed",
      completedAt: new Date(),
    })
    .returning({ id: customerDataRequests.id });

  return row.id;
}

export async function handleCustomerRedact(
  db: Database,
  shopDomain: string | null,
  payload: Record<string, unknown>,
): Promise<{ webhookEvents: number; chatMessages: number }> {
  if (!shopDomain) return { webhookEvents: 0, chatMessages: 0 };

  const store = await findStoreByShopDomain(db, shopDomain);
  if (!store) return { webhookEvents: 0, chatMessages: 0 };

  const customer = extractCustomerFromCompliancePayload(payload);
  const events = await db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.storeId, store.id));

  let webhookCount = 0;
  for (const event of events) {
    if (!payloadMatchesCustomer(event.payload, customer)) continue;
    await db
      .update(webhookEvents)
      .set({ payload: redactWebhookPayload(event.payload) })
      .where(eq(webhookEvents.id, event.id));
    webhookCount += 1;
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.storeId, store.id));

  let chatCount = 0;
  for (const message of messages) {
    const matches =
      (customer.id != null && message.shopifyCustomerId === String(customer.id)) ||
      normalizeEmail(message.customerEmail) === normalizeEmail(customer.email);
    if (!matches) continue;

    await db
      .update(chatMessages)
      .set({
        content: "[REDACTED]",
        customerEmail: null,
        shopifyCustomerId: null,
        redactedAt: new Date(),
      })
      .where(eq(chatMessages.id, message.id));
    chatCount += 1;
  }

  return { webhookEvents: webhookCount, chatMessages: chatCount };
}

export async function processComplianceWebhook(
  db: Database | null,
  input: ComplianceWebhookInput,
): Promise<void> {
  if (!db) return;

  switch (input.topic) {
    case "app/uninstalled":
      await handleAppUninstalled(db, input.shopDomain);
      break;
    case "shop/redact":
      await scheduleShopRedact(db, input.shopDomain);
      break;
    case "customers/data_request":
      await handleCustomerDataRequest(db, input.shopDomain, input.payload);
      break;
    case "customers/redact":
      await handleCustomerRedact(db, input.shopDomain, input.payload);
      break;
  }
}

export async function processDueShopPurges(db: Database): Promise<number> {
  const jobs = await db.select().from(shopDataPurgeJobs).where(eq(shopDataPurgeJobs.status, "soft_deleted"));

  let purged = 0;
  const now = new Date();

  for (const job of jobs) {
    if (job.purgeDueBy > now) continue;

    await db
      .update(shopDataPurgeJobs)
      .set({ status: "purging", updatedAt: now })
      .where(eq(shopDataPurgeJobs.id, job.id));

    await purgeStoreData(db, job.storeId);

    await db
      .update(shopDataPurgeJobs)
      .set({ status: "completed", purgedAt: now, updatedAt: now })
      .where(eq(shopDataPurgeJobs.id, job.id));

    purged += 1;
  }

  return purged;
}
