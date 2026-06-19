import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  integrationCredentials,
  integrations,
  plaidBankAccounts,
  plaidClassificationBatches,
  plaidClassificationQueue,
  plaidIntegrationState,
  plaidTransactions,
  type Database,
} from "@morgan/db";
import {
  categorizePlaidTransaction,
  decryptSecret,
  fetchPlaidBalances,
  oldestTransactionDate,
  syncAllPlaidTransactions,
  transactionCurrency,
  type PlaidSyncTransaction,
} from "@morgan/integrations";
import type { MartCashDailyRow } from "@morgan/warehouse";
import { env, getPlaidConfig } from "../config.js";
import { getCashDailyWriter } from "./cash-writer.js";
import { runPayoutMatchingForStore } from "./payout-match-service.js";
import { computeCashRunwayForStore } from "./cash-runway-service.js";
import type { PlaidCredentialPayload } from "./plaid-integration-service.js";

type PlaidConfig = ReturnType<typeof getPlaidConfig>;

async function getPlaidIntegrationContext(db: Database, storeId: string) {
  const [row] = await db
    .select({
      integrationId: integrations.id,
      storeId: integrations.storeId,
      status: integrations.status,
      encryptedPayload: integrationCredentials.encryptedPayload,
      plaidAccountId: plaidBankAccounts.plaidAccountId,
      transactionsCursor: plaidIntegrationState.transactionsCursor,
      initialSyncCompleted: plaidIntegrationState.initialSyncCompleted,
      oldestTransactionDate: plaidIntegrationState.oldestTransactionDate,
    })
    .from(integrations)
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .innerJoin(plaidBankAccounts, eq(plaidBankAccounts.integrationId, integrations.id))
    .leftJoin(plaidIntegrationState, eq(plaidIntegrationState.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.storeId, storeId),
        eq(integrations.provider, "plaid"),
        inArray(integrations.status, ["connected", "syncing"]),
        eq(plaidBankAccounts.isPrimary, true),
      ),
    )
    .limit(1);

  if (!row) return null;

  const credentials = JSON.parse(
    decryptSecret(row.encryptedPayload, env.ENCRYPTION_KEY),
  ) as PlaidCredentialPayload;

  return {
    ...row,
    accessToken: credentials.access_token,
    itemId: credentials.item_id,
  };
}

async function getPlaidIntegrationByItemId(db: Database, itemId: string) {
  const [row] = await db
    .select({
      integrationId: integrations.id,
      storeId: integrations.storeId,
      encryptedPayload: integrationCredentials.encryptedPayload,
      plaidAccountId: plaidBankAccounts.plaidAccountId,
      transactionsCursor: plaidIntegrationState.transactionsCursor,
      initialSyncCompleted: plaidIntegrationState.initialSyncCompleted,
      oldestTransactionDate: plaidIntegrationState.oldestTransactionDate,
    })
    .from(plaidBankAccounts)
    .innerJoin(integrations, eq(integrations.id, plaidBankAccounts.integrationId))
    .innerJoin(integrationCredentials, eq(integrationCredentials.integrationId, integrations.id))
    .leftJoin(plaidIntegrationState, eq(plaidIntegrationState.integrationId, integrations.id))
    .where(
      and(
        eq(plaidBankAccounts.plaidItemId, itemId),
        eq(integrations.provider, "plaid"),
        inArray(integrations.status, ["connected", "syncing"]),
      ),
    )
    .limit(1);

  if (!row) return null;

  const credentials = JSON.parse(
    decryptSecret(row.encryptedPayload, env.ENCRYPTION_KEY),
  ) as PlaidCredentialPayload;

  return {
    ...row,
    accessToken: credentials.access_token,
    itemId,
  };
}

async function ensurePendingClassificationBatch(db: Database, storeId: string): Promise<string> {
  const [existing] = await db
    .select({ id: plaidClassificationBatches.id })
    .from(plaidClassificationBatches)
    .where(
      and(eq(plaidClassificationBatches.storeId, storeId), eq(plaidClassificationBatches.status, "pending")),
    )
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(plaidClassificationBatches)
    .values({ storeId, status: "pending" })
    .returning({ id: plaidClassificationBatches.id });

  return created!.id;
}

async function queueUncategorizedTransaction(
  db: Database,
  storeId: string,
  transactionRowId: string,
): Promise<void> {
  const batchId = await ensurePendingClassificationBatch(db, storeId);

  const inserted = await db
    .insert(plaidClassificationQueue)
    .values({
      storeId,
      plaidTransactionId: transactionRowId,
      batchId,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: plaidClassificationQueue.id });

  if (inserted.length === 0) return;

  await db
    .update(plaidClassificationBatches)
    .set({
      transactionCount: sql`${plaidClassificationBatches.transactionCount} + 1`,
    })
    .where(eq(plaidClassificationBatches.id, batchId));

  await db
    .update(plaidTransactions)
    .set({ classificationBatchId: batchId })
    .where(eq(plaidTransactions.id, transactionRowId));
}

