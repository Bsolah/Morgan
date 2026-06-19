import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import {
  integrationCredentials,
  integrations,
  productCatalogSyncJobs,
  stores,
  type Database,
} from "@morgan/db";
import {
  decryptSecret,
  fetchInventoryLevelsPage,
  fetchProductCatalogPage,
  flattenInventoryLevels,
  flattenProductVariants,
} from "@morgan/integrations";
import { mapGraphqlVariantToDimProduct } from "@morgan/warehouse";
import { env } from "../config.js";
import { getIngestRuntime } from "./ingest-runtime.js";

const ACTIVE_JOB_STATUSES = ["pending", "syncing"] as const;

export type CatalogSyncStatus = {
  status: "pending" | "syncing" | "completed" | "failed" | "idle";
  label: string;
  processed_count: number;
  total_count: number | null;
  progress_percent: number | null;
  last_inventory_poll_at: string | null;
  error: string | null;
};

export function formatCatalogSyncLabel(processed: number, status: string): string {
  if (status === "completed") {
    return "Product catalog synced";
  }
  return `Syncing products… ${processed.toLocaleString("en-US")}`;
}

async function getShopifyAccessToken(db: Database, storeId: string): Promise<{
  shopDomain: string;
  accessToken: string;
}> {
  const [row] = await db
    .select({
      shopDomain: stores.shopDomain,
      encryptedPayload: integrationCredentials.encryptedPayload,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .innerJoin(stores, eq(stores.id, integrations.storeId))
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "shopify")))
    .limit(1);

  if (!row) {
    throw new Error("Shopify integration not found for store");
  }

  const payload = JSON.parse(decryptSecret(row.encryptedPayload, env.ENCRYPTION_KEY)) as {
    access_token: string;
  };

  return {
    shopDomain: row.shopDomain,
    accessToken: payload.access_token,
  };
}

export async function enqueueProductCatalogSync(
  db: Database,
  storeId: string,
  syncRunId?: string,
): Promise<string> {
  const [existing] = await db
    .select()
    .from(productCatalogSyncJobs)
    .where(
      and(
        eq(productCatalogSyncJobs.storeId, storeId),
        inArray(productCatalogSyncJobs.status, [...ACTIVE_JOB_STATUSES, "failed"]),
      ),
    )
    .orderBy(desc(productCatalogSyncJobs.startedAt))
    .limit(1);

  if (existing && ACTIVE_JOB_STATUSES.includes(existing.status as (typeof ACTIVE_JOB_STATUSES)[number])) {
    return existing.id;
  }

  if (existing?.status === "failed") {
    await db
      .update(productCatalogSyncJobs)
      .set({
        status: existing.productsCursor ? "syncing" : "pending",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(productCatalogSyncJobs.id, existing.id));
    return existing.id;
  }

  const [job] = await db
    .insert(productCatalogSyncJobs)
    .values({
      storeId,
      syncRunId: syncRunId ?? null,
      status: "pending",
    })
    .returning({ id: productCatalogSyncJobs.id });

  return job.id;
}

export async function getCatalogSyncStatus(db: Database, storeId: string): Promise<CatalogSyncStatus> {
  const [job] = await db
    .select()
    .from(productCatalogSyncJobs)
    .where(eq(productCatalogSyncJobs.storeId, storeId))
    .orderBy(desc(productCatalogSyncJobs.startedAt))
    .limit(1);

  if (!job) {
    return {
      status: "idle",
      label: "Waiting to sync products",
      processed_count: 0,
      total_count: null,
      progress_percent: null,
      last_inventory_poll_at: null,
      error: null,
    };
  }

  const progressPercent =
    job.totalCount && job.totalCount > 0
      ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 1000) / 10)
      : null;

  return {
    status: job.status as CatalogSyncStatus["status"],
    label: formatCatalogSyncLabel(job.processedCount, job.status),
    processed_count: job.processedCount,
    total_count: job.totalCount,
    progress_percent: progressPercent,
    last_inventory_poll_at: job.lastInventoryPollAt?.toISOString() ?? null,
    error: job.error,
  };
}

