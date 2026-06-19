import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  alerts,
  integrationCredentials,
  integrations,
  shopifyPaymentsSyncState,
  shopifyPayouts,
  stores,
  type Database,
} from "@morgan/db";
import {
  averagePayoutIntervalDays,
  daysSinceLastPayout,
  decryptSecret,
  extractShopifyGidTail,
  fetchShopifyPaymentsSnapshot,
  groupExpectedInflowsByDay,
  isShopifyPaymentsUnavailableError,
  payoutIntervalDays,
  primaryBalanceAmount,
  shouldCreatePayoutDelayAlert,
  ShopifyPaymentsUnavailableError,
} from "@morgan/integrations";
import type { MartCashDailyRow } from "@morgan/warehouse";
import { env } from "../config.js";
import { getCashDailyWriter } from "./cash-writer.js";
import { runPayoutMatchingForStore } from "./payout-match-service.js";

export type PayoutStatusView = {
  available: boolean;
  message: string | null;
  balance: string | null;
  currency: string | null;
  payout_schedule: {
    interval: string;
    monthly_anchor: number | null;
    weekly_anchor: string | null;
  } | null;
  expected_inflows: Array<{
    day: string;
    amount: string;
    currency: string;
    payout_count: number;
  }>;
  last_poll_at: string | null;
};

export const PAYOUT_UNAVAILABLE_MESSAGE = "Payout data unavailable";

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

export async function getPayoutStatus(db: Database, storeId: string): Promise<PayoutStatusView> {
  const [state] = await db
    .select()
    .from(shopifyPaymentsSyncState)
    .where(eq(shopifyPaymentsSyncState.storeId, storeId))
    .limit(1);

  if (!state?.available) {
    return {
      available: false,
      message: PAYOUT_UNAVAILABLE_MESSAGE,
      balance: null,
      currency: null,
      payout_schedule: null,
      expected_inflows: [],
      last_poll_at: state?.lastPollAt?.toISOString() ?? null,
    };
  }

  const expectedInflows: PayoutStatusView["expected_inflows"] = [];

  const payouts = await db
    .select()
    .from(shopifyPayouts)
    .where(eq(shopifyPayouts.storeId, storeId));

  const grouped = groupExpectedInflowsByDay(
    payouts.map((payout) => ({
      id: payout.shopifyPayoutId,
      issuedAt: payout.issuedAt.toISOString(),
      status: payout.status,
      net: {
        amount: String(payout.netAmount),
        currencyCode: payout.currency,
      },
    })),
  );

  for (const [day, value] of grouped) {
    expectedInflows.push({
      day,
      amount: value.amount.toFixed(4),
      currency: value.currency,
      payout_count: value.count,
    });
  }

  return {
    available: true,
    message: null,
    balance: state.lastBalance ? String(state.lastBalance) : null,
    currency: state.currency,
    payout_schedule: state.payoutSchedule
      ? {
          interval: state.payoutSchedule.interval,
          monthly_anchor: state.payoutSchedule.monthlyAnchor ?? null,
          weekly_anchor: state.payoutSchedule.weeklyAnchor ?? null,
        }
      : null,
    expected_inflows: expectedInflows.sort((a, b) => a.day.localeCompare(b.day)),
    last_poll_at: state.lastPollAt?.toISOString() ?? null,
  };
}

