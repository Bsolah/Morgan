import {
  fetchQuickBooksAccounts,
  fetchQuickBooksBills,
  fetchQuickBooksDeposits,
  fetchQuickBooksProfitAndLoss,
  fetchQuickBooksPurchases,
  type QuickBooksTxnRecord,
} from "../quickbooks/reports.js";
import type { QuickBooksEnvironment } from "../quickbooks/oauth.js";
import type { AccountingProvider } from "./provider.js";
import type {
  AccountingAccount,
  AccountingDeposit,
  AccountingExpense,
  AccountingPeriod,
  PnLReport,
} from "./types.js";

function mapTxnAccounts(txn: QuickBooksTxnRecord): string[] {
  const ids = new Set<string>();
  if (txn.DepositToAccountRef?.value) ids.add(txn.DepositToAccountRef.value);
  for (const line of txn.Line ?? []) {
    const accountId = line.AccountBasedExpenseLineDetail?.AccountRef?.value;
    if (accountId) ids.add(accountId);
  }
  return [...ids];
}

function mapExpense(txn: QuickBooksTxnRecord, sourceType: string): AccountingExpense {
  return {
    id: txn.Id,
    txn_date: txn.TxnDate ?? new Date().toISOString().slice(0, 10),
    total_amount: Number(txn.TotalAmt ?? 0),
    currency: txn.CurrencyRef?.value ?? "USD",
    account_ids: mapTxnAccounts(txn),
    updated_at: txn.MetaData?.LastUpdatedTime ?? null,
    source_type: sourceType,
  };
}

function mapDeposit(txn: QuickBooksTxnRecord): AccountingDeposit {
  return {
    id: txn.Id,
    txn_date: txn.TxnDate ?? new Date().toISOString().slice(0, 10),
    total_amount: Number(txn.TotalAmt ?? 0),
    currency: txn.CurrencyRef?.value ?? "USD",
    account_ids: mapTxnAccounts(txn),
    updated_at: txn.MetaData?.LastUpdatedTime ?? null,
    source_type: "deposit",
  };
}

export class QuickBooksProvider implements AccountingProvider {
  readonly providerId = "quickbooks" as const;

  constructor(
    private readonly opts: {
      environment: QuickBooksEnvironment;
      accessToken: string;
      realmId: string;
    },
  ) {}

  async fetchAccounts(): Promise<AccountingAccount[]> {
    const rows = await fetchQuickBooksAccounts(this.opts);
    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      account_type: row.AccountType ?? null,
      account_subtype: row.AccountSubType ?? null,
      is_active: row.Active ?? true,
    }));
  }

  async fetchPnL(period: AccountingPeriod): Promise<PnLReport> {
    const report = await fetchQuickBooksProfitAndLoss({
      ...this.opts,
      startDate: period.startDate,
      endDate: period.endDate,
    });

    return {
      start_date: report.start_date,
      end_date: report.end_date,
      lines: report.lines,
      total_income: report.total_income,
    };
  }

  async fetchExpenses(updatedAfter: string | null): Promise<AccountingExpense[]> {
    const [bills, purchases] = await Promise.all([
      fetchQuickBooksBills({ ...this.opts, updatedAfter }),
      fetchQuickBooksPurchases({ ...this.opts, updatedAfter }),
    ]);

    return [
      ...bills.map((txn) => mapExpense(txn, "bill")),
      ...purchases.map((txn) => mapExpense(txn, "purchase")),
    ];
  }

  async fetchDeposits(updatedAfter: string | null): Promise<AccountingDeposit[]> {
    const deposits = await fetchQuickBooksDeposits({ ...this.opts, updatedAfter });
    return deposits.map(mapDeposit);
  }
}
