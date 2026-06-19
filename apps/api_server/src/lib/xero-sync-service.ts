import { and, eq, inArray } from "drizzle-orm";
import {
  alerts,
  integrations,
  xeroAccounts,
  xeroIntegrationState,
  xeroPnlSnapshots,
  xeroTransactions,
  type Database,
} from "@morgan/db";
import {
  XeroProvider,
  computeCogsDiscrepancy,
  computeShopifyCogsFromOrders,
  extractLineItemsForCogs,
  fetchBooksSyncData,
  monthToDateRange,
  parseOrderRevenue,
  type AccountingAccount,
  type Deposit,
  type Expense,
} from "@morgan/integrations";
import { env } from "../config.js";
import { parseOrderPayload, readOrderFactsForStore } from "./order-fact-reader.js";
import { loadUnitCostBySku } from "./product-catalog-reader.js";
import { recalculatePoasForStore } from "./poas-service.js";
import { buildXeroCategoryMaps } from "./xero-account-mapping-service.js";
import { getSelectedXeroTenantId, getXeroCredentials } from "./xero-integration-service.js";

const SYNC_FAILURE_ALERT_THRESHOLD = 3;
const COGS_DISCREPANCY_THRESHOLD_PCT = 5;

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function mapTxnType(sourceType: string): "invoice" | "bank_spend" | "bank_receive" {
  if (sourceType === "invoice") return "invoice";
  if (sourceType === "bank_receive") return "bank_receive";
  return "bank_spend";
}

async function ensureXeroStateRow(db: Database, integrationId: string) {
  await db.insert(xeroIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function upsertXeroAccounts(
  db: Database,
  storeId: string,
  integrationId: string,
  accounts: AccountingAccount[],
) {
  for (const account of accounts) {
    await db
      .insert(xeroAccounts)
      .values({
        storeId,
        integrationId,
        xeroAccountId: account.id,
        accountName: account.name,
        accountType: account.account_type,
        accountSubtype: account.account_subtype,
        isActive: account.is_active,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [xeroAccounts.storeId, xeroAccounts.xeroAccountId],
        set: {
          accountName: account.name,
          accountType: account.account_type,
          accountSubtype: account.account_subtype,
          isActive: account.is_active,
          syncedAt: new Date(),
        },
      });
  }
}

async function upsertXeroTransaction(
  db: Database,
  storeId: string,
  integrationId: string,
  txn: Expense | Deposit,
) {
  const txnType = mapTxnType(txn.source_type);
  const lastUpdatedAt = txn.updated_at ? new Date(txn.updated_at) : null;

  await db
    .insert(xeroTransactions)
    .values({
      storeId,
      integrationId,
      xeroTxnId: txn.id,
      txnType,
      txnDate: txn.txn_date,
      totalAmount: formatMoney(txn.total_amount),
      currency: txn.currency,
      accountIds: txn.account_ids,
      lastUpdatedAt,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [xeroTransactions.storeId, xeroTransactions.xeroTxnId, xeroTransactions.txnType],
      set: {
        txnDate: txn.txn_date,
        totalAmount: formatMoney(txn.total_amount),
        currency: txn.currency,
        accountIds: txn.account_ids,
        lastUpdatedAt,
        syncedAt: new Date(),
      },
    });
}

async function maybeCreateCogsDiscrepancyAlert(
  db: Database,
  storeId: string,
  shopifyCogs: number,
  xeroCogs: number,
  asOfDay: string,
) {
  const discrepancy = computeCogsDiscrepancy(shopifyCogs, xeroCogs, COGS_DISCREPANCY_THRESHOLD_PCT);
  if (!discrepancy.exceeds_threshold) return;

  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "info",
      type: "xero_cogs_discrepancy",
      title: "Xero COGS differs from Shopify unit costs",
      body: `Month-to-date Shopify unit cost COGS is $${discrepancy.shopify_cogs.toFixed(2)} vs Xero COGS $${discrepancy.qbo_cogs.toFixed(2)} (${discrepancy.pct_diff.toFixed(1)}% difference). Morgan uses Xero COGS for margin when that method is selected.`,
      metricSnapshot: {
        shopify_cogs: discrepancy.shopify_cogs,
        xero_cogs: discrepancy.qbo_cogs,
        pct_diff: discrepancy.pct_diff,
        as_of_day: asOfDay,
      },
      dedupeKey: `xero_cogs_discrepancy:${asOfDay.slice(0, 7)}`,
    })
    .onConflictDoNothing();
}

async function evaluateCogsDiscrepancy(db: Database, storeId: string, xeroCogs: number, asOfDay: string) {
  const { startDate, endDate } = monthToDateRange(new Date(`${asOfDay}T00:00:00.000Z`));
  const unitCostBySku = await loadUnitCostBySku(env.BRONZE_STORAGE_PATH, storeId);
  const orderRows = await readOrderFactsForStore(env.BRONZE_STORAGE_PATH, storeId, startDate, endDate);

  const orders = orderRows.map((row) => {
    const payload = parseOrderPayload(row);
    return {
      revenue: parseOrderRevenue(payload),
      lineItems: extractLineItemsForCogs(payload, unitCostBySku),
    };
  });

  const shopifyCogs = computeShopifyCogsFromOrders(orders);
  await maybeCreateCogsDiscrepancyAlert(db, storeId, shopifyCogs, xeroCogs, asOfDay);
}

