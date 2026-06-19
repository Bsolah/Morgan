import { xeroApiFetch, xeroApiList } from "./client.js";
import type { XeroAccountRecord } from "./account-mapping.js";
import type { PnlLine } from "../accounting/types.js";

export type XeroPnlReport = {
  start_date: string;
  end_date: string;
  lines: PnlLine[];
  total_income: number;
};

export type XeroInvoiceRecord = {
  InvoiceID: string;
  Date?: string;
  UpdatedDateUTC?: string;
  Total?: number;
  CurrencyCode?: string;
  Type?: string;
  LineItems?: Array<{ AccountCode?: string; AccountID?: string }>;
};

export type XeroBankTransactionRecord = {
  BankTransactionID: string;
  Date?: string;
  UpdatedDateUTC?: string;
  Total?: number;
  CurrencyCode?: string;
  Type?: "SPEND" | "RECEIVE" | string;
  LineItems?: Array<{ AccountCode?: string; AccountID?: string }>;
  BankAccount?: { AccountID?: string };
};

function parseMoney(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function flattenXeroReportRows(
  rows: unknown[],
  section: string | null,
  output: PnlLine[],
): void {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;

    if (record.RowType === "Section" && Array.isArray(record.Rows)) {
      const title = typeof record.Title === "string" ? record.Title : section;
      flattenXeroReportRows(record.Rows as unknown[], title, output);
      continue;
    }

    if (record.RowType === "Row" && Array.isArray(record.Cells)) {
      const cells = record.Cells as Array<{ Value?: string; Attributes?: Array<{ Value?: string; Id?: string }> }>;
      const accountName = cells[0]?.Value ?? "Unknown";
      const accountId = cells[0]?.Attributes?.[0]?.Value ?? null;
      const amount = parseMoney(cells[cells.length - 1]?.Value);
      if (amount === 0) continue;
      output.push({
        account_id: accountId,
        account_name: accountName,
        amount,
        section,
      });
    }

    if (Array.isArray(record.Rows)) {
      flattenXeroReportRows(record.Rows as unknown[], section, output);
    }
  }
}

export async function fetchXeroAccounts(opts: {
  accessToken: string;
  tenantId: string;
}): Promise<XeroAccountRecord[]> {
  return xeroApiList<XeroAccountRecord>({
    ...opts,
    path: "Accounts",
    collectionKey: "Accounts",
  });
}

export async function fetchXeroProfitAndLoss(opts: {
  accessToken: string;
  tenantId: string;
  startDate: string;
  endDate: string;
}): Promise<XeroPnlReport> {
  const response = await xeroApiFetch<{ Reports?: Array<{ Rows?: unknown[] }> }>({
    ...opts,
    path: "Reports/ProfitAndLoss",
    query: {
      fromDate: opts.startDate,
      toDate: opts.endDate,
    },
  });

  const lines: PnlLine[] = [];
  const topRows = response.Reports?.[0]?.Rows;
  if (Array.isArray(topRows)) {
    flattenXeroReportRows(topRows, null, lines);
  }

  const incomeLines = lines.filter(
    (line) =>
      line.section?.toLowerCase().includes("income") ||
      line.section?.toLowerCase().includes("revenue") ||
      line.account_name.toLowerCase().includes("sales"),
  );

  return {
    start_date: opts.startDate,
    end_date: opts.endDate,
    lines,
    total_income: incomeLines.reduce((sum, line) => sum + Math.abs(line.amount), 0),
  };
}

function lineAccountIds(
  lineItems: Array<{ AccountCode?: string; AccountID?: string }> | undefined,
): string[] {
  const ids = new Set<string>();
  for (const line of lineItems ?? []) {
    if (line.AccountID) ids.add(line.AccountID);
  }
  return [...ids];
}

function parseXeroDate(value: string | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value.startsWith("/Date(")) {
    const ms = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

function parseXeroUpdatedAt(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/Date(")) {
    const ms = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return value;
}

export async function fetchXeroInvoices(opts: {
  accessToken: string;
  tenantId: string;
  updatedAfter?: string | null;
}): Promise<XeroInvoiceRecord[]> {
  const headers: Record<string, string> = {};
  if (opts.updatedAfter) {
    headers["If-Modified-Since"] = opts.updatedAfter;
  }

  const invoices = await xeroApiList<XeroInvoiceRecord>({
    accessToken: opts.accessToken,
    tenantId: opts.tenantId,
    path: "Invoices",
    collectionKey: "Invoices",
    query: { where: 'Type=="ACCPAY"' },
    headers,
  });

  return invoices.filter((invoice) => invoice.Type === "ACCPAY" || !invoice.Type);
}

export async function fetchXeroBankTransactions(opts: {
  accessToken: string;
  tenantId: string;
  updatedAfter?: string | null;
}): Promise<XeroBankTransactionRecord[]> {
  const headers: Record<string, string> = {};
  if (opts.updatedAfter) {
    headers["If-Modified-Since"] = opts.updatedAfter;
  }

  return xeroApiList<XeroBankTransactionRecord>({
    accessToken: opts.accessToken,
    tenantId: opts.tenantId,
    path: "BankTransactions",
    collectionKey: "BankTransactions",
    headers,
  });
}

export function mapXeroInvoiceExpense(invoice: XeroInvoiceRecord) {
  return {
    id: invoice.InvoiceID,
    txn_date: parseXeroDate(invoice.Date),
    total_amount: Number(invoice.Total ?? 0),
    currency: invoice.CurrencyCode ?? "GBP",
    account_ids: lineAccountIds(invoice.LineItems),
    updated_at: parseXeroUpdatedAt(invoice.UpdatedDateUTC),
    source_type: "invoice",
  };
}

export function mapXeroBankTransaction(
  txn: XeroBankTransactionRecord,
  sourceType: "bank_spend" | "bank_receive",
) {
  const accountIds = new Set(lineAccountIds(txn.LineItems));
  if (txn.BankAccount?.AccountID) accountIds.add(txn.BankAccount.AccountID);

  return {
    id: txn.BankTransactionID,
    txn_date: parseXeroDate(txn.Date),
    total_amount: Number(txn.Total ?? 0),
    currency: txn.CurrencyCode ?? "GBP",
    account_ids: [...accountIds],
    updated_at: parseXeroUpdatedAt(txn.UpdatedDateUTC),
    source_type: sourceType,
  };
}

export { lineAccountIds, parseXeroDate, parseXeroUpdatedAt };