export async function processProductCatalogSyncJobs(db: Database): Promise<void> {
  const jobs = await db
    .select()
    .from(productCatalogSyncJobs)
    .where(inArray(productCatalogSyncJobs.status, [...ACTIVE_JOB_STATUSES]))
    .orderBy(productCatalogSyncJobs.startedAt)
    .limit(5);

  for (const job of jobs) {
    try {
      await syncProductCatalogJob(db, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Catalog sync failed";
      await db
        .update(productCatalogSyncJobs)
        .set({
          status: "failed",
          error: message,
          updatedAt: new Date(),
        })
        .where(eq(productCatalogSyncJobs.id, job.id));
    }
  }
}

async function syncProductCatalogJob(db: Database, jobId: string): Promise<void> {
  const [job] = await db
    .select()
    .from(productCatalogSyncJobs)
    .where(eq(productCatalogSyncJobs.id, jobId))
    .limit(1);

  if (!job || !ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number])) {
    return;
  }

  const { shopDomain, accessToken } = await getShopifyAccessToken(db, job.storeId);
  const runtime = await getIngestRuntime();
  const occurredAt = new Date().toISOString();

  if (job.status === "pending") {
    await db
      .update(productCatalogSyncJobs)
      .set({ status: "syncing", updatedAt: new Date() })
      .where(eq(productCatalogSyncJobs.id, job.id));
  }

  let cursor = job.productsCursor;
  let processed = job.processedCount;
  const page = await fetchProductCatalogPage(shopDomain, accessToken, cursor);
  const variants = flattenProductVariants(page);

  for (const { product, variant } of variants) {
    const row = mapGraphqlVariantToDimProduct({
      storeId: job.storeId,
      productId: String(product.id),
      productTitle: String(product.title ?? "Product"),
      productStatus: String(product.status ?? "ACTIVE"),
      variant,
      occurredAt,
    });
    if (row) {
      await runtime.catalogWriter.upsertProduct(row);
      processed += 1;
    }
  }

  const hasNextPage = page.products.pageInfo.hasNextPage;
  const nextCursor = page.products.pageInfo.endCursor;

  if (hasNextPage && nextCursor) {
    await db
      .update(productCatalogSyncJobs)
      .set({
        status: "syncing",
        productsCursor: nextCursor,
        processedCount: processed,
        updatedAt: new Date(),
      })
      .where(eq(productCatalogSyncJobs.id, job.id));
    return;
  }

  await db
    .update(productCatalogSyncJobs)
    .set({
      status: "completed",
      productsCursor: null,
      processedCount: processed,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(productCatalogSyncJobs.id, job.id));
}

export async function pollInventoryLevels(db: Database, storeId?: string): Promise<void> {
  const runtime = await getIngestRuntime();
  const pollBefore = new Date(Date.now() - env.INVENTORY_POLL_INTERVAL_MS);

  const jobs = await db
    .select()
    .from(productCatalogSyncJobs)
    .where(
      and(
        eq(productCatalogSyncJobs.status, "completed"),
        storeId ? eq(productCatalogSyncJobs.storeId, storeId) : undefined,
        or(
          isNull(productCatalogSyncJobs.lastInventoryPollAt),
          lt(productCatalogSyncJobs.lastInventoryPollAt, pollBefore),
        ),
      ),
    )
    .limit(storeId ? 1 : 20);

  for (const job of jobs) {
    const { shopDomain, accessToken } = await getShopifyAccessToken(db, job.storeId);
    let locationCursor: string | null = null;
    let levelCursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const page = await fetchInventoryLevelsPage(shopDomain, accessToken, {
        locationCursor,
        levelCursor,
      });
      const levels = flattenInventoryLevels(page);
      const occurredAt = new Date().toISOString();

      for (const level of levels) {
        await runtime.catalogWriter.upsertInventoryLevel({
          store_id: job.storeId,
          variant_id: level.variantId ?? level.inventoryItemId,
          location_id: level.locationId,
          available: level.available,
          updated_at: occurredAt,
          ingested_at: occurredAt,
        });
      }

      const location = page.locations.edges[0]?.node;
      if (location?.inventoryLevels.pageInfo.hasNextPage) {
        levelCursor = location.inventoryLevels.pageInfo.endCursor;
        hasMore = true;
        continue;
      }

      if (page.locations.pageInfo.hasNextPage) {
        locationCursor = page.locations.pageInfo.endCursor;
        levelCursor = null;
        hasMore = true;
        continue;
      }

      hasMore = false;
    }

    await db
      .update(productCatalogSyncJobs)
      .set({
        lastInventoryPollAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(productCatalogSyncJobs.id, job.id));
  }
}