async function markPaymentsUnavailable(db: Database, storeId: string): Promise<void> {
  await db
    .insert(shopifyPaymentsSyncState)
    .values({
      storeId,
      available: false,
      lastPollAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: shopifyPaymentsSyncState.storeId,
      set: {
        available: false,
        lastPollAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

async function upsertPayoutRows(db: Database, storeId: string, snapshot: Awaited<ReturnType<typeof fetchShopifyPaymentsSnapshot>>): Promise<void> {
  for (const payout of snapshot.payouts) {
    await db
      .insert(shopifyPayouts)
      .values({
        storeId,
        shopifyPayoutId: extractShopifyGidTail(payout.id),
        issuedAt: new Date(payout.issuedAt),
        netAmount: payout.net.amount,
        currency: payout.net.currencyCode,
        status: payout.status,
      })
      .onConflictDoUpdate({
        target: [shopifyPayouts.storeId, shopifyPayouts.shopifyPayoutId],
        set: {
          issuedAt: new Date(payout.issuedAt),
          netAmount: payout.net.amount,
          currency: payout.net.currencyCode,
          status: payout.status,
          ingestedAt: new Date(),
        },
      });
  }
}

async function writeMartCashDailyRows(
  storeId: string,
  snapshot: Awaited<ReturnType<typeof fetchShopifyPaymentsSnapshot>>,
): Promise<void> {
  const writer = await getCashDailyWriter();
  const balance = primaryBalanceAmount(snapshot);
  const grouped = groupExpectedInflowsByDay(snapshot.payouts);
  const today = new Date().toISOString().slice(0, 10);
  const ingestedAt = new Date().toISOString();

  const todayInflow = grouped.get(today) ?? { amount: 0, count: 0, currency: balance?.currencyCode ?? "USD" };
  const todayRow: MartCashDailyRow = {
    store_id: storeId,
    day: today,
    balance: balance?.amount ?? "0",
    currency: balance?.currencyCode ?? todayInflow.currency,
    expected_inflows: todayInflow.amount.toFixed(4),
    expected_inflow_count: todayInflow.count,
    shopify_payments_available: true,
    ingested_at: ingestedAt,
  };
  await writer.upsert(todayRow);

  for (const [day, value] of grouped) {
    if (day === today) continue;
    await writer.upsert({
      store_id: storeId,
      day,
      balance: balance?.amount ?? "0",
      currency: value.currency,
      expected_inflows: value.amount.toFixed(4),
      expected_inflow_count: value.count,
      shopify_payments_available: true,
      ingested_at: ingestedAt,
    });
  }
}

async function maybeCreatePayoutDelayAlert(
  db: Database,
  storeId: string,
  snapshot: Awaited<ReturnType<typeof fetchShopifyPaymentsSnapshot>>,
): Promise<void> {
  const intervals = payoutIntervalDays(snapshot.payouts);
  const average = averagePayoutIntervalDays(intervals);
  const wait = daysSinceLastPayout(snapshot.payouts);

  if (
    !shouldCreatePayoutDelayAlert({
      daysSinceLastPayout: wait,
      averageIntervalDays: average,
      thresholdDays: env.PAYOUT_DELAY_ALERT_THRESHOLD_DAYS,
    })
  ) {
    return;
  }

  const dedupeKey = `payout_delay:${new Date().toISOString().slice(0, 10)}`;
  const waitDays = wait != null ? Math.round(wait * 10) / 10 : null;
  const averageDays = average != null ? Math.round(average * 10) / 10 : null;

  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "info",
      type: "payout_delay",
      title: "Shopify payout is taking longer than usual",
      body: `Your latest payout is ${waitDays} days since the previous transfer, compared with a typical ${averageDays}-day interval.`,
      metricSnapshot: {
        days_since_last_payout: waitDays,
        average_interval_days: averageDays,
        threshold_days: env.PAYOUT_DELAY_ALERT_THRESHOLD_DAYS,
      },
      dedupeKey,
    })
    .onConflictDoNothing();
}

export async function pollShopifyPaymentsForStore(db: Database, storeId: string): Promise<void> {
  try {
    const { shopDomain, accessToken } = await getShopifyAccessToken(db, storeId);
    const snapshot = await fetchShopifyPaymentsSnapshot(shopDomain, accessToken);
    const balance = primaryBalanceAmount(snapshot);

    await upsertPayoutRows(db, storeId, snapshot);
    await writeMartCashDailyRows(storeId, snapshot);
    await maybeCreatePayoutDelayAlert(db, storeId, snapshot);

    await db
      .insert(shopifyPaymentsSyncState)
      .values({
        storeId,
        available: true,
        lastPollAt: new Date(),
        lastBalance: balance?.amount ?? "0",
        currency: balance?.currencyCode ?? "USD",
        payoutSchedule: snapshot.payoutSchedule,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: shopifyPaymentsSyncState.storeId,
        set: {
          available: true,
          lastPollAt: new Date(),
          lastBalance: balance?.amount ?? "0",
          currency: balance?.currencyCode ?? "USD",
          payoutSchedule: snapshot.payoutSchedule,
          updatedAt: new Date(),
        },
      });
    await runPayoutMatchingForStore(db, storeId);
  } catch (error) {
    if (error instanceof ShopifyPaymentsUnavailableError || isShopifyPaymentsUnavailableError(error)) {
      await markPaymentsUnavailable(db, storeId);
      return;
    }
    throw error;
  }
}

export async function pollShopifyPayments(db: Database, storeId?: string): Promise<void> {
  const pollBefore = new Date(Date.now() - env.PAYOUT_POLL_INTERVAL_MS);

  const rows = await db
    .select({ storeId: integrations.storeId, lastPollAt: shopifyPaymentsSyncState.lastPollAt })
    .from(integrations)
    .leftJoin(shopifyPaymentsSyncState, eq(shopifyPaymentsSyncState.storeId, integrations.storeId))
    .where(
      and(
        eq(integrations.provider, "shopify"),
        eq(integrations.status, "connected"),
        storeId ? eq(integrations.storeId, storeId) : undefined,
        storeId
          ? undefined
          : or(
              isNull(shopifyPaymentsSyncState.lastPollAt),
              lt(shopifyPaymentsSyncState.lastPollAt, pollBefore),
            ),
      ),
    )
    .limit(storeId ? 1 : 50);

  for (const row of rows) {
    await pollShopifyPaymentsForStore(db, row.storeId);
  }
}
