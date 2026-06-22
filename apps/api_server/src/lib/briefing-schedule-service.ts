import { and, eq, isNotNull } from "drizzle-orm";
import { merchantFinanceConfig, stores, type Database } from "@morgan/db";
import {
  buildBriefingScheduleView,
  merchantLocalDay,
  nextScheduleEffectiveFromDay,
  parseBriefingTimeLocal,
  resolveSchedulerBriefingSchedule,
} from "@morgan/integrations";

export type BriefingScheduleView = ReturnType<typeof buildBriefingScheduleView> & {
  shopify_timezone: string;
  timezone_overridden: boolean;
};

export type UpdateBriefingScheduleInput = {
  timezone?: string;
  briefing_time_local?: string;
};

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Dubai",
] as const;

export function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateBriefingTimeLocal(value: string): void {
  const parsed = parseBriefingTimeLocal(value);
  const normalized = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new BriefingScheduleError("briefing_time_local must be HH:MM", "invalid_briefing_time");
  }
}

export class BriefingScheduleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BriefingScheduleError";
  }
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
    .values({ storeId })
    .returning();

  return created;
}

async function loadStoreScheduleRow(db: Database, storeId: string) {
  const [row] = await db
    .select({
      storeId: stores.id,
      timezone: stores.timezone,
      shopifyTimezone: stores.shopifyTimezone,
      timezoneSource: stores.timezoneSource,
      briefingTimeLocal: merchantFinanceConfig.briefingTimeLocal,
      pendingBriefingTimeLocal: merchantFinanceConfig.pendingBriefingTimeLocal,
      pendingTimezone: merchantFinanceConfig.pendingTimezone,
      scheduleEffectiveFrom: merchantFinanceConfig.scheduleEffectiveFrom,
    })
    .from(stores)
    .leftJoin(merchantFinanceConfig, eq(merchantFinanceConfig.storeId, stores.id))
    .where(eq(stores.id, storeId))
    .limit(1);

  return row ?? null;
}

function toView(row: NonNullable<Awaited<ReturnType<typeof loadStoreScheduleRow>>>): BriefingScheduleView {
  const schedule = buildBriefingScheduleView({
    timezone: row.timezone,
    briefingTimeLocal: row.briefingTimeLocal ?? "06:00",
    shopifyTimezone: row.shopifyTimezone,
    timezoneOverridden: row.timezoneSource === "manual",
    pendingTimezone: row.pendingTimezone,
    pendingBriefingTimeLocal: row.pendingBriefingTimeLocal,
    scheduleEffectiveFrom: row.scheduleEffectiveFrom,
  });

  return {
    ...schedule,
    shopify_timezone: row.shopifyTimezone,
    timezone_overridden: row.timezoneSource === "manual",
  };
}

export async function getBriefingSchedule(
  db: Database,
  storeId: string,
): Promise<BriefingScheduleView | null> {
  const row = await loadStoreScheduleRow(db, storeId);
  if (!row) return null;

  await applyDueBriefingScheduleForStore(db, storeId);
  const refreshed = await loadStoreScheduleRow(db, storeId);
  if (!refreshed) return null;

  return toView(refreshed);
}

export async function updateBriefingSchedule(
  db: Database,
  storeId: string,
  input: UpdateBriefingScheduleInput,
): Promise<BriefingScheduleView> {
  if (!input.timezone && !input.briefing_time_local) {
    throw new BriefingScheduleError("No schedule changes provided", "invalid_request");
  }

  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new BriefingScheduleError("Invalid timezone", "invalid_timezone");
  }

  if (input.briefing_time_local) {
    validateBriefingTimeLocal(input.briefing_time_local);
  }

  const row = await loadStoreScheduleRow(db, storeId);
  if (!row) {
    throw new BriefingScheduleError("Store not found", "store_not_found");
  }

  await ensureFinanceConfigRow(db, storeId);

  const effectiveFrom = nextScheduleEffectiveFromDay(row.timezone);
  const normalizedTime = input.briefing_time_local
    ? (() => {
        const parsed = parseBriefingTimeLocal(input.briefing_time_local);
        return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
      })()
    : null;

  const timezoneChanged = Boolean(input.timezone && input.timezone !== row.timezone);
  const timeChanged = Boolean(
    normalizedTime && normalizedTime !== (row.briefingTimeLocal ?? "06:00"),
  );

  if (!timezoneChanged && !timeChanged) {
    return toView(row);
  }

  await db
    .update(merchantFinanceConfig)
    .set({
      pendingBriefingTimeLocal: timeChanged ? normalizedTime : null,
      pendingTimezone: timezoneChanged ? input.timezone! : null,
      scheduleEffectiveFrom: effectiveFrom,
      updatedAt: new Date(),
    })
    .where(eq(merchantFinanceConfig.storeId, storeId));

  const refreshed = await loadStoreScheduleRow(db, storeId);
  if (!refreshed) {
    throw new BriefingScheduleError("Store not found", "store_not_found");
  }

  return toView(refreshed);
}

