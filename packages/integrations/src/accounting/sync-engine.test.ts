import { describe, expect, it } from "vitest";
import type { AccountingMorganCategory } from "./categories.js";
import { fetchBooksSyncData, type BooksSyncCategoryMaps } from "./sync-engine.js";
import type { AccountingProvider } from "./provider.js";
import type {
  AccountingAccount,
  AccountingDeposit,
  AccountingExpense,
  AccountingPeriod,
  PnLReport,
} from "./types.js";

function categoryMaps(): BooksSyncCategoryMaps {
  return {
    byAccountId: new Map<string, AccountingMorganCategory>([
      ["acc-cogs", "cogs"],
      ["acc-ship", "shipping"],
    ]),
    byAccountName: new Map<string, AccountingMorganCategory>(),
  };
}

function createMockProvider(
  providerId: "quickbooks" | "xero",
  overrides?: Partial<AccountingProvider>,
): AccountingProvider {
  const accounts: AccountingAccount[] = [
    {
      id: "acc-cogs",
      name: "Materials",
      account_type: providerId === "quickbooks" ? "Cost of Goods Sold" : "DIRECTCOSTS",
      account_subtype: null,
      is_active: true,
    },
  ];

  const pnl: PnLReport = {
    start_date: "2026-06-01",
    end_date: "2026-06-17",
    total_income: 10_000,
    lines: [
      {
        account_id: "acc-cogs",
        account_name: "Materials",
        amount: 2_400,
        section: "Expenses",
      },
      {
        account_id: "acc-ship",
        account_name: "Freight",
        amount: 300,
        section: "Expenses",
      },
    ],
  };

  const expenses: AccountingExpense[] = [
    {
      id: `${providerId}-exp-1`,
      txn_date: "2026-06-10",
      total_amount: 500,
      currency: providerId === "quickbooks" ? "USD" : "GBP",
      account_ids: ["acc-cogs"],
      updated_at: "2026-06-10T12:00:00.000Z",
      source_type: providerId === "quickbooks" ? "bill" : "invoice",
    },
  ];

  const deposits: AccountingDeposit[] = [
    {
      id: `${providerId}-dep-1`,
      txn_date: "2026-06-11",
      total_amount: 1_200,
      currency: providerId === "quickbooks" ? "USD" : "GBP",
      account_ids: ["acc-bank"],
      updated_at: "2026-06-11T09:00:00.000Z",
      source_type: providerId === "quickbooks" ? "deposit" : "bank_receive",
    },
  ];

  return {
    providerId,
    fetchAccounts: async () => accounts,
    fetchPnL: async (_period: AccountingPeriod) => pnl,
    fetchExpenses: async () => expenses,
    fetchDeposits: async () => deposits,
    ...overrides,
  };
}

describe("fetchBooksSyncData", () => {
  it("returns normalized books data from a mocked QuickBooks provider", async () => {
    const provider = createMockProvider("quickbooks");
    const result = await fetchBooksSyncData(provider, {
      period: { startDate: "2026-06-01", endDate: "2026-06-17" },
      updatedAfter: null,
      categoryMaps: categoryMaps(),
    });

    expect(result.providerId).toBe("quickbooks");
    expect(result.pnl.total_income).toBe(10_000);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]?.source_type).toBe("bill");
    expect(result.deposits[0]?.source_type).toBe("deposit");
    expect(result.categoryTotals.cogs).toBe(2_400);
    expect(result.categoryTotals.shipping).toBe(300);
    expect(result.asOfDay).toBe("2026-06-17");
    expect(result.periodMonth).toBe("2026-06");
  });

  it("returns normalized books data from a mocked Xero provider", async () => {
    const provider = createMockProvider("xero");
    const result = await fetchBooksSyncData(provider, {
      period: { startDate: "2026-06-01", endDate: "2026-06-17" },
      updatedAfter: "Mon, 16 Jun 2026 00:00:00 GMT",
      categoryMaps: categoryMaps(),
    });

    expect(result.providerId).toBe("xero");
    expect(result.pnl.lines).toHaveLength(2);
    expect(result.expenses[0]?.currency).toBe("GBP");
    expect(result.expenses[0]?.source_type).toBe("invoice");
    expect(result.deposits[0]?.source_type).toBe("bank_receive");
    expect(result.categoryTotals.cogs).toBe(2_400);
  });

  it("uses the same engine output shape for both providers", async () => {
    const quickbooks = await fetchBooksSyncData(createMockProvider("quickbooks"), {
      period: { startDate: "2026-06-01", endDate: "2026-06-17" },
      updatedAfter: null,
      categoryMaps: categoryMaps(),
    });

    const xero = await fetchBooksSyncData(createMockProvider("xero"), {
      period: { startDate: "2026-06-01", endDate: "2026-06-17" },
      updatedAfter: null,
      categoryMaps: categoryMaps(),
    });

    for (const result of [quickbooks, xero]) {
      expect(result).toMatchObject({
        providerId: expect.any(String),
        accounts: expect.any(Array),
        pnl: expect.objectContaining({
          start_date: "2026-06-01",
          end_date: "2026-06-17",
          lines: expect.any(Array),
          total_income: expect.any(Number),
        }),
        expenses: expect.any(Array),
        deposits: expect.any(Array),
        categoryTotals: expect.objectContaining({
          cogs: expect.any(Number),
          shipping: expect.any(Number),
          marketing: expect.any(Number),
          opex: expect.any(Number),
        }),
        asOfDay: "2026-06-17",
        periodMonth: "2026-06",
      });
    }
  });

  it("calls provider fetch methods with the requested period and cursor", async () => {
    const calls: string[] = [];
    const provider = createMockProvider("quickbooks", {
      fetchPnL: async (period) => {
        calls.push(`pnl:${period.startDate}:${period.endDate}`);
        return {
          start_date: period.startDate,
          end_date: period.endDate,
          lines: [],
          total_income: 0,
        };
      },
      fetchExpenses: async (updatedAfter) => {
        calls.push(`expenses:${updatedAfter ?? "null"}`);
        return [];
      },
      fetchDeposits: async (updatedAfter) => {
        calls.push(`deposits:${updatedAfter ?? "null"}`);
        return [];
      },
    });

    await fetchBooksSyncData(provider, {
      period: { startDate: "2026-06-01", endDate: "2026-06-17" },
      updatedAfter: "2026-06-16T00:00:00.000Z",
      categoryMaps: categoryMaps(),
    });

    expect(calls).toEqual([
      "pnl:2026-06-01:2026-06-17",
      "expenses:2026-06-16T00:00:00.000Z",
      "deposits:2026-06-16T00:00:00.000Z",
    ]);
  });
});
