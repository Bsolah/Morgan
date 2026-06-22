import { and, eq, gte, lte, or } from "drizzle-orm";
import {
  cashForecastAssumptions,
  integrations,
  plaidIntegrationState,
  plaidTransactions,
  shopifyPayouts,
  stores,
  type Database,
} from "@morgan/db";
import {
  buildCashProjection,
  CASH_PROJECTION_HORIZON_DAYS,
  projectRecurringPayoutInflows,
  type CashProjectionAssumptions,
  type CashProjectionPoint,
} from "@morgan/integrations";
import { getPayoutStatus } from "./payout-sync-service.js";
import { merchantLocalDay } from "./cash-runway-service.js";

export type CashProjectionAssumptionsView = {
  expected_daily_ad_spend_usd: string;
  planned_inventory_purchase_usd: string;
  planned_inventory_purchase_day: string | null;
  defaults_from_history: {
    avg_daily_recurring_outflow_usd: string;
    avg_daily_variable_outflow_usd: string;
    avg_daily_ad_spend_usd: string;
  };
};

export type CashProjectionPointView = {
  day: string;
  balance_usd: number;
  inflows_usd: number;
  outflows_usd: number;
};

export type CashProjectionView = {
  bank_connected: boolean;
  available: boolean;
  cta: string | null;
  as_of_day: string | null;
  starting_balance: string | null;
  currency: string | null;
  horizon_days: number;
  zero_crossing_day: string | null;
  assumptions: CashProjectionAssumptionsView | null;
  points: CashProjectionPointView[];
  message: string | null;
};

const CONNECT_BANK_CTA = "Connect bank";

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

async function loadCategorizedTransactions(
  db: Database,
  storeId: string,
  startDay: string,
  endDay: string,
) {
  const rows = await db
    .select({
      date: plaidTransactions.transactionDate,
      amount: plaidTransactions.amount,
      category: plaidTransactions.category,
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
    category: row.category,
  }));
}

async function loadAssumptions(
  db: Database,
  storeId: string,
): Promise<CashProjectionAssumptions> {
  const [row] = await db
    .select()
    .from(cashForecastAssumptions)
    .where(eq(cashForecastAssumptions.storeId, storeId))
    .limit(1);

  return {
    expected_daily_ad_spend_usd: row ? Number(row.expectedDailyAdSpendUsd) : 0,
    planned_inventory_purchase_usd: row ? Number(row.plannedInventoryPurchaseUsd) : 0,
    planned_inventory_purchase_day: row?.plannedInventoryPurchaseDay ?? null,
  };
}

function toPointView(point: CashProjectionPoint): CashProjectionPointView {
  return {
    day: point.day,
    balance_usd: point.balance_usd,
    inflows_usd: point.inflows_usd,
    outflows_usd: point.outflows_usd,
  };
}

function toAssumptionsView(
  assumptions: CashProjectionAssumptions,
  baselines: {
    avg_daily_recurring_outflow_usd: number;
    avg_daily_variable_outflow_usd: number;
    avg_daily_ad_spend_usd: number;
  },
): CashProjectionAssumptionsView {
  return {
    expected_daily_ad_spend_usd: assumptions.expected_daily_ad_spend_usd.toFixed(4),
    planned_inventory_purchase_usd: assumptions.planned_inventory_purchase_usd.toFixed(4),
    planned_inventory_purchase_day: assumptions.planned_inventory_purchase_day,
    defaults_from_history: {
      avg_daily_recurring_outflow_usd: baselines.avg_daily_recurring_outflow_usd.toFixed(4),
      avg_daily_variable_outflow_usd: baselines.avg_daily_variable_outflow_usd.toFixed(4),
      avg_daily_ad_spend_usd: baselines.avg_daily_ad_spend_usd.toFixed(4),
    },
  };
}

function disconnectedView(): CashProjectionView {
  return {
    bank_connected: false,
    available: false,
    cta: CONNECT_BANK_CTA,
    as_of_day: null,
    starting_balance: null,
    currency: null,
    horizon_days: CASH_PROJECTION_HORIZON_DAYS,
    zero_crossing_day: null,
    assumptions: null,
    points: [],
    message: "Connect your bank to see a 60-day cash projection.",
  };
}

