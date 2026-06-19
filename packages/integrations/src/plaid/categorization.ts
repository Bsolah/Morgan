import type { PlaidSyncTransaction } from "./transactions.js";

export const MORGAN_TRANSACTION_CATEGORIES = [
  "shopify_payout",
  "ad_spend",
  "cogs_payment",
  "payroll",
  "saas",
  "other",
] as const;

export type MorganTransactionCategory = (typeof MORGAN_TRANSACTION_CATEGORIES)[number];

export type CategorizationResult =
  | { category: MorganTransactionCategory; confidence: "high" | "medium" }
  | { category: "uncategorized"; confidence: "none" };

type Rule = {
  category: MorganTransactionCategory;
  patterns: RegExp[];
};

const RULES: Rule[] = [
  {
    category: "shopify_payout",
    patterns: [
      /\bshopify\b/i,
      /\bshop\s*pay\b/i,
      /\bshopify\s+capital\b/i,
      /\bshopify\s+payments\b/i,
    ],
  },
  {
    category: "ad_spend",
    patterns: [
      /\bmeta\b/i,
      /\bfacebook\b/i,
      /\bgoogle\s+ads\b/i,
      /\badwords\b/i,
      /\btiktok\s+ads\b/i,
      /\bpinterest\s+ads\b/i,
      /\bsnapchat\s+ads\b/i,
      /\blinkedin\s+ads\b/i,
      /\bamazon\s+ads\b/i,
    ],
  },
  {
    category: "payroll",
    patterns: [
      /\bpayroll\b/i,
      /\badp\b/i,
      /\bgusto\b/i,
      /\bpaychex\b/i,
      /\brippling\b/i,
      /\bdeel\b/i,
      /\bjustworks\b/i,
    ],
  },
  {
    category: "saas",
    patterns: [
      /\bslack\b/i,
      /\bnotion\b/i,
      /\badobe\b/i,
      /\bmicrosoft\b/i,
      /\bgoogle\s+cloud\b/i,
      /\baws\b/i,
      /\bamazon\s+web\s+services\b/i,
      /\bzoom\b/i,
      /\bklaviyo\b/i,
      /\bmailchimp\b/i,
      /\bshopify\s+subscription\b/i,
      /\bshopify\s+apps\b/i,
    ],
  },
  {
    category: "cogs_payment",
    patterns: [
      /\bwholesale\b/i,
      /\bsupplier\b/i,
      /\binventory\b/i,
      /\balibaba\b/i,
      /\bfashiongo\b/i,
      /\bmanufacturer\b/i,
      /\bfulfillment\b/i,
      /\b3pl\b/i,
    ],
  },
];

const PLAID_CATEGORY_MAP: Array<{ pattern: RegExp; category: MorganTransactionCategory }> = [
  { pattern: /INCOME/i, category: "shopify_payout" },
  { pattern: /TRANSFER_IN/i, category: "shopify_payout" },
  { pattern: /ADVERTISING/i, category: "ad_spend" },
  { pattern: /PAYROLL/i, category: "payroll" },
  { pattern: /SOFTWARE/i, category: "saas" },
  { pattern: /GENERAL_MERCHANDISE/i, category: "cogs_payment" },
];

function searchableText(txn: PlaidSyncTransaction): string {
  return [txn.name, txn.merchant_name, ...(txn.category ?? [])].filter(Boolean).join(" ");
}

function matchRules(text: string): MorganTransactionCategory | null {
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return null;
}

function matchPlaidCategory(txn: PlaidSyncTransaction): MorganTransactionCategory | null {
  const primary = txn.personal_finance_category?.primary;
  const detailed = txn.personal_finance_category?.detailed;
  const haystack = [primary, detailed].filter(Boolean).join(" ");

  for (const mapping of PLAID_CATEGORY_MAP) {
    if (mapping.pattern.test(haystack)) {
      return mapping.category;
    }
  }

  return null;
}

export function categorizePlaidTransaction(txn: PlaidSyncTransaction): CategorizationResult {
  const text = searchableText(txn);
  const ruleMatch = matchRules(text);
  if (ruleMatch) {
    return { category: ruleMatch, confidence: "high" };
  }

  const plaidMatch = matchPlaidCategory(txn);
  if (plaidMatch) {
    return { category: plaidMatch, confidence: "medium" };
  }

  if (txn.amount > 0) {
    return { category: "other", confidence: "medium" };
  }

  return { category: "uncategorized", confidence: "none" };
}
