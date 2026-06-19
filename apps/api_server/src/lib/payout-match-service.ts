import { and, eq, or, sql } from "drizzle-orm";
import {
  integrations,
  payoutDepositMatches,
  payoutMatchAuditLog,
  plaidTransactions,
  shopifyPayouts,
  type Database,
} from "@morgan/db";
import { getCashRunway, type CashRunwayView } from "./cash-runway-service.js";
import { getCashPositionExtras, type CashPositionExtras } from "./cash-position-service.js";
import {
  findAutoPayoutDepositMatches,
  scorePayoutDepositMatch,
  type DepositCandidate,
  type PayoutCandidate,
} from "@morgan/integrations";

type MatchRow = typeof payoutDepositMatches.$inferSelect;

async function getActiveMatchedIds(db: Database, storeId: string) {
  const rows = await db
    .select({
      payoutId: payoutDepositMatches.shopifyPayoutRowId,
      depositId: payoutDepositMatches.plaidTransactionRowId,
    })
    .from(payoutDepositMatches)
    .where(and(eq(payoutDepositMatches.storeId, storeId), eq(payoutDepositMatches.status, "active")));

  return {
    payoutIds: new Set(rows.map((row) => row.payoutId)),
    depositIds: new Set(rows.map((row) => row.depositId)),
  };
}

async function loadPayoutCandidates(db: Database, storeId: string): Promise<PayoutCandidate[]> {
  const { payoutIds } = await getActiveMatchedIds(db, storeId);
  const rows = await db
    .select()
    .from(shopifyPayouts)
    .where(eq(shopifyPayouts.storeId, storeId));

  return rows
    .filter((row) => !payoutIds.has(row.id))
    .map((row) => ({
      id: row.id,
      issuedAt: row.issuedAt.toISOString(),
      netAmount: Number(row.netAmount),
      currency: row.currency,
      status: row.status,
    }));
}

async function loadDepositCandidates(db: Database, storeId: string): Promise<DepositCandidate[]> {
  const { depositIds } = await getActiveMatchedIds(db, storeId);
  const rows = await db
    .select()
    .from(plaidTransactions)
    .where(
      and(
        eq(plaidTransactions.storeId, storeId),
        eq(plaidTransactions.removed, false),
        sql`${plaidTransactions.amount}::numeric > 0`,
      ),
    );

  return rows
    .filter((row) => !depositIds.has(row.id))
    .map((row) => ({
      id: row.id,
      transactionDate: row.transactionDate,
      amount: Number(row.amount),
      currency: row.currency,
      name: row.name,
      merchantName: row.merchantName,
      category: row.category,
      pending: row.pending,
    }));
}

async function writeAuditLog(
  db: Database,
  input: {
    storeId: string;
    matchId?: string | null;
    shopifyPayoutRowId: string;
    plaidTransactionRowId: string;
    action: "link" | "unlink";
    source: "auto" | "manual";
    confidenceScore?: number | null;
    actorUserId?: string | null;
  },
): Promise<void> {
  await db.insert(payoutMatchAuditLog).values({
    storeId: input.storeId,
    matchId: input.matchId ?? null,
    shopifyPayoutRowId: input.shopifyPayoutRowId,
    plaidTransactionRowId: input.plaidTransactionRowId,
    action: input.action,
    source: input.source,
    confidenceScore: input.confidenceScore != null ? String(input.confidenceScore) : null,
    actorUserId: input.actorUserId ?? null,
  });
}