async function upsertPlaidTransaction(
  db: Database,
  input: {
    storeId: string;
    integrationId: string;
    txn: PlaidSyncTransaction;
  },
): Promise<void> {
  const categorization = categorizePlaidTransaction(input.txn);
  const isUncategorized = categorization.category === "uncategorized";

  const [row] = await db
    .insert(plaidTransactions)
    .values({
      storeId: input.storeId,
      integrationId: input.integrationId,
      plaidTransactionId: input.txn.transaction_id,
      plaidAccountId: input.txn.account_id,
      transactionDate: input.txn.date,
      amount: String(input.txn.amount),
      currency: transactionCurrency(input.txn),
      name: input.txn.name,
      merchantName: input.txn.merchant_name,
      plaidCategories: input.txn.category ?? null,
      category: categorization.category,
      pending: input.txn.pending,
      removed: false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [plaidTransactions.storeId, plaidTransactions.plaidTransactionId],
      set: {
        transactionDate: input.txn.date,
        amount: String(input.txn.amount),
        currency: transactionCurrency(input.txn),
        name: input.txn.name,
        merchantName: input.txn.merchant_name,
        plaidCategories: input.txn.category ?? null,
        category: categorization.category,
        pending: input.txn.pending,
        removed: false,
        updatedAt: new Date(),
      },
    })
    .returning({ id: plaidTransactions.id, category: plaidTransactions.category });

  if (!row) return;

  if (isUncategorized) {
    await queueUncategorizedTransaction(db, input.storeId, row.id);
  }
}

async function markTransactionsRemoved(
  db: Database,
  storeId: string,
  removed: Array<{ transaction_id: string }>,
): Promise<void> {
  if (removed.length === 0) return;

  const ids = removed.map((item) => item.transaction_id);
  await db
    .update(plaidTransactions)
    .set({ removed: true, updatedAt: new Date() })
    .where(
      and(eq(plaidTransactions.storeId, storeId), inArray(plaidTransactions.plaidTransactionId, ids)),
    );
}

async function writeBankBalanceSnapshot(
  storeId: string,
  balance: { current: string; available: string | null; currency: string },
): Promise<void> {
  const writer = await getCashDailyWriter();
  const today = new Date().toISOString().slice(0, 10);
  const row: MartCashDailyRow = {
    store_id: storeId,
    day: today,
    balance: balance.current,
    currency: balance.currency,
    expected_inflows: "0",
    expected_inflow_count: 0,
    shopify_payments_available: false,
    bank_balance: balance.current,
    bank_available_balance: balance.available,
    plaid_connected: true,
    ingested_at: new Date().toISOString(),
  };
  await writer.upsert(row);
}

