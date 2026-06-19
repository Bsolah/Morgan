import type { QuickBooksMorganCategory } from "./categories.js";

export type QuickBooksAccountRecord = {
  Id: string;
  Name: string;
  AccountType?: string;
  AccountSubType?: string;
  Active?: boolean;
};

export function defaultMorganCategoryForAccount(account: QuickBooksAccountRecord): QuickBooksMorganCategory {
  const type = (account.AccountType ?? "").toLowerCase();
  const subtype = (account.AccountSubType ?? "").toLowerCase();
  const name = (account.Name ?? "").toLowerCase();

  if (type.includes("cost of goods sold") || subtype.includes("cogs") || subtype.includes("suppliesmaterials")) {
    return "cogs";
  }

  if (name.includes("shipping") || name.includes("freight") || name.includes("postage")) {
    return "shipping";
  }

  if (
    name.includes("advertis") ||
    name.includes("marketing") ||
    name.includes("facebook") ||
    name.includes("google ads") ||
    name.includes("meta ads")
  ) {
    return "marketing";
  }

  if (type.includes("expense") || type.includes("other expense")) {
    return "opex";
  }

  if (type.includes("income") || type.includes("other income")) {
    return "other";
  }

  return "unmapped";
}