export async function applyDueBriefingScheduleForStore(
  db: Database,
  storeId: string,
): Promise<boolean> {
  const row = await loadStoreScheduleRow(db, storeId);
  if (!row?.scheduleEffectiveFrom) return false;

  const localDay = merchantLocalDay(row.timezone);
  if (localDay < row.scheduleEffectiveFrom) return false;

  const resolved = resolveSchedulerBriefingSchedule({
    timezone: row.timezone,
    briefingTimeLocal: row.briefingTimeLocal ?? "06:00",
    pendingTimezone: row.pendingTimezone,
    pendingBriefingTimeLocal: row.pendingBriefingTimeLocal,
    scheduleEffectiveFrom: row.scheduleEffectiveFrom,
  });

  await db
    .update(stores)
    .set({
      timezone: resolved.timezone,
      timezoneSource:
        row.pendingTimezone && row.pendingTimezone !== row.shopifyTimezone ? "manual" : "shopify",
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));

  await db
    .update(merchantFinanceConfig)
    .set({
      briefingTimeLocal: resolved.briefingTimeLocal,
      pendingBriefingTimeLocal: null,
      pendingTimezone: null,
      scheduleEffectiveFrom: null,
      updatedAt: new Date(),
    })
    .where(eq(merchantFinanceConfig.storeId, storeId));

  return true;
}

export async function applyDueBriefingSchedules(db: Database): Promise<number> {
  const rows = await db
    .select({ storeId: merchantFinanceConfig.storeId })
    .from(merchantFinanceConfig)
    .where(isNotNull(merchantFinanceConfig.scheduleEffectiveFrom));

  let applied = 0;
  for (const row of rows) {
    if (await applyDueBriefingScheduleForStore(db, row.storeId)) {
      applied += 1;
    }
  }
  return applied;
}

export async function loadResolvedBriefingSchedule(db: Database, storeId: string) {
  await applyDueBriefingScheduleForStore(db, storeId);
  const row = await loadStoreScheduleRow(db, storeId);
  if (!row) return null;

  const resolved = resolveSchedulerBriefingSchedule({
    timezone: row.timezone,
    briefingTimeLocal: row.briefingTimeLocal ?? "06:00",
    pendingTimezone: row.pendingTimezone,
    pendingBriefingTimeLocal: row.pendingBriefingTimeLocal,
    scheduleEffectiveFrom: row.scheduleEffectiveFrom,
  });

  return {
    timezone: resolved.timezone,
    briefingTimeLocal: resolved.briefingTimeLocal,
    nextBriefingAt: buildBriefingScheduleView({
      timezone: row.timezone,
      briefingTimeLocal: row.briefingTimeLocal ?? "06:00",
      shopifyTimezone: row.shopifyTimezone,
      timezoneOverridden: row.timezoneSource === "manual",
      pendingTimezone: row.pendingTimezone,
      pendingBriefingTimeLocal: row.pendingBriefingTimeLocal,
      scheduleEffectiveFrom: row.scheduleEffectiveFrom,
    }).next_briefing_at,
  };
}

export function listCommonTimezones(): readonly string[] {
  return COMMON_TIMEZONES;
}

export async function syncShopifyTimezone(
  db: Database,
  storeId: string,
  shopifyTimezone: string,
): Promise<void> {
  const [store] = await db
    .select({ timezoneSource: stores.timezoneSource })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) return;

  await db
    .update(stores)
    .set({
      shopifyTimezone,
      ...(store.timezoneSource === "manual" ? {} : { timezone: shopifyTimezone }),
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));
}
