export const QUICKBOOKS_MORGAN_CATEGORIES = [
  "cogs",
  "shipping",
  "marketing",
  "opex",
  "other",
  "unmapped",
] as const;

export type QuickBooksMorganCategory = (typeof QUICKBOOKS_MORGAN_CATEGORIES)[number];

export function isQuickBooksMorganCategory(value: string): value is QuickBooksMorganCategory {
  return (QUICKBOOKS_MORGAN_CATEGORIES as readonly string[]).includes(value);
}
