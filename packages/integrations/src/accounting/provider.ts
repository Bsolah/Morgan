import type {
  AccountingAccount,
  AccountingDeposit,
  AccountingExpense,
  AccountingPeriod,
  AccountingProviderId,
  PnLReport,
} from "./types.js";

export interface AccountingProvider {
  readonly providerId: AccountingProviderId;
  fetchAccounts(): Promise<AccountingAccount[]>;
  fetchPnL(period: AccountingPeriod): Promise<PnLReport>;
  fetchExpenses(updatedAfter: string | null): Promise<AccountingExpense[]>;
  fetchDeposits(updatedAfter: string | null): Promise<AccountingDeposit[]>;
}
