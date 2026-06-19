import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  backfillOrderReceipts,
  integrationCredentials,
  integrations,
  orderBackfillJobs,
  stores,
  syncRuns,
  type Database,
} from "@morgan/db";
import { SHOPIFY_ORDERS_TOPIC } from "@morgan/events";
import {
  decryptSecret,
  downloadBulkOperationJsonl,
  extractShopifyOrderId,
  getCurrentBulkOperation,
  parseBulkOrderRecords,
  startOrdersBulkOperation,
} from "@morgan/integrations";
import type { EventEnvelope } from "@morgan/shared";
import { env } from "../config.js";
import { getIngestRuntime } from "./ingest-runtime.js";
import { getCatalogSyncStatus } from "./product-catalog-service.js";

export type SyncStatusView = {
  store_id: string;
  status: "pending" | "bulk_running" | "processing" | "completed" | "failed" | "idle";
  phase: "order_backfill" | "product_catalog" | null;
  label: string;
  processed_count: number;
  total_count: number | null;
  progress_percent: number | null;
  partial_brief_available: boolean;
  partial_brief_threshold: number;
  error: string | null;
  catalog: {
    status: "pending" | "syncing" | "completed" | "failed" | "idle";
    label: string;
    processed_count: number;
    total_count: number | null;
    progress_percent: number | null;
    last_inventory_poll_at: string | null;
    error: string | null;
  };
};

const ACTIVE_JOB_STATUSES = ["pending", "bulk_running", "processing"] as const;

export function formatOrderBackfillLabel(
  processed: number,
  total: number | null,
  status: string,
): string {
  if (status === "completed") {
    return "Order history imported";
  }

  const processedLabel = processed.toLocaleString("en-US");
  const totalLabel = total ? ` / ${total.toLocaleString("en-US")}` : "";
  return `Importing order history… ${processedLabel}${totalLabel}`;
}

