import { quickBooksApiFetch, quickBooksQuery } from "./client.js";
import type { QuickBooksEnvironment } from "./oauth.js";
import type { QuickBooksAccountRecord } from "./account-mapping.js";

export type QuickBooksPnlLine = {
  account_id: string | null;
  account_name: string;
  amount: number;
  section: string | null;
};

export type QuickBooksPnlReport = {
  start_date: string;
  end_date: string;
  lines: QuickBooksPnlLine[];
  total_income: number;
};

export type QuickBooksTxnRecord = {
  Id: string;
  TxnDate?: string;
  TotalAmt?: number;
  CurrencyRef?: { value?: string };
  MetaData?: { LastUpdatedTime?: string };
  Line?: Array<{ Amount?: number; AccountBasedExpenseLineDetail?: { AccountRef?: { value?: string } } }>;
  DepositToAccountRef?: { value?: string };
};

function parseMoney(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function flattenReportRows(
  rows: unknown[],
  section: string | null,
  output: QuickBooksPnlLine[],
): void {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;

    if (record.type === "Section" && Array.isArray(record.Rows?.Row)) {
      const header = record.Header?.ColData?.[0]?.value;
      flattenReportRows(record.Rows.Row as unknown[], typeof header === "string" ? header : section, output);
      continue;
    }

    if (record.ColData && Array.isArray(record.ColData)) {
      const colData = record.ColData as Array<{ value?: string; id?: string }>;
      const accountName = colData[0]?.value ?? "Unknown";
      const amount = parseMoney(colData[colData.length - 1]?.value);
      if (amount === 0) continue;
      output.push({
        account_id: colData[0]?.id ?? null,
        account_name: accountName,
        amount,
        section,
      });
    }

    if (record.Rows?.Row && Array.isArray(record.Rows.Row)) {
      flattenReportRows(record.Rows.Row as unknown[], section, output);
    }
  }
}

export async function fetchQuickBooksProfitAndLoss(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  startDate: string;
  endDate: string;
}): Promise<QuickBooksPnlReport> {
  const response = await quickBooksApiFetch<{ Rows?: { Row?: unknown[] } }>({
    environment: opts.environment,
    accessToken: opts.accessToken,
    realmId: opts.realmId,
    path: "reports/ProfitAndLoss",
    query: {
      start_date: opts.startDate,
      end_date: opts.endDate,
      accounting_method: "Accrual",
    },
  });

  const lines: QuickBooksPnlLine[] = [];
  const topRows = response.Rows?.Row;
  if (Array.isArray(topRows)) {
    flattenReportRows(topRows, null, lines);
  }

  const incomeLines = lines.filter(
    (line) =>
      line.section?.toLowerCase().includes("income") ||
      line.account_name.toLowerCase().includes("income") ||
      line.account_name.toLowerCase().includes("sales"),
  );

  return {
    start_date: opts.startDate,
    end_date: opts.endDate,
    lines,
    total_income: incomeLines.reduce((sum, line) => sum + Math.abs(line.amount), 0),
  };
}

export async function fetchQuickBooksAccounts(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
}): Promise<QuickBooksAccountRecord[]> {
  return quickBooksQuery<QuickBooksAccountRecord>({
    ...opts,
    query: "select Id, Name, AccountType, AccountSubType, Active from Account maxresults 1000",
  });
}

function incrementalQuery(entity: string, updatedAfter: string | null): string {
  if (!updatedAfter) {
    return `select * from ${entity} maxresults 500`;
  }
  return `select * from ${entity} where MetaData.LastUpdatedTime > '${updatedAfter}' maxresults 500`;
}

export async function fetchQuickBooksBills(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  updatedAfter?: string | null;
}): Promise<QuickBooksTxnRecord[]> {
  return quickBooksQuery<QuickBooksTxnRecord>({
    ...opts,
    query: incrementalQuery("Bill", opts.updatedAfter ?? null),
  });
}

export async function fetchQuickBooksPurchases(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  updatedAfter?: string | null;
}): Promise<QuickBooksTxnRecord[]> {
  return quickBooksQuery<QuickBooksTxnRecord>({
    ...opts,
    query: incrementalQuery("Purchase", opts.updatedAfter ?? null),
  });
}

export async function fetchQuickBooksDeposits(opts: {
  environment: QuickBooksEnvironment;
  accessToken: string;
  realmId: string;
  updatedAfter?: string | null;
}): Promise<QuickBooksTxnRecord[]> {
  return quickBooksQuery<QuickBooksTxnRecord>({
    ...opts,
    query: incrementalQuery("Deposit", opts.updatedAfter ?? null),
  });
}

export function monthToDateRange(referenceDay = new Date()): { startDate: string; endDate: string } {
  const endDate = referenceDay.toISOString().slice(0, 10);
  const startDate = `${endDate.slice(0, 7)}-01`;
  return { startDate, endDate };
}

export function periodMonthFromDay(day: string): string {
  return day.slice(0, 7);
}
