import type { AccountingMorganCategory } from "./categories.js";
import { periodMonthFromDay, sumPnlByCategory } from "./pnl.js";
import type { AccountingProvider } from "./provider.js";
import type {
  AccountingAccount,
  AccountingCategoryTotals,
  AccountingDeposit,
  AccountingExpense,
  AccountingPeriod,
  AccountingProviderId,
  PnLReport,
} from "./types.js";

export type Expense = AccountingExpense;
export type Deposit = AccountingDeposit;

export type BooksSyncCategoryMaps = {
  byAccountId: Map<string, AccountingMorganCategory>;
  byAccountName: Map<string, AccountingMorganCategory>;
};

export type BooksSyncFetchOptions = {
  period: AccountingPeriod;
  updatedAfter: string | null;
  maxRetries?: number;
  categoryMaps: BooksSyncCategoryMaps;
};

export type BooksSyncResult = {
  providerId: AccountingProviderId;
  accounts: AccountingAccount[];
  pnl: PnLReport;
  expenses: Expense[];
  deposits: Deposit[];
  categoryTotals: AccountingCategoryTotals;
  asOfDay: string;
  periodMonth: string;
};

export async function withBooksSyncRetries<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

export async function fetchBooksSyncData(
  provider: AccountingProvider,
  options: BooksSyncFetchOptions,
): Promise<BooksSyncResult> {
  const maxRetries = options.maxRetries ?? 3;

  const [accounts, pnl, expenses, deposits] = await withBooksSyncRetries(
    () =>
      Promise.all([
        provider.fetchAccounts(),
        provider.fetchPnL(options.period),
        provider.fetchExpenses(options.updatedAfter),
        provider.fetchDeposits(options.updatedAfter),
      ]),
    maxRetries,
  );

  const categoryTotals = sumPnlByCategory(
    pnl.lines,
    options.categoryMaps.byAccountId,
    options.categoryMaps.byAccountName,
  );

  const asOfDay = options.period.endDate;

  return {
    providerId: provider.providerId,
    accounts,
    pnl,
    expenses,
    deposits,
    categoryTotals,
    asOfDay,
    periodMonth: periodMonthFromDay(asOfDay),
  };
}
