import { and, eq } from "drizzle-orm";
import { type Database, merchantInventoryConfig, skuLeadTimeOverrides } from "@morgan/db";

const DEFAULT_LEAD_TIME_DAYS = 14;

export type SkuLeadTimeOverrideView = {
  sku: string;
  lead_time_days: number;
};

export type InventoryConfigView = {
  default_lead_time_days: number;
  sku_overrides: SkuLeadTimeOverrideView[];
};

export type UpdateInventoryConfigInput = {
  default_lead_time_days: number;
};

export type UpsertSkuLeadTimeInput = {
  sku: string;
  lead_time_days: number;
};

export class InventoryConfigError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "InventoryConfigError";
  }
}

const MIN_LEAD_TIME_DAYS = 1;
const MAX_LEAD_TIME_DAYS = 365;

function validateLeadTimeDays(days: number, field: string) {
  if (!Number.isInteger(days) || days < MIN_LEAD_TIME_DAYS || days > MAX_LEAD_TIME_DAYS) {
    throw new InventoryConfigError(
      `${field} must be an integer between ${MIN_LEAD_TIME_DAYS} and ${MAX_LEAD_TIME_DAYS}`,
      "invalid_lead_time_days",
    );
  }
}

function normalizeSku(sku: string): string {
  const trimmed = sku.trim();
  if (!trimmed) {
    throw new InventoryConfigError("SKU is required", "invalid_sku");
  }
  return trimmed;
}

async function ensureInventoryConfigRow(db: Database, storeId: string) {
  const [existing] = await db
    .select()
    .from(merchantInventoryConfig)
    .where(eq(merchantInventoryConfig.storeId, storeId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(merchantInventoryConfig)
    .values({ storeId, defaultLeadTimeDays: DEFAULT_LEAD_TIME_DAYS })
    .returning();

  return created;
}

export async function getInventoryConfig(
  db: Database,
  storeId: string,
): Promise<InventoryConfigView> {
  const [config, overrides] = await Promise.all([
    ensureInventoryConfigRow(db, storeId),
    db
      .select({
        sku: skuLeadTimeOverrides.sku,
        leadTimeDays: skuLeadTimeOverrides.leadTimeDays,
      })
      .from(skuLeadTimeOverrides)
      .where(eq(skuLeadTimeOverrides.storeId, storeId)),
  ]);

  return {
    default_lead_time_days: config.defaultLeadTimeDays,
    sku_overrides: overrides
      .map((row) => ({
        sku: row.sku,
        lead_time_days: row.leadTimeDays,
      }))
      .sort((left, right) => left.sku.localeCompare(right.sku)),
  };
}

export async function updateInventoryConfig(
  db: Database,
  storeId: string,
  input: UpdateInventoryConfigInput,
): Promise<InventoryConfigView> {
  validateLeadTimeDays(input.default_lead_time_days, "default_lead_time_days");
  await ensureInventoryConfigRow(db, storeId);

  await db
    .update(merchantInventoryConfig)
    .set({
      defaultLeadTimeDays: input.default_lead_time_days,
      updatedAt: new Date(),
    })
    .where(eq(merchantInventoryConfig.storeId, storeId));

  return getInventoryConfig(db, storeId);
}

export async function upsertSkuLeadTimeOverride(
  db: Database,
  storeId: string,
  input: UpsertSkuLeadTimeInput,
): Promise<InventoryConfigView> {
  const sku = normalizeSku(input.sku);
  validateLeadTimeDays(input.lead_time_days, "lead_time_days");
  await ensureInventoryConfigRow(db, storeId);

  const now = new Date();
  const [existing] = await db
    .select({ id: skuLeadTimeOverrides.id })
    .from(skuLeadTimeOverrides)
    .where(and(eq(skuLeadTimeOverrides.storeId, storeId), eq(skuLeadTimeOverrides.sku, sku)))
    .limit(1);

  if (existing) {
    await db
      .update(skuLeadTimeOverrides)
      .set({ leadTimeDays: input.lead_time_days, updatedAt: now })
      .where(eq(skuLeadTimeOverrides.id, existing.id));
  } else {
    await db.insert(skuLeadTimeOverrides).values({
      storeId,
      sku,
      leadTimeDays: input.lead_time_days,
    });
  }

  return getInventoryConfig(db, storeId);
}

export async function deleteSkuLeadTimeOverride(
  db: Database,
  storeId: string,
  skuInput: string,
): Promise<InventoryConfigView> {
  const sku = normalizeSku(skuInput);

  await db
    .delete(skuLeadTimeOverrides)
    .where(and(eq(skuLeadTimeOverrides.storeId, storeId), eq(skuLeadTimeOverrides.sku, sku)));

  return getInventoryConfig(db, storeId);
}

export async function loadLeadTimeDaysBySku(
  db: Database,
  storeId: string,
): Promise<{ defaultLeadTimeDays: number; overrides: Map<string, number> }> {
  const config = await getInventoryConfig(db, storeId);
  const overrides = new Map(
    config.sku_overrides.map((row) => [row.sku, row.lead_time_days] as const),
  );

  return {
    defaultLeadTimeDays: config.default_lead_time_days,
    overrides,
  };
}

export function resolveLeadTimeDaysForSku(
  sku: string,
  defaultLeadTimeDays: number,
  overrides: Map<string, number>,
): number {
  return overrides.get(sku) ?? defaultLeadTimeDays;
}
