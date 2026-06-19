import { and, eq, inArray } from "drizzle-orm";
import {
  alerts,
  integrations,
  quickbooksAccounts,
  quickbooksCompanies,
  quickbooksIntegrationState,
  quickbooksPnlSnapshots,
  quickbooksTransactions,
  type Database,
} from "@morgan/db";
import {
  QuickBooksProvider,
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
import { buildQuickBooksCategoryMaps } from "./quickbooks-account-mapping-service.js";
import { getQuickBooksCredentials } from "./quickbooks-integration-service.js";

const SYNC_FAILURE_ALERT_THRESHOLD = 3;
const COGS_DISCREPANCY_THRESHOLD_PCT = 5;

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function mapQuickBooksExpenseType(sourceType: string): "bill" | "purchase" {
  return sourceType === "purchase" ? "purchase" : "bill";
}

async function ensureQuickBooksStateRow(db: Database, integrationId: string) {
  await db.insert(quickbooksIntegrationState).values({ integrationId }).onConflictDoNothing();
}

async function getSelectedQuickBooksRealmId(db: Database, integrationId: string): Promise<string | null> {
  const [company] = await db
    .select({ realmId: quickbooksCompanies.realmId })
    .from(quickbooksCompanies)
    .where(and(eq(quickbooksCompanies.integrationId, integrationId), eq(quickbooksCompanies.isSelected, true)))
    .limit(1);

  return company?.realmId ?? null;
}

async function upsertQuickBooksAccounts(
  db: Database,
  storeId: string,
  integrationId: string,
  accounts: AccountingAccount[],
) {
  for (const account of accounts) {
    await db
      .insert(quickbooksAccounts)
      .values({
        storeId,
        integrationId,
        qboAccountId: account.id,
        accountName: account.name,
        accountType: account.account_type,
        accountSubtype: account.account_subtype,
        isActive: account.is_active,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [quickbooksAccounts.storeId, quickbooksAccounts.qboAccountId],
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

async function upsertQuickBooksTransaction(
  db: Database,
  storeId: string,
  integrationId: string,
  txnType: "bill" | "purchase" | "deposit",
  txn: Expense | Deposit,
) {
  const lastUpdatedAt = txn.updated_at ? new Date(txn.updated_at) : null;

  await db
    .insert(quickbooksTransactions)
    .values({
      storeId,
      integrationId,
      qboTxnId: txn.id,
      txnType,
      txnDate: txn.txn_date,
      totalAmount: formatMoney(txn.total_amount),
      currency: txn.currency,
      accountIds: txn.account_ids,
      lastUpdatedAt,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [quickbooksTransactions.storeId, quickbooksTransactions.qboTxnId, quickbooksTransactions.txnType],
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
  booksCogs: number,
  asOfDay: string,
) {
  const discrepancy = computeCogsDiscrepancy(shopifyCogs, booksCogs, COGS_DISCREPANCY_THRESHOLD_PCT);
  if (!discrepancy.exceeds_threshold) return;

  await db
    .insert(alerts)
    .values({
      storeId,
      severity: "info",
      type: "qbo_cogs_discrepancy",
      title: "QuickBooks COGS differs from Shopify unit costs",
      body: `Month-to-date Shopify unit cost COGS is $${discrepancy.shopify_cogs.toFixed(2)} vs QuickBooks COGS $${discrepancy.qbo_cogs.toFixed(2)} (${discrepancy.pct_diff.toFixed(1)}% difference). Morgan uses QuickBooks COGS for margin when that method is selected.`,
      metricSnapshot: {
        shopify_cogs: discrepancy.shopify_cogs,
        qbo_cogs: discrepancy.qbo_cogs,
        pct_diff: discrepancy.pct_diff,
        as_of_day: asOfDay,
      },
      dedupeKey: `qbo_cogs_discrepancy:${asOfDay.slice(0, 7)}`,
    })
    .onConflictDoNothing();
}

async function evaluateCogsDiscrepancy(db: Database, storeId: string, booksCogs: number, asOfDay: string) {
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
  await maybeCreateCogsDiscrepancyAlert(db, storeId, shopifyCogs, booksCogs, asOfDay);
}

async function recordBooksSyncSuccess(db: Database, integrationId: string) {
  const now = new Date();
  await db
    .update(integrations)
    .set({ status: "connected", lastSyncAt: now })
    .where(eq(integrations.id, integrationId));

  await db
    .update(quickbooksIntegrationState)
    .set({
      syncFailureCount: 0,
      lastBooksSyncAt: now,
      lastBooksSyncError: null,
      booksInitialSyncCompleted: true,
      lastError: null,
      updatedAt: now,
    })
    .where(eq(quickbooksIntegrationState.integrationId, integrationId));
}

async function recordBooksSyncFailure(
  db: Database,
  integrationId: string,
  storeId: string,
  message: string,
) {
  await ensureQuickBooksStateRow(db, integrationId);

  const [state] = await db
    .select({ syncFailureCount: quickbooksIntegrationState.syncFailureCount })
    .from(quickbooksIntegrationState)
    .where(eq(quickbooksIntegrationState.integrationId, integrationId))
    .limit(1);

  const failureCount = (state?.syncFailureCount ?? 0) + 1;
  const now = new Date();

  await db
    .update(quickbooksIntegrationState)
    .set({
      syncFailureCount: failureCount,
      lastBooksSyncError: message,
      lastError: message,
      updatedAt: now,
    })
    .where(eq(quickbooksIntegrationState.integrationId, integrationId));

  if (failureCount >= SYNC_FAILURE_ALERT_THRESHOLD) {
    await db
      .update(integrations)
      .set({ status: "error" })
      .where(eq(integrations.id, integrationId));

    await db
      .insert(alerts)
      .values({
        storeId,
        severity: "warning",
        type: "quickbooks_sync_failed",
        title: "QuickBooks sync needs attention",
        body: "We could not sync your QuickBooks books after several attempts. Check Integrations and reconnect if needed.",
        dedupeKey: "quickbooks_sync_failed",
      })
      .onConflictDoNothing();
  }
}

export async function syncQuickBooksBooksForStore(db: Database, storeId: string): Promise<void> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "quickbooks")))
    .limit(1);

  if (!integration || integration.status === "disconnected") return;

  const [state] = await db
    .select()
    .from(quickbooksIntegrationState)
    .where(eq(quickbooksIntegrationState.integrationId, integration.id))
    .limit(1);

  if (state?.pendingCompanySelection || state?.needsReauth) return;

  const realmId = await getSelectedQuickBooksRealmId(db, integration.id);
  if (!realmId) return;

  const credentials = await getQuickBooksCredentials(db, integration.id, env.ENCRYPTION_KEY);
  if (!credentials?.access_token) return;

  await ensureQuickBooksStateRow(db, integration.id);
  await db.update(integrations).set({ status: "syncing" }).where(eq(integrations.id, integration.id));

  const asOfDay = new Date().toISOString().slice(0, 10);
  const { startDate, endDate } = monthToDateRange(new Date(`${asOfDay}T00:00:00.000Z`));
  const updatedAfter = state?.lastBooksSyncAt?.toISOString() ?? null;

  const provider = new QuickBooksProvider({
    environment: env.INTUIT_ENV,
    accessToken: credentials.access_token,
    realmId,
  });

  try {
    const categoryMaps = await buildQuickBooksCategoryMaps(db, storeId);
    const books = await fetchBooksSyncData(provider, {
      period: { startDate, endDate },
      updatedAfter,
      categoryMaps,
      maxRetries: env.INTUIT_SYNC_MAX_RETRIES,
    });

    await upsertQuickBooksAccounts(db, storeId, integration.id, books.accounts);

    await db
      .insert(quickbooksPnlSnapshots)
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
        target: [
          quickbooksPnlSnapshots.storeId,
          quickbooksPnlSnapshots.periodMonth,
          quickbooksPnlSnapshots.asOfDay,
        ],
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
      await upsertQuickBooksTransaction(
        db,
        storeId,
        integration.id,
        mapQuickBooksExpenseType(txn.source_type),
        txn,
      );
    }
    for (const txn of books.deposits) {
      await upsertQuickBooksTransaction(db, storeId, integration.id, "deposit", txn);
    }

    await evaluateCogsDiscrepancy(db, storeId, books.categoryTotals.cogs, books.asOfDay);
    await recalculatePoasForStore(db, storeId);
    await recordBooksSyncSuccess(db, integration.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QuickBooks books sync failed";
    await recordBooksSyncFailure(db, integration.id, storeId, message);
    throw error;
  }
}

export async function syncQuickBooksBooksForConnectedStores(db: Database): Promise<void> {
  const rows = await db
    .select({ storeId: integrations.storeId })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "quickbooks"),
        inArray(integrations.status, ["connected", "syncing", "error"]),
      ),
    );

  for (const row of rows) {
    try {
      await syncQuickBooksBooksForStore(db, row.storeId);
    } catch {
      // Per-store failures are recorded in integration state.
    }
  }
}