async function createActiveMatch(
  db: Database,
  input: {
    storeId: string;
    shopifyPayoutRowId: string;
    plaidTransactionRowId: string;
    confidenceScore: number;
    source: "auto" | "manual";
    actorUserId?: string | null;
  },
): Promise<MatchRow> {
  await db
    .update(payoutDepositMatches)
    .set({ status: "unlinked", unlinkedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(payoutDepositMatches.storeId, input.storeId),
        eq(payoutDepositMatches.status, "active"),
        or(
          eq(payoutDepositMatches.shopifyPayoutRowId, input.shopifyPayoutRowId),
          eq(payoutDepositMatches.plaidTransactionRowId, input.plaidTransactionRowId),
        ),
      ),
    );

  const [match] = await db
    .insert(payoutDepositMatches)
    .values({
      storeId: input.storeId,
      shopifyPayoutRowId: input.shopifyPayoutRowId,
      plaidTransactionRowId: input.plaidTransactionRowId,
      confidenceScore: String(input.confidenceScore),
      matchSource: input.source,
      status: "active",
      matchedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!match) {
    throw new Error("match_create_failed");
  }

  await writeAuditLog(db, {
    storeId: input.storeId,
    matchId: match.id,
    shopifyPayoutRowId: input.shopifyPayoutRowId,
    plaidTransactionRowId: input.plaidTransactionRowId,
    action: "link",
    source: input.source,
    confidenceScore: input.confidenceScore,
    actorUserId: input.actorUserId,
  });

  return match;
}

export async function runPayoutMatchingForStore(db: Database, storeId: string): Promise<number> {
  const payouts = await loadPayoutCandidates(db, storeId);
  const deposits = await loadDepositCandidates(db, storeId);
  const matches = findAutoPayoutDepositMatches(payouts, deposits);

  for (const candidate of matches) {
    await createActiveMatch(db, {
      storeId,
      shopifyPayoutRowId: candidate.payoutId,
      plaidTransactionRowId: candidate.depositId,
      confidenceScore: candidate.confidenceScore,
      source: "auto",
    });
  }

  return matches.length;
}

function mapPayoutSummary(row: typeof shopifyPayouts.$inferSelect) {
  return {
    id: row.id,
    shopify_payout_id: row.shopifyPayoutId,
    issued_at: row.issuedAt.toISOString(),
    amount: String(row.netAmount),
    currency: row.currency,
    status: row.status,
  };
}

function mapDepositSummary(row: typeof plaidTransactions.$inferSelect) {
  return {
    id: row.id,
    date: row.transactionDate,
    amount: String(row.amount),
    currency: row.currency,
    name: row.name,
    merchant_name: row.merchantName,
    category: row.category,
    pending: row.pending,
  };
}

export type CashOverviewView = {
  bank_connected: boolean;
  runway: CashRunwayView;
  window_days: number;
  flow_breakdown: CashPositionExtras["flow_breakdown"];
  expected_payouts: CashPositionExtras["expected_payouts"];
  profit_only: CashPositionExtras["profit_only"];
  matched_count: number;
  unmatched_payout_count: number;
  unmatched_deposit_count: number;
  has_reconciliation_gaps: boolean;
  matched: CashMatchedPairView[];
  unmatched_payouts: Array<ReturnType<typeof mapPayoutSummary>>;
  unmatched_deposits: Array<ReturnType<typeof mapDepositSummary>>;
};

export type CashMatchedPairView = {
  id: string;
  confidence_score: number;
  match_source: "auto" | "manual";
  matched_at: string;
  payout: ReturnType<typeof mapPayoutSummary>;
  deposit: ReturnType<typeof mapDepositSummary>;
};

export type UnmatchedCashView = {
  bank_connected: boolean;
  matched_count: number;
  unmatched_payout_count: number;
  unmatched_deposit_count: number;
  has_reconciliation_gaps: boolean;
  matched: CashMatchedPairView[];
  unmatched_payouts: Array<ReturnType<typeof mapPayoutSummary>>;
  unmatched_deposits: Array<ReturnType<typeof mapDepositSummary>>;
};

export async function getUnmatchedCashTransactions(
  db: Database,
  storeId: string,
): Promise<UnmatchedCashView> {
  const overview = await getCashOverview(db, storeId);
  return {
    bank_connected: overview.bank_connected,
    matched_count: overview.matched_count,
    unmatched_payout_count: overview.unmatched_payout_count,
    unmatched_deposit_count: overview.unmatched_deposit_count,
    has_reconciliation_gaps: overview.has_reconciliation_gaps,
    matched: overview.matched,
    unmatched_payouts: overview.unmatched_payouts,
    unmatched_deposits: overview.unmatched_deposits,
  };
}

export async function getCashOverview(db: Database, storeId: string): Promise<CashOverviewView> {
  const [bankIntegration] = await db
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

  const bankConnected = Boolean(bankIntegration);

  const activeMatches = await db
    .select({
      match: payoutDepositMatches,
      payout: shopifyPayouts,
      deposit: plaidTransactions,
    })
    .from(payoutDepositMatches)
    .innerJoin(shopifyPayouts, eq(shopifyPayouts.id, payoutDepositMatches.shopifyPayoutRowId))
    .innerJoin(plaidTransactions, eq(plaidTransactions.id, payoutDepositMatches.plaidTransactionRowId))
    .where(and(eq(payoutDepositMatches.storeId, storeId), eq(payoutDepositMatches.status, "active")))
    .orderBy(sql`${payoutDepositMatches.matchedAt} desc`);

  const matchedPayoutIds = activeMatches.map((row) => row.payout.id);
  const matchedDepositIds = activeMatches.map((row) => row.deposit.id);

  const payoutQuery = db.select().from(shopifyPayouts).where(eq(shopifyPayouts.storeId, storeId));
  const depositQuery = db
    .select()
    .from(plaidTransactions)
    .where(
      and(
        eq(plaidTransactions.storeId, storeId),
        eq(plaidTransactions.removed, false),
        sql`${plaidTransactions.amount}::numeric > 0`,
      ),
    );

  const [allPayouts, allDeposits] = await Promise.all([payoutQuery, depositQuery]);

  const unmatchedPayouts = allPayouts.filter((row) => !matchedPayoutIds.includes(row.id));
  const unmatchedDeposits = allDeposits.filter((row) => !matchedDepositIds.includes(row.id));
  const [runway, positionExtras] = await Promise.all([
    getCashRunway(db, storeId),
    getCashPositionExtras(db, storeId, bankConnected),
  ]);

  return {
    bank_connected: bankConnected,
    runway,
    window_days: positionExtras.window_days,
    flow_breakdown: positionExtras.flow_breakdown,
    expected_payouts: positionExtras.expected_payouts,
    profit_only: positionExtras.profit_only,
    matched_count: activeMatches.length,
    unmatched_payout_count: unmatchedPayouts.length,
    unmatched_deposit_count: unmatchedDeposits.length,
    has_reconciliation_gaps: unmatchedPayouts.length > 0 || unmatchedDeposits.length > 0,
    matched: activeMatches.map((row) => ({
      id: row.match.id,
      confidence_score: Number(row.match.confidenceScore),
      match_source: row.match.matchSource,
      matched_at: row.match.matchedAt.toISOString(),
      payout: mapPayoutSummary(row.payout),
      deposit: mapDepositSummary(row.deposit),
    })),
    unmatched_payouts: unmatchedPayouts.map(mapPayoutSummary),
    unmatched_deposits: unmatchedDeposits.map(mapDepositSummary),
  };
}

async function getPayoutById(db: Database, storeId: string, payoutRowId: string) {
  const [row] = await db
    .select()
    .from(shopifyPayouts)
    .where(and(eq(shopifyPayouts.storeId, storeId), eq(shopifyPayouts.id, payoutRowId)))
    .limit(1);
  return row ?? null;
}

async function getDepositById(db: Database, storeId: string, depositRowId: string) {
  const [row] = await db
    .select()
    .from(plaidTransactions)
    .where(
      and(
        eq(plaidTransactions.storeId, storeId),
        eq(plaidTransactions.id, depositRowId),
        eq(plaidTransactions.removed, false),
        sql`${plaidTransactions.amount}::numeric > 0`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function manualLinkPayoutDeposit(
  db: Database,
  storeId: string,
  shopifyPayoutRowId: string,
  plaidTransactionRowId: string,
  actorUserId?: string | null,
): Promise<CashOverviewView> {
  const payout = await getPayoutById(db, storeId, shopifyPayoutRowId);
  const deposit = await getDepositById(db, storeId, plaidTransactionRowId);

  if (!payout || !deposit) {
    throw new Error("match_entities_not_found");
  }

  const confidenceScore =
    scorePayoutDepositMatch(
      {
        id: payout.id,
        issuedAt: payout.issuedAt.toISOString(),
        netAmount: Number(payout.netAmount),
        currency: payout.currency,
        status: payout.status,
      },
      {
        id: deposit.id,
        transactionDate: deposit.transactionDate,
        amount: Number(deposit.amount),
        currency: deposit.currency,
        name: deposit.name,
        merchantName: deposit.merchantName,
        category: deposit.category,
        pending: deposit.pending,
      },
    ) ?? 100;

  await createActiveMatch(db, {
    storeId,
    shopifyPayoutRowId,
    plaidTransactionRowId,
    confidenceScore,
    source: "manual",
    actorUserId,
  });

  return getCashOverview(db, storeId);
}

export async function unlinkPayoutDepositMatch(
  db: Database,
  storeId: string,
  matchId: string,
  actorUserId?: string | null,
): Promise<CashOverviewView> {
  const [match] = await db
    .select()
    .from(payoutDepositMatches)
    .where(
      and(
        eq(payoutDepositMatches.id, matchId),
        eq(payoutDepositMatches.storeId, storeId),
        eq(payoutDepositMatches.status, "active"),
      ),
    )
    .limit(1);

  if (!match) {
    throw new Error("match_not_found");
  }

  await db
    .update(payoutDepositMatches)
    .set({ status: "unlinked", unlinkedAt: new Date(), updatedAt: new Date() })
    .where(eq(payoutDepositMatches.id, match.id));

  await writeAuditLog(db, {
    storeId,
    matchId: match.id,
    shopifyPayoutRowId: match.shopifyPayoutRowId,
    plaidTransactionRowId: match.plaidTransactionRowId,
    action: "unlink",
    source: "manual",
    confidenceScore: Number(match.confidenceScore),
    actorUserId,
  });

  return getCashOverview(db, storeId);
}
