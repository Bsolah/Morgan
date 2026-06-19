export const ACCOUNTING_MORGAN_CATEGORIES = [
  "cogs",
  "shipping",
  "marketing",
  "opex",
  "other",
  "unmapped",
] as const;

export type AccountingMorganCategory = (typeof ACCOUNTING_MORGAN_CATEGORIES)[number];

export function isAccountingMorganCategory(value: string): value is AccountingMorganCategory {
  return (ACCOUNTING_MORGAN_CATEGORIES as readonly string[]).includes(value);
}

export const QUICKBOOKS_MORGAN_CATEGORIES = ACCOUNTING_MORGAN_CATEGORIES;
export type QuickBooksMorganCategory = AccountingMorganCategory;
export const isQuickBooksMorganCategory = isAccountingMorganCategory;