async function recordBooksSyncSuccess(db: Database, integrationId: string) {
  const now = new Date();
  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: now })
    .where(eq(integrations.id, integrationId));

  await db
    .update(xeroIntegrationState)
    .set({
      syncFailureCount: 0,
      lastBooksSyncAt: now,
      lastBooksSyncError: null,
      booksInitialSyncCompleted: true,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(xeroIntegrationState.integrationId, integrationId));
}

async function recordBooksSyncFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  await ensureXeroStateRow(db, integrationId);

  const [state] = await db
    .select({ syncFailureCount: xeroIntegrationState.syncFailureCount })
    .from(xeroIntegrationState)
    .where(eq(xeroIntegrationState.integrationId, integrationId))
    .limit(1);

  const failureCount = (state?.syncFailureCount ?? 0) + 1;
  const now = new Date();

  await db
    .update(xeroIntegrationState)
    .set({
      syncFailureCount: failureCount,
      lastBooksSyncError: message,
      lastError: message,
      updatedAt: now,
    })
    .where(eq(xeroIntegrationState.integrationId, integrationId));

  if (failureCount >= SYNC_FAILURE_ALERT_THRESHOLD) {
    await db.update(integrations).set({ status: "error" }).where(eq(integrations.id, integrationId));

    await db
      .insert(alerts)
      .values({
        storeId,
        severity: "warning",
        type: "xero_sync_failed",
        title: "Xero sync needs attention",
        body: "We could not sync your Xero books after several attempts. Check Integrations and reconnect if needed.",
        dedupeKey: "xero_sync_failed",
      })
      .onConflictDoNothing();
  }
}

export async function syncXeroBooksForStore(db: Database, storeId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "xero")))
    .limit(1);

  if (!integration || integration.status === "disconnected") return;

  const [state] = await db
    .select()
    .from(xeroIntegrationState)
    .where(eq(xeroIntegrationState.integrationId, integration.id))
    .limit(1);

  if (state?.pendingTenantSelection || state?.needsReauth) return;

  const tenantId = await getSelectedXeroTenantId(db, integration.id);
  if (!tenantId) return;

  const credentials = await getXeroCredentials(db, integration.id, env.ENCRYPTION_KEY);
  if (!credentials?.access_token) return;

  await ensureXeroStateRow(db, integration.id);
  await db.update(integrations).set({ status: "syncing" }).where(eq(integrations.id, integration.id));

  const asOfDay = new Date().toISOString().slice(0, 10);
  const { startDate, endDate } = monthToDateRange(new Date(`${asOfDay}T00:00:00.000Z`));
  const updatedAfter = state?.lastBooksSyncAt?.toUTCString() ?? null;

  const provider = new XeroProvider({
    accessToken: credentials.access_token,
    tenantId,
  });

  try {
    const categoryMaps = await buildXeroCategoryMaps(db, storeId);
    const books = await fetchBooksSyncData(provider, {
      period: { startDate, endDate },
      updatedAfter,
      categoryMaps,
      maxRetries: env.XERO_SYNC_MAX_RETRIES,
    });

    await upsertXeroAccounts(db, storeId, integration.id, books.accounts);

    await db
      .insert(xeroPnlSnapshots)
      .values({
        storeId,
        integrationId: integration.id,
        periodMonth: books.periodMonth,
        asOfDay: books.asOfDay,
        totalIncome: formatMoney(books.pnl.total_income),
        cogsTotal: formatMoney(books.categoryTotals.cogs),
        shippingTotal: formatMoney(books.categoryTotals.shipping),
        marketingTotal: formatMoney(books.categoryTotals.marketing),
        opexTotal: formatMoney(books.categoryTotals.opex),
        categoryTotals: books.categoryTotals,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [xeroPnlSnapshots.storeId, xeroPnlSnapshots.periodMonth, xeroPnlSnapshots.asOfDay],
        set: {
          totalIncome: formatMoney(books.pnl.total_income),
          cogsTotal: formatMoney(books.categoryTotals.cogs),
          shippingTotal: formatMoney(books.categoryTotals.shipping),
          marketingTotal: formatMoney(books.categoryTotals.marketing),
          opexTotal: formatMoney(books.categoryTotals.opex),
          categoryTotals: books.categoryTotals,
          syncedAt: new Date(),
        },
      });

    for (const txn of books.expenses) {
      await upsertXeroTransaction(db, storeId, integration.id, txn);
    }
    for (const txn of books.deposits) {
      await upsertXeroTransaction(db, storeId, integration.id, txn);
    }

    await evaluateCogsDiscrepancy(db, storeId, books.categoryTotals.cogs, books.asOfDay);
    await recalculatePoasForStore(db, storeId);
    await recordBooksSyncSuccess(db, integration.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero books sync failed";
    await recordBooksSyncFailure(db, integration.id, storeId, message);
    throw error;
  }
}

export async function syncXeroBooksForConnectedStores(db: Database): Promise<void> {
  const rows = await db
    .select({ storeId: integrations.storeId })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "xero"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  for (const row of rows) {
    try {
      await syncXeroBooksForStore(db, row.storeId);
    } catch {
      // Per-store failures are recorded in integration state.
    }
  }
}