export async function syncPlaidTransactionsForStore(
  db: Database,
  storeId: string,
  config: PlaidConfig = getPlaidConfig(),
): Promise<void> {
  const context = await getPlaidIntegrationContext(db, storeId);
  if (!context) return;

  await db
    .update(integrations)
    .set({ status: "syncing" })
    .where(eq(integrations.id, context.integrationId));

  await db
    .insert(plaidIntegrationState)
    .values({ integrationId: context.integrationId, lastError: null })
    .onConflictDoNothing();

  try {
    const syncResult = await syncAllPlaidTransactions({
      clientId: config.clientId,
      secret: config.secret,
      environment: config.environment,
      accessToken: context.accessToken,
      cursor: context.transactionsCursor,
    });

    for (const txn of [...syncResult.added, ...syncResult.modified]) {
      if (txn.account_id !== context.plaidAccountId) continue;
      await upsertPlaidTransaction(db, {
        storeId: context.storeId,
        integrationId: context.integrationId,
        txn,
      });
    }

    await markTransactionsRemoved(db, context.storeId, syncResult.removed);

    const balances = await fetchPlaidBalances({
      clientId: config.clientId,
      secret: config.secret,
      environment: config.environment,
      accessToken: context.accessToken,
      accountIds: [context.plaidAccountId],
    });

    const account = balances.accounts.find((item) => item.account_id === context.plaidAccountId);
    const current = account?.balances.current ?? 0;
    const available = account?.balances.available;
    const currency =
      account?.balances.iso_currency_code ?? account?.balances.unofficial_currency_code ?? "USD";

    const allSynced = [...syncResult.added, ...syncResult.modified];
    const oldestCandidate = oldestTransactionDate(allSynced);
    const oldest =
      context.oldestTransactionDate && oldestCandidate
        ? context.oldestTransactionDate < oldestCandidate
          ? context.oldestTransactionDate
          : oldestCandidate
        : (oldestCandidate ?? context.oldestTransactionDate);
    const initialSyncCompleted = context.initialSyncCompleted || Boolean(syncResult.nextCursor);

    await writeBankBalanceSnapshot(storeId, {
      current: String(current),
      available: available != null ? String(available) : null,
      currency,
    });

    await db
      .update(plaidIntegrationState)
      .set({
        transactionsCursor: syncResult.nextCursor,
        initialSyncCompleted,
        oldestTransactionDate: oldest,
        lastTransactionSyncAt: new Date(),
        lastBalanceSnapshotAt: new Date(),
        lastBankBalance: String(current),
        lastBankAvailableBalance: available != null ? String(available) : null,
        bankCurrency: currency,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(plaidIntegrationState.integrationId, context.integrationId));

    await db
      .update(integrations)
      .set({ status: "connected", lastSyncAt: new Date() })
      .where(eq(integrations.id, context.integrationId));

    await runPayoutMatchingForStore(db, storeId);
    await computeCashRunwayForStore(db, storeId, { force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "plaid_sync_failed";

    await db
      .update(plaidIntegrationState)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(plaidIntegrationState.integrationId, context.integrationId));

    await db
      .update(integrations)
      .set({ status: "error" })
      .where(eq(integrations.id, context.integrationId));

    throw error;
  }
}

export async function syncPlaidTransactionsForItem(
  db: Database,
  itemId: string,
  config: PlaidConfig = getPlaidConfig(),
): Promise<void> {
  const context = await getPlaidIntegrationByItemId(db, itemId);
  if (!context) return;
  await syncPlaidTransactionsForStore(db, context.storeId, config);
}

export async function syncPlaidTransactionsForConnectedStores(
  db: Database,
  storeId?: string,
): Promise<void> {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) return;

  const config = getPlaidConfig();
  const pollBefore = new Date(Date.now() - env.PLAID_SYNC_INTERVAL_MS);

  const rows = await db
    .select({
      storeId: integrations.storeId,
      lastSyncAt: integrations.lastSyncAt,
      initialSyncCompleted: plaidIntegrationState.initialSyncCompleted,
    })
    .from(integrations)
    .leftJoin(plaidIntegrationState, eq(plaidIntegrationState.integrationId, integrations.id))
    .where(
      and(
        eq(integrations.provider, "plaid"),
        inArray(integrations.status, ["connected", "syncing"]),
        storeId ? eq(integrations.storeId, storeId) : undefined,
        storeId
          ? undefined
          : or(
              isNull(integrations.lastSyncAt),
              isNull(plaidIntegrationState.initialSyncCompleted),
              eq(plaidIntegrationState.initialSyncCompleted, false),
              lt(integrations.lastSyncAt, pollBefore),
            ),
      ),
    )
    .limit(storeId ? 1 : 25);

  for (const row of rows) {
    await syncPlaidTransactionsForStore(db, row.storeId, config);
  }
}

export type UncategorizedTransactionsView = {
  total_pending: number;
  batches: Array<{
    id: string;
    transaction_count: number;
    created_at: string;
    sample_transactions: Array<{
      id: string;
      date: string;
      amount: string;
      name: string;
      merchant_name: string | null;
    }>;
  }>;
};

export async function getUncategorizedTransactions(
  db: Database,
  storeId: string,
): Promise<UncategorizedTransactionsView> {
  const batches = await db
    .select()
    .from(plaidClassificationBatches)
    .where(
      and(eq(plaidClassificationBatches.storeId, storeId), eq(plaidClassificationBatches.status, "pending")),
    )
    .orderBy(desc(plaidClassificationBatches.createdAt));

  const result: UncategorizedTransactionsView = {
    total_pending: 0,
    batches: [],
  };

  for (const batch of batches) {
    const transactions = await db
      .select({
        id: plaidTransactions.id,
        date: plaidTransactions.transactionDate,
        amount: plaidTransactions.amount,
        name: plaidTransactions.name,
        merchantName: plaidTransactions.merchantName,
      })
      .from(plaidClassificationQueue)
      .innerJoin(plaidTransactions, eq(plaidTransactions.id, plaidClassificationQueue.plaidTransactionId))
      .where(
        and(
          eq(plaidClassificationQueue.batchId, batch.id),
          eq(plaidClassificationQueue.status, "pending"),
        ),
      )
      .limit(5);

    result.total_pending += batch.transactionCount;
    result.batches.push({
      id: batch.id,
      transaction_count: batch.transactionCount,
      created_at: batch.createdAt.toISOString(),
      sample_transactions: transactions.map((txn) => ({
        id: txn.id,
        date: txn.date,
        amount: String(txn.amount),
        name: txn.name,
        merchant_name: txn.merchantName,
      })),
    });
  }

  return result;
}

export async function getPendingUncategorizedCount(db: Database, storeId: string): Promise<number> {
  const batches = await db
    .select({ count: plaidClassificationBatches.transactionCount })
    .from(plaidClassificationBatches)
    .where(
      and(eq(plaidClassificationBatches.storeId, storeId), eq(plaidClassificationBatches.status, "pending")),
    );

  return batches.reduce((sum, batch) => sum + batch.count, 0);
}
