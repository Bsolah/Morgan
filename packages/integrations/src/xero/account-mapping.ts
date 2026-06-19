import type { AccountingMorganCategory } from "../accounting/categories.js";

export type XeroAccountRecord = {
  AccountID: string;
  Name: string;
  Type?: string;
  Class?: string;
  Status?: string;
};

export function defaultMorganCategoryForXeroAccount(account: XeroAccountRecord): AccountingMorganCategory {
  const type = (account.Type ?? "").toUpperCase();
  const accountClass = (account.Class ?? "").toUpperCase();
  const name = (account.Name ?? "").toLowerCase();

  if (type === "DIRECTCOSTS" || accountClass === "EXPENSE" && name.includes("cost of goods")) {
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

  if (type === "EXPENSE" || type === "OVERHEADS") {
    return "opex";
  }

  if (type === "REVENUE" || type === "OTHERINCOME") {
    return "other";
  }

  return "unmapped";
}
