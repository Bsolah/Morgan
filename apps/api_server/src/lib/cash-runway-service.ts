import { and, desc, eq, gte, lte, or } from "drizzle-orm";
import {
  cashRunwaySnapshots,
  integrations,
  plaidIntegrationState,
  plaidTransactions,
  stores,
  type Database,
} from "@morgan/db";
import {
  buildTrailingDayWindow,
  computeCashRunway,
  runwayStatusForDays,
  type RunwayStatus,
} from "@morgan/integrations";
import type { MartCashDailyRow } from "@morgan/warehouse";
import { env } from "../config.js";
import { getCashDailyWriter } from "./cash-writer.js";

export type CashRunwayView = {
  bank_connected: boolean;
  available: boolean;
  cta: string | null;
  current_balance: string | null;
  currency: string | null;
  avg_daily_net_outflow: string | null;
  runway_days: number | null;
  runway_status: RunwayStatus;
  as_of_day: string | null;
  calculated_at: string | null;
  message: string | null;
};

export function merchantLocalDay(timezone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

export function merchantLocalHour(timezone: string, at = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(at);
  return Number.parseInt(hour, 10);
}

export function shouldRecalculateRunway(input: {
  timezone: string;
  lastAsOfDay: string | null;
  localHourThreshold?: number;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  const localHour = merchantLocalHour(input.timezone, at);
  const threshold = input.localHourThreshold ?? env.CASH_RUNWAY_LOCAL_HOUR;

  if (localHour < threshold) return false;
  return input.lastAsOfDay == null || input.lastAsOfDay < localDay;
}

async function isBankConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.storeId, storeId),
        eq(integrations.provider, "plaid"),
        or(eq(integrations.status, "connected"), eq(integrations.status, "syncing")),
      ),
    )
    .limit(1);

  return Boolean(integration);
}

async function loadPlaidBalance(db: Database, storeId: string) {
  const [row] = await db
    .select({
      balance: plaidIntegrationState.lastBankBalance,
      currency: plaidIntegrationState.bankCurrency,
    })
    .from(plaidIntegrationState)
    .innerJoin(integrations, eq(integrations.id, plaidIntegrationState.integrationId))
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "plaid")))
    .limit(1);

  if (!row?.balance) return null;

  return {
    balance: Number(row.balance),
    currency: row.currency ?? "USD",
  };
}

async function loadRunwayTransactions(db: Database, storeId: string, startDay: string, endDay: string) {
  const rows = await db
    .select({
      date: plaidTransactions.transactionDate,
      amount: plaidTransactions.amount,
    })
    .from(plaidTransactions)
    .where(
      and(
        eq(plaidTransactions.storeId, storeId),
        eq(plaidTransactions.removed, false),
        eq(plaidTransactions.pending, false),
        gte(plaidTransactions.transactionDate, startDay),
        lte(plaidTransactions.transactionDate, endDay),
      ),
    );

  return rows.map((row) => ({
    date: row.date,
    amount: Number(row.amount),
  }));
}

async function writeRunwayMartRow(
  storeId: string,
  input: {
    day: string;
    balance: string;
    currency: string;
    runwayDays: number | null;
  },
): Promise<void> {
  const writer = await getCashDailyWriter();
  const row: MartCashDailyRow = {
    store_id: storeId,
    day: input.day,
    balance: input.balance,
    currency: input.currency,
    expected_inflows: "0",
    expected_inflow_count: 0,
    shopify_payments_available: false,
    bank_balance: input.balance,
    bank_available_balance: null,
    plaid_connected: true,
    runway_days: input.runwayDays,
    ingested_at: new Date().toISOString(),
  };
  await writer.upsert(row);
}

async function maybeCreateRunwayAlerts(
  db: Database,
  storeId: string,
  asOfDay: string,
  runwayDays: number | null,
): Promise<void> {
  if (runwayDays == null) return;

  const { createStoreAlert } = await import("./alert-service.js");

  if (runwayDays < env.CASH_RUNWAY_CRITICAL_DAYS) {
    await createStoreAlert(db, {
      storeId,
      severity: "critical",
      type: "cash_runway_critical",
      title: "Cash runway is critically low",
      body: `You have about ${runwayDays} days of cash left at your current burn rate.`,
      metricSnapshot: { runway_days: runwayDays, as_of_day: asOfDay },
      dedupeKey: `cash_runway_critical:${asOfDay}`,
    });
    return;
  }

  if (runwayDays < env.CASH_RUNWAY_WARNING_DAYS) {
    await createStoreAlert(db, {
      storeId,
      severity: "warning",
      type: "cash_runway_warning",
      title: "Cash runway is getting tight",
      body: `You have about ${runwayDays} days of cash left at your current burn rate.`,
      metricSnapshot: { runway_days: runwayDays, as_of_day: asOfDay },
      dedupeKey: `cash_runway_warning:${asOfDay}`,
    });
  }
}

function disconnectedRunwayView(): CashRunwayView {
  return {
    bank_connected: false,
    available: false,
    cta: "Connect bank",
    current_balance: null,
    currency: null,
    avg_daily_net_outflow: null,
    runway_days: null,
    runway_status: "unknown",
    as_of_day: null,
    calculated_at: null,
    message: "Connect bank to see cash runway.",
  };
}

