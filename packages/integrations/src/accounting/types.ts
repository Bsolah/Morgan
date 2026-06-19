import type { AccountingMorganCategory } from "./categories.js";

export type AccountingProviderId = "quickbooks" | "xero";

export type AccountingPeriod = {
  startDate: string;
  endDate: string;
};

export type PnlLine = {
  account_id: string | null;
  account_name: string;
  amount: number;
  section: string | null;
};

export type PnLReport = {
  start_date: string;
  end_date: string;
  lines: PnlLine[];
  total_income: number;
};

export type AccountingAccount = {
  id: string;
  name: string;
  account_type: string | null;
  account_subtype: string | null;
  is_active: boolean;
};

export type AccountingExpense = {
  id: string;
  txn_date: string;
  total_amount: number;
  currency: string;
  account_ids: string[];
  updated_at: string | null;
  source_type: string;
};

export type AccountingDeposit = {
  id: string;
  txn_date: string;
  total_amount: number;
  currency: string;
  account_ids: string[];
  updated_at: string | null;
  source_type: string;
};

/** Provider-agnostic expense row consumed by accounting engines. */
export type Expense = AccountingExpense;

/** Provider-agnostic deposit row consumed by accounting engines. */
export type Deposit = AccountingDeposit;

export type AccountingCategoryTotals = Record<AccountingMorganCategory, number>;
