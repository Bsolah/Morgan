import { and, desc, eq } from "drizzle-orm";
import {
  integrations,
  orderBackfillJobs,
  productCatalogSyncJobs,
  stores,
  type Database,
} from "@morgan/db";

export type ShopifyIntegrationCard = {
  provider: "shopify";
  status: "connected" | "syncing" | "error" | "disconnected";
  shop_domain: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  orders_sync_completed: boolean;
  partial_brief_available: boolean;
  products_sync_completed: boolean;
};

export async function getShopifyIntegrationForStore(
  db: Database,
  storeId: string,
): Promise<ShopifyIntegrationCard> {
  const [store] = await db
    .select({
      shopDomain: stores.shopDomain,
      storeStatus: stores.status,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) {
    return {
      provider: "shopify",
      status: "disconnected",
      shop_domain: null,
      last_sync_at: null,
      error_message: null,
      orders_sync_completed: false,
      partial_brief_available: false,
      products_sync_completed: false,
    };
  }

  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "shopify")))
    .limit(1);

  const [backfillJob] = await db
    .select({
      status: orderBackfillJobs.status,
      partialBriefAvailable: orderBackfillJobs.partialBriefAvailable,
      error: orderBackfillJobs.error,
      completedAt: orderBackfillJobs.completedAt,
      updatedAt: orderBackfillJobs.updatedAt,
    })
    .from(orderBackfillJobs)
    .where(eq(orderBackfillJobs.storeId, storeId))
    .orderBy(desc(orderBackfillJobs.startedAt))
    .limit(1);

  const [catalogJob] = await db
    .select({
      status: productCatalogSyncJobs.status,
      error: productCatalogSyncJobs.error,
      completedAt: productCatalogSyncJobs.completedAt,
      updatedAt: productCatalogSyncJobs.updatedAt,
    })
    .from(productCatalogSyncJobs)
    .where(eq(productCatalogSyncJobs.storeId, storeId))
    .orderBy(desc(productCatalogSyncJobs.startedAt))
    .limit(1);

  const ordersSyncCompleted = backfillJob?.status === "completed";
  const productsSyncCompleted = catalogJob?.status === "completed";
  const status =
    integration?.status ??
    (store.storeStatus === "syncing"
      ? "syncing"
      : store.storeStatus === "suspended" || store.storeStatus === "uninstalled"
        ? "error"
        : "connected");

  const lastSyncAt =
    integration?.lastSyncAt ??
    backfillJob?.completedAt ??
    catalogJob?.completedAt ??
    backfillJob?.updatedAt ??
    catalogJob?.updatedAt ??
    null;

  return {
    provider: "shopify",
    status,
    shop_domain: store.shopDomain,
    last_sync_at: lastSyncAt?.toISOString() ?? null,
    error_message: backfillJob?.error ?? catalogJob?.error ?? null,
    orders_sync_completed: ordersSyncCompleted,
    partial_brief_available: backfillJob?.partialBriefAvailable ?? false,
    products_sync_completed: productsSyncCompleted,
  };
}