function sinceDateForBackfill(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
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

export async function enqueueOrderBackfill(
  db: Database,
  storeId: string,
  syncRunId?: string,
): Promise<string> {
  const [existing] = await db
    .select()
    .from(orderBackfillJobs)
    .where(
      and(
        eq(orderBackfillJobs.storeId, storeId),
        inArray(orderBackfillJobs.status, [...ACTIVE_JOB_STATUSES, "failed"]),
      ),
    )
    .orderBy(desc(orderBackfillJobs.startedAt))
    .limit(1);

  if (existing && ACTIVE_JOB_STATUSES.includes(existing.status as (typeof ACTIVE_JOB_STATUSES)[number])) {
    return existing.id;
  }

  if (existing?.status === "failed") {
    await db
      .update(orderBackfillJobs)
      .set({
        status: existing.bulkResultsPath ? "processing" : "pending",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(orderBackfillJobs.id, existing.id));
    return existing.id;
  }

  const sinceDate = sinceDateForBackfill(env.ORDER_BACKFILL_DAYS);
  const [job] = await db
    .insert(orderBackfillJobs)
    .values({
      storeId,
      syncRunId: syncRunId ?? null,
      sinceDate,
      status: "pending",
    })
    .returning({ id: orderBackfillJobs.id });

  return job.id;
}

export async function getSyncStatus(db: Database, storeId: string): Promise<SyncStatusView> {
  const [job] = await db
    .select()
    .from(orderBackfillJobs)
    .where(eq(orderBackfillJobs.storeId, storeId))
    .orderBy(desc(orderBackfillJobs.startedAt))
    .limit(1);

  if (!job) {
    return {
      store_id: storeId,
      status: "idle",
      phase: null,
      label: "Waiting to start sync",
      processed_count: 0,
      total_count: null,
      progress_percent: null,
      partial_brief_available: false,
      partial_brief_threshold: env.ORDER_BACKFILL_PARTIAL_BRIEF_THRESHOLD,
      error: null,
      catalog: await getCatalogSyncStatus(db, storeId),
    };
  }

  const processed = job.processedCount;
  const total = job.totalCount;
  const progressPercent =
    total && total > 0 ? Math.min(100, Math.round((processed / total) * 1000) / 10) : null;

  const label = formatOrderBackfillLabel(processed, total, job.status);

  return {
    store_id: storeId,
    status: job.status as SyncStatusView["status"],
    phase: "order_backfill",
    label,
    processed_count: processed,
    total_count: total,
    progress_percent: progressPercent,
    partial_brief_available: job.partialBriefAvailable,
    partial_brief_threshold: env.ORDER_BACKFILL_PARTIAL_BRIEF_THRESHOLD,
    error: job.error,
    catalog: await getCatalogSyncStatus(db, storeId),
  };
}

async function ingestBackfillOrder(
  db: Database,
  jobId: string,
  storeId: string,
  shopDomain: string,
  record: Record<string, unknown>,
): Promise<boolean> {
  const shopifyOrderId = extractShopifyOrderId(record);
  if (!shopifyOrderId) return false;

  const inserted = await db
    .insert(backfillOrderReceipts)
    .values({
      storeId,
      shopifyOrderId,
      jobId,
    })
    .onConflictDoNothing()
    .returning({ id: backfillOrderReceipts.id });

  if (inserted.length === 0) {
    return false;
  }

  const occurredAt =
    typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();

  const envelope: EventEnvelope = {
    event_id: `backfill:${storeId}:${shopifyOrderId}`,
    event_type: "orders.backfill",
    store_id: storeId,
    source: "shopify",
    occurred_at: occurredAt,
    payload: {
      ...record,
      shop_domain: shopDomain,
      topic: "orders/backfill",
      source: "bulk_operation",
    },
    schema_version: 1,
  };

  const runtime = await getIngestRuntime();
  await runtime.pipeline.ingest(SHOPIFY_ORDERS_TOPIC, envelope);
  return true;
}

async function markPartialBriefIfNeeded(
  db: Database,
  job: typeof orderBackfillJobs.$inferSelect,
): Promise<void> {
  if (job.partialBriefAvailable || !job.totalCount || job.totalCount <= 0) return;

  const ratio = job.processedCount / job.totalCount;
  if (ratio < env.ORDER_BACKFILL_PARTIAL_BRIEF_THRESHOLD) return;

  await db
    .update(orderBackfillJobs)
    .set({
      partialBriefAvailable: true,
      updatedAt: new Date(),
    })
    .where(eq(orderBackfillJobs.id, job.id));
}

async function completeJob(db: Database, jobId: string, storeId: string): Promise<void> {
  const now = new Date();
  await db
    .update(orderBackfillJobs)
    .set({
      status: "completed",
      completedAt: now,
      updatedAt: now,
      partialBriefAvailable: true,
    })
    .where(eq(orderBackfillJobs.id, jobId));

  await db.update(stores).set({ status: "active", updatedAt: now }).where(eq(stores.id, storeId));

  const [job] = await db
    .select({ syncRunId: orderBackfillJobs.syncRunId })
    .from(orderBackfillJobs)
    .where(eq(orderBackfillJobs.id, jobId))
    .limit(1);

  if (job?.syncRunId) {
    await db
      .update(syncRuns)
      .set({ status: "completed", completedAt: now })
      .where(eq(syncRuns.id, job.syncRunId));
  }
}

export async function processOrderBackfillJob(db: Database, jobId: string): Promise<void> {
  const [job] = await db.select().from(orderBackfillJobs).where(eq(orderBackfillJobs.id, jobId)).limit(1);
  if (!job) return;
  if (!ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number]) && job.status !== "failed") {
    return;
  }

  const { shopDomain, accessToken } = await getShopifyAccessToken(db, job.storeId);

  try {
    if (job.status === "pending" || (job.status === "failed" && !job.bulkResultsPath)) {
      const bulkOperation = await startOrdersBulkOperation(
        shopDomain,
        accessToken,
        job.sinceDate.toISOString(),
      );

      await db
        .update(orderBackfillJobs)
        .set({
          status: "bulk_running",
          shopifyBulkOperationId: bulkOperation.id,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(orderBackfillJobs.id, job.id));
      return;
    }

    if (job.status === "bulk_running" || (job.status === "failed" && job.shopifyBulkOperationId && !job.bulkResultsPath)) {
      const bulkOperation = await getCurrentBulkOperation(shopDomain, accessToken);
      if (!bulkOperation) {
        throw new Error("Shopify bulk operation not found");
      }

      if (bulkOperation.status === "FAILED" || bulkOperation.status === "CANCELED") {
        throw new Error(`Shopify bulk operation ${bulkOperation.status}`);
      }

      if (bulkOperation.status !== "COMPLETED" || !bulkOperation.url) {
        await db
          .update(orderBackfillJobs)
          .set({
            totalCount: bulkOperation.objectCount ? Number(bulkOperation.objectCount) : job.totalCount,
            updatedAt: new Date(),
          })
          .where(eq(orderBackfillJobs.id, job.id));
        return;
      }

      const jsonl = await downloadBulkOperationJsonl(bulkOperation.url);
      const dir = path.join(env.BRONZE_STORAGE_PATH, "backfill", job.storeId, job.id);
      await mkdir(dir, { recursive: true });
      const bulkResultsPath = path.join(dir, "orders.jsonl");
      await writeFile(bulkResultsPath, jsonl, "utf8");

      await db
        .update(orderBackfillJobs)
        .set({
          status: "processing",
          bulkResultsUrl: bulkOperation.url,
          bulkResultsPath,
          totalCount: bulkOperation.objectCount ? Number(bulkOperation.objectCount) : job.totalCount,
          updatedAt: new Date(),
        })
        .where(eq(orderBackfillJobs.id, job.id));
      return;
    }

    if (job.status === "processing" || (job.status === "failed" && job.bulkResultsPath)) {
      if (!job.bulkResultsPath) {
        throw new Error("Bulk results path missing");
      }

      const { readFile } = await import("node:fs/promises");
      const jsonl = await readFile(job.bulkResultsPath, "utf8");
      const batchSize = env.ORDER_BACKFILL_BATCH_SIZE;
      const lines = jsonl.split("\n").filter((line) => line.trim().length > 0);
      const endLine = Math.min(job.cursorLine + batchSize, lines.length);

      for (let line = job.cursorLine; line < endLine; line++) {
        const record = JSON.parse(lines[line]!) as Record<string, unknown>;
        await ingestBackfillOrder(db, job.id, job.storeId, shopDomain, record);
      }

      const processedCount = job.processedCount + (endLine - job.cursorLine);
      const nextLine = endLine;
      const isComplete = nextLine >= lines.length;

      await db
        .update(orderBackfillJobs)
        .set({
          processedCount,
          cursorLine: nextLine,
          status: isComplete ? "completed" : "processing",
          completedAt: isComplete ? new Date() : null,
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(orderBackfillJobs.id, job.id));

      const updatedJob = {
        ...job,
        processedCount,
        totalCount: job.totalCount ?? lines.length,
        partialBriefAvailable: job.partialBriefAvailable,
      };
      await markPartialBriefIfNeeded(db, updatedJob);

      if (isComplete) {
        await completeJob(db, job.id, job.storeId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order backfill failed";
    await db
      .update(orderBackfillJobs)
      .set({
        status: "failed",
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(orderBackfillJobs.id, job.id));
  }
}

export async function processActiveOrderBackfillJobs(db: Database): Promise<void> {
  const jobs = await db
    .select({ id: orderBackfillJobs.id })
    .from(orderBackfillJobs)
    .where(inArray(orderBackfillJobs.status, [...ACTIVE_JOB_STATUSES, "failed"]));

  for (const job of jobs) {
    await processOrderBackfillJob(db, job.id);
  }
}
