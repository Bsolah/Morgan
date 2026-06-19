import { getPlaidBaseUrl, plaidRequest, type PlaidEnvironment } from "./client.js";

export const PLAID_INITIAL_HISTORY_MONTHS = 24;

export type PlaidSyncTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  date: string;
  authorized_date: string | null;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  personal_finance_category?: {
    primary: string;
    detailed: string;
  } | null;
  category?: string[] | null;
};

export type PlaidTransactionsSyncResponse = {
  added: PlaidSyncTransaction[];
  modified: PlaidSyncTransaction[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
  request_id: string;
};

export type PlaidAccountBalance = {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
    unofficial_currency_code: string | null;
  };
};

export type PlaidBalancesResponse = {
  accounts: PlaidAccountBalance[];
  request_id: string;
};

function plaidConfig(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
}) {
  return {
    baseUrl: getPlaidBaseUrl(opts.environment),
    body: {
      client_id: opts.clientId,
      secret: opts.secret,
      access_token: opts.accessToken,
    },
  };
}

export async function syncPlaidTransactionsPage(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
  cursor?: string | null;
  count?: number;
}): Promise<PlaidTransactionsSyncResponse> {
  const { baseUrl, body } = plaidConfig(opts);

  return plaidRequest<PlaidTransactionsSyncResponse>(baseUrl, "/transactions/sync", {
    ...body,
    ...(opts.cursor ? { cursor: opts.cursor } : {}),
    count: opts.count ?? 500,
    options: {
      include_personal_finance_category: true,
    },
  });
}

export async function syncAllPlaidTransactions(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
  cursor?: string | null;
  maxPages?: number;
}): Promise<{
  added: PlaidSyncTransaction[];
  modified: PlaidSyncTransaction[];
  removed: Array<{ transaction_id: string }>;
  nextCursor: string;
}> {
  const added: PlaidSyncTransaction[] = [];
  const modified: PlaidSyncTransaction[] = [];
  const removed: Array<{ transaction_id: string }> = [];
  let cursor = opts.cursor ?? undefined;
  let nextCursor = "";
  let page = 0;
  const maxPages = opts.maxPages ?? 500;

  while (page < maxPages) {
    const response = await syncPlaidTransactionsPage({
      ...opts,
      cursor,
    });

    added.push(...response.added);
    modified.push(...response.modified);
    removed.push(...response.removed);
    nextCursor = response.next_cursor;

    if (!response.has_more) break;
    cursor = response.next_cursor;
    page += 1;
  }

  return { added, modified, removed, nextCursor };
}

export async function fetchPlaidBalances(opts: {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  accessToken: string;
  accountIds?: string[];
}): Promise<PlaidBalancesResponse> {
  const { baseUrl, body } = plaidConfig(opts);

  return plaidRequest<PlaidBalancesResponse>(baseUrl, "/accounts/balance/get", {
    ...body,
    ...(opts.accountIds?.length ? { options: { account_ids: opts.accountIds } } : {}),
  });
}

export function transactionCurrency(txn: PlaidSyncTransaction): string {
  return txn.iso_currency_code ?? txn.unofficial_currency_code ?? "USD";
}

export function oldestTransactionDate(transactions: PlaidSyncTransaction[]): string | null {
  if (transactions.length === 0) return null;
  return transactions.reduce((oldest, txn) => (txn.date < oldest ? txn.date : oldest), transactions[0]!.date);
}

export function monthsBetween(startDay: string, endDay: string): number {
  const start = new Date(`${startDay}T00:00:00.000Z`);
  const end = new Date(`${endDay}T00:00:00.000Z`);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}