function mapSnapshotToView(snapshot: typeof cashRunwaySnapshots.$inferSelect): CashRunwayView {
  const runwayDays = snapshot.runwayDays != null ? Number(snapshot.runwayDays) : null;

  return {
    bank_connected: true,
    available: true,
    cta: null,
    current_balance: String(snapshot.currentBalance),
    currency: snapshot.currency,
    avg_daily_net_outflow: String(snapshot.avgDailyNetOutflow),
    runway_days: runwayDays,
    runway_status: runwayStatusForDays(runwayDays),
    as_of_day: snapshot.asOfDay,
    calculated_at: snapshot.calculatedAt.toISOString(),
    message:
      runwayDays == null
        ? "No net cash outflow in the trailing 30 days."
        : null,
  };
}

export async function computeCashRunwayForStore(
  db: Database,
  storeId: string,
  options: { force?: boolean; at?: Date } = {},
): Promise<CashRunwayView | null> {
  const bankConnected = await isBankConnected(db, storeId);
  if (!bankConnected) return null;

  const [store] = await db
    .select({ timezone: stores.timezone })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) return null;

  const at = options.at ?? new Date();
  const asOfDay = merchantLocalDay(store.timezone, at);

  const [latestSnapshot] = await db
    .select()
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (
    !options.force &&
    !shouldRecalculateRunway({
      timezone: store.timezone,
      lastAsOfDay: latestSnapshot?.asOfDay ?? null,
      at,
    })
  ) {
    if (latestSnapshot) return mapSnapshotToView(latestSnapshot);
  }

  const balance = await loadPlaidBalance(db, storeId);
  if (!balance) return null;

  const { startDay, endDay } = buildTrailingDayWindow(asOfDay);
  const transactions = await loadRunwayTransactions(db, storeId, startDay, endDay);
  const computed = computeCashRunway({
    currentBalance: balance.balance,
    transactions,
    asOfDay,
  });

  const [snapshot] = await db
    .insert(cashRunwaySnapshots)
    .values({
      storeId,
      asOfDay,
      currentBalance: String(balance.balance),
      currency: balance.currency,
      avgDailyNetOutflow: String(computed.avgDailyNetOutflow),
      runwayDays: computed.runwayDays != null ? String(computed.runwayDays) : null,
      calculatedAt: at,
    })
    .onConflictDoUpdate({
      target: [cashRunwaySnapshots.storeId, cashRunwaySnapshots.asOfDay],
      set: {
        currentBalance: String(balance.balance),
        currency: balance.currency,
        avgDailyNetOutflow: String(computed.avgDailyNetOutflow),
        runwayDays: computed.runwayDays != null ? String(computed.runwayDays) : null,
        calculatedAt: at,
      },
    })
    .returning();

  await writeRunwayMartRow(storeId, {
    day: asOfDay,
    balance: String(balance.balance),
    currency: balance.currency,
    runwayDays: computed.runwayDays,
  });

  await maybeCreateRunwayAlerts(db, storeId, asOfDay, computed.runwayDays);

  return mapSnapshotToView(snapshot!);
}

export async function getCashRunway(db: Database, storeId: string): Promise<CashRunwayView> {
  const bankConnected = await isBankConnected(db, storeId);
  if (!bankConnected) {
    return disconnectedRunwayView();
  }

  const [snapshot] = await db
    .select()
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (!snapshot) {
    const computed = await computeCashRunwayForStore(db, storeId, { force: true });
    if (computed) return computed;

    return {
      bank_connected: true,
      available: false,
      cta: null,
      current_balance: null,
      currency: null,
      avg_daily_net_outflow: null,
      runway_days: null,
      runway_status: "unknown",
      as_of_day: null,
      calculated_at: null,
      message: "Runway will appear after bank balances and transactions sync.",
    };
  }

  return mapSnapshotToView(snapshot);
}

export async function recalculateDueCashRunways(db: Database): Promise<number> {
  const rows = await db
    .select({
      storeId: stores.id,
      timezone: stores.timezone,
    })
    .from(stores)
    .innerJoin(integrations, eq(integrations.storeId, stores.id))
    .where(
      and(
        eq(integrations.provider, "plaid"),
        or(eq(integrations.status, "connected"), eq(integrations.status, "syncing")),
      ),
    );

  const seen = new Set<string>();
  let processed = 0;

  for (const row of rows) {
    if (seen.has(row.storeId)) continue;
    seen.add(row.storeId);

    const [latestSnapshot] = await db
      .select({ asOfDay: cashRunwaySnapshots.asOfDay })
      .from(cashRunwaySnapshots)
      .where(eq(cashRunwaySnapshots.storeId, row.storeId))
      .orderBy(desc(cashRunwaySnapshots.asOfDay))
      .limit(1);

    if (
      !shouldRecalculateRunway({
        timezone: row.timezone,
        lastAsOfDay: latestSnapshot?.asOfDay ?? null,
      })
    ) {
      continue;
    }

    await computeCashRunwayForStore(db, row.storeId, { force: true });
    processed += 1;
  }

  return processed;
}
