import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { integrations, merchantFinanceConfig, type Database } from "@morgan/db";
import type { EventEnvelope } from "@morgan/shared";
import { getIngestRuntime } from "./ingest-runtime.js";

export const COGS_METHODS = ["shopify", "manual_pct", "qbo", "xero"] as const;
export type CogsMethod = (typeof COGS_METHODS)[number];

export type FinanceConfigView = {
  cogs_method: CogsMethod;
  manual_cogs_pct: number | null;
  quickbooks_connected: boolean;
  xero_connected: boolean;
  accounting_connected: boolean;
  recalculation: {
    status: "idle" | "scheduled";
    requested_at: string | null;
    due_by: string | null;
  };
};

export type UpdateFinanceConfigInput = {
  cogs_method: CogsMethod;
  manual_cogs_pct?: number | null;
};

function toView(
  row: typeof merchantFinanceConfig.$inferSelect,
  quickbooksConnected: boolean,
  xeroConnected: boolean,
): FinanceConfigView {
  const hasRecalc = row.metricsRecalcDueBy != null && row.metricsRecalcRequestedAt != null;
  const dueBy = row.metricsRecalcDueBy;
  const isScheduled = hasRecalc && dueBy != null && dueBy.getTime() > Date.now();

  return {
    cogs_method: row.cogsMethod,
    manual_cogs_pct: row.manualCogsPct != null ? Number(row.manualCogsPct) : null,
    quickbooks_connected: quickbooksConnected,
    xero_connected: xeroConnected,
    accounting_connected: quickbooksConnected || xeroConnected,
    recalculation: {
      status: isScheduled ? "scheduled" : "idle",
      requested_at: row.metricsRecalcRequestedAt?.toISOString() ?? null,
      due_by: row.metricsRecalcDueBy?.toISOString() ?? null,
    },
  };
}

async function isQuickBooksConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  return integration?.status === "connected";
}

async function isXeroConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  return integration?.status === "connected";
}

async function ensureFinanceConfigRow(db: Database, storeId: string) {
  const [existing] = await db
    .select()
    .from(merchantFinanceConfig)
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(merchantFinanceConfig)
    .values({ storeId, cogsMethod: "shopify" })
    .returning();

  return created;
}

export async function getFinanceConfig(db: Database, storeId: string): Promise<FinanceConfigView> {
  const [row, quickbooksConnected, xeroConnected] = await Promise.all([
    ensureFinanceConfigRow(db, storeId),
    isQuickBooksConnected(db, storeId),
    isXeroConnected(db, storeId),
  ]);

  return toView(row, quickbooksConnected, xeroConnected);
}

function validateUpdate(
  input: UpdateFinanceConfigInput,
  quickbooksConnected: boolean,
  xeroConnected: boolean,
) {
  if (input.cogs_method === "manual_pct") {
    const pct = input.manual_cogs_pct;
    if (pct == null || Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new FinanceConfigError("manual_cogs_pct must be between 0 and 100", "invalid_manual_pct");
    }
  } else if (input.manual_cogs_pct != null) {
    throw new FinanceConfigError(
      "manual_cogs_pct is only valid when cogs_method is manual_pct",
      "invalid_manual_pct",
    );
  }

  if (input.cogs_method === "qbo" && !quickbooksConnected) {
    throw new FinanceConfigError(
      "Connect QuickBooks before using QuickBooks COGS",
      "quickbooks_not_connected",
    );
  }

  if (input.cogs_method === "xero" && !xeroConnected) {
    throw new FinanceConfigError(
      "Connect Xero before using Xero COGS",
      "xero_not_connected",
    );
  }
}

export class FinanceConfigError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "FinanceConfigError";
  }
}

async function publishMetricRecalculation(storeId: string, dueBy: Date, cogsMethod: CogsMethod) {
  const event: EventEnvelope = {
    event_id: randomUUID(),
    event_type: "metrics.recalculate_requested",
    store_id: storeId,
    source: "morgan",
    occurred_at: new Date().toISOString(),
    payload: {
      trigger: "cogs_method_changed",
      cogs_method: cogsMethod,
      due_by: dueBy.toISOString(),
    },
    schema_version: 1,
  };

  const runtime = await getIngestRuntime();
  await runtime.pipeline.ingest("metrics.recalculate", event);
}

export async function updateFinanceConfig(
  db: Database,
  storeId: string,
  input: UpdateFinanceConfigInput,
): Promise<FinanceConfigView> {
  const [quickbooksConnected, xeroConnected] = await Promise.all([
    isQuickBooksConnected(db, storeId),
    isXeroConnected(db, storeId),
  ]);
  validateUpdate(input, quickbooksConnected, xeroConnected);

  const existing = await ensureFinanceConfigRow(db, storeId);
  const manualPct =
    input.cogs_method === "manual_pct" && input.manual_cogs_pct != null
      ? input.manual_cogs_pct.toFixed(2)
      : null;

  const cogsChanged =
    existing.cogsMethod !== input.cogs_method ||
    (input.cogs_method === "manual_pct" &&
      Number(existing.manualCogsPct ?? -1) !== Number(manualPct ?? -1));

  const now = new Date();
  const dueBy = cogsChanged ? new Date(now.getTime() + 60 * 60 * 1000) : null;

  const [updated] = await db
    .update(merchantFinanceConfig)
    .set({
      cogsMethod: input.cogs_method,
      manualCogsPct: manualPct,
      metricsRecalcRequestedAt: cogsChanged ? now : existing.metricsRecalcRequestedAt,
      metricsRecalcDueBy: cogsChanged ? dueBy : existing.metricsRecalcDueBy,
      updatedAt: now,
    })
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .returning();

  if (cogsChanged && dueBy) {
    await publishMetricRecalculation(storeId, dueBy, input.cogs_method);
  }

  return toView(updated, quickbooksConnected, xeroConnected);
}