async function buildInflowsByDay(db: Database, storeId: string, asOfDay: string) {
  const payoutStatus = await getPayoutStatus(db, storeId);
  const scheduled = new Map<string, number>();

  for (const inflow of payoutStatus.expected_inflows) {
    scheduled.set(inflow.day, Number(inflow.amount));
  }

  const payouts = await db
    .select()
    .from(shopifyPayouts)
    .where(eq(shopifyPayouts.storeId, storeId));

  return projectRecurringPayoutInflows({
    paidPayouts: payouts.map((payout) => ({
      id: payout.shopifyPayoutId,
      issuedAt: payout.issuedAt.toISOString(),
      status: payout.status,
      net: {
        amount: String(payout.netAmount),
        currencyCode: payout.currency,
      },
    })),
    scheduledByDay: scheduled,
    asOfDay,
    horizonDays: CASH_PROJECTION_HORIZON_DAYS,
  });
}

export async function getCashProjection(
  db: Database,
  storeId: string,
): Promise<CashProjectionView> {
  const bankConnected = await isBankConnected(db, storeId);
  if (!bankConnected) {
    return disconnectedView();
  }

  const balance = await loadPlaidBalance(db, storeId);
  if (!balance) {
    return {
      bank_connected: true,
      available: false,
      cta: null,
      as_of_day: null,
      starting_balance: null,
      currency: null,
      horizon_days: CASH_PROJECTION_HORIZON_DAYS,
      zero_crossing_day: null,
      assumptions: null,
      points: [],
      message: "Bank balance not available yet. Sync may still be in progress.",
    };
  }

  const [store] = await db
    .select({ timezone: stores.timezone })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const asOfDay = merchantLocalDay(store?.timezone ?? "UTC");
  const startDay = new Date(`${asOfDay}T12:00:00.000Z`);
  startDay.setUTCDate(startDay.getUTCDate() - 29);
  const trailingStartDay = startDay.toISOString().slice(0, 10);

  const [transactions, assumptions, inflowsByDay] = await Promise.all([
    loadCategorizedTransactions(db, storeId, trailingStartDay, asOfDay),
    loadAssumptions(db, storeId),
    buildInflowsByDay(db, storeId, asOfDay),
  ]);

  const projection = buildCashProjection({
    starting_balance_usd: balance.balance,
    as_of_day: asOfDay,
    transactions,
    inflows_by_day: inflowsByDay,
    assumptions,
  });

  return {
    bank_connected: true,
    available: true,
    cta: null,
    as_of_day: projection.as_of_day,
    starting_balance: projection.starting_balance_usd.toFixed(4),
    currency: balance.currency,
    horizon_days: projection.horizon_days,
    zero_crossing_day: projection.zero_crossing_day,
    assumptions: toAssumptionsView(projection.assumptions, projection.baselines),
    points: projection.points.map(toPointView),
    message: null,
  };
}

export type UpdateCashProjectionAssumptionsInput = {
  expected_daily_ad_spend_usd?: number;
  planned_inventory_purchase_usd?: number;
  planned_inventory_purchase_day?: string | null;
};

export async function updateCashProjectionAssumptions(
  db: Database,
  storeId: string,
  input: UpdateCashProjectionAssumptionsInput,
): Promise<CashProjectionView> {
  const bankConnected = await isBankConnected(db, storeId);
  if (!bankConnected) {
    return disconnectedView();
  }

  const current = await loadAssumptions(db, storeId);
  const next: CashProjectionAssumptions = {
    expected_daily_ad_spend_usd:
      input.expected_daily_ad_spend_usd ?? current.expected_daily_ad_spend_usd,
    planned_inventory_purchase_usd:
      input.planned_inventory_purchase_usd ?? current.planned_inventory_purchase_usd,
    planned_inventory_purchase_day:
      input.planned_inventory_purchase_day !== undefined
        ? input.planned_inventory_purchase_day
        : current.planned_inventory_purchase_day,
  };

  await db
    .insert(cashForecastAssumptions)
    .values({
      storeId,
      expectedDailyAdSpendUsd: next.expected_daily_ad_spend_usd.toFixed(4),
      plannedInventoryPurchaseUsd: next.planned_inventory_purchase_usd.toFixed(4),
      plannedInventoryPurchaseDay: next.planned_inventory_purchase_day,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: cashForecastAssumptions.storeId,
      set: {
        expectedDailyAdSpendUsd: next.expected_daily_ad_spend_usd.toFixed(4),
        plannedInventoryPurchaseUsd: next.planned_inventory_purchase_usd.toFixed(4),
        plannedInventoryPurchaseDay: next.planned_inventory_purchase_day,
        updatedAt: new Date(),
      },
    });

  return getCashProjection(db, storeId);
}
