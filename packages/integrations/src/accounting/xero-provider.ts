import {
  fetchXeroAccounts,
  fetchXeroBankTransactions,
  fetchXeroInvoices,
  fetchXeroProfitAndLoss,
  mapXeroBankTransaction,
  mapXeroInvoiceExpense,
} from "../xero/reports.js";
import type { AccountingProvider } from "./provider.js";
import type {
  AccountingAccount,
  AccountingDeposit,
  AccountingExpense,
  AccountingPeriod,
  PnLReport,
} from "./types.js";

export class XeroProvider implements AccountingProvider {
  readonly providerId = "xero" as const;

  constructor(
    private readonly opts: {
      accessToken: string;
      tenantId: string;
    },
  ) {}

  async fetchAccounts(): Promise<AccountingAccount[]> {
    const rows = await fetchXeroAccounts(this.opts);
    return rows.map((row) => ({
      id: row.AccountID,
      name: row.Name,
      account_type: row.Type ?? null,
      account_subtype: row.Class ?? null,
      is_active: (row.Status ?? "ACTIVE") === "ACTIVE",
    }));
  }

  async fetchPnL(period: AccountingPeriod): Promise<PnLReport> {
    const report = await fetchXeroProfitAndLoss({
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
    const [invoices, bankTransactions] = await Promise.all([
      fetchXeroInvoices({ ...this.opts, updatedAfter }),
      fetchXeroBankTransactions({ ...this.opts, updatedAfter }),
    ]);

    const spendTransactions = bankTransactions
      .filter((txn) => txn.Type === "SPEND")
      .map((txn) => mapXeroBankTransaction(txn, "bank_spend"));

    return [...invoices.map(mapXeroInvoiceExpense), ...spendTransactions];
  }

  async fetchDeposits(updatedAfter: string | null): Promise<AccountingDeposit[]> {
    const bankTransactions = await fetchXeroBankTransactions({ ...this.opts, updatedAfter });
    return bankTransactions
      .filter((txn) => txn.Type === "RECEIVE")
      .map((txn) => mapXeroBankTransaction(txn, "bank_receive"));
  }
}
