import { shopifyAdminGraphql, type ShopifyGraphqlResponse } from "./admin-graphql.js";

const SHOPIFY_PAYMENTS_QUERY = `
  query ShopifyPaymentsSnapshot($payoutCursor: String) {
    shopifyPaymentsAccount {
      activated
      balance {
        amount
        currencyCode
      }
      payoutSchedule {
        interval
        monthlyAnchor
        weeklyAnchor
      }
      payouts(first: 50, after: $payoutCursor, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          issuedAt
          status
          net {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

export type MoneyAmount = {
  amount: string;
  currencyCode: string;
};

export type ShopifyPayoutNode = {
  id: string;
  issuedAt: string;
  status: string;
  net: MoneyAmount;
};

export type ShopifyPaymentsSnapshot = {
  activated: boolean;
  balance: MoneyAmount[];
  payoutSchedule: {
    interval: string;
    monthlyAnchor?: number | null;
    weeklyAnchor?: string | null;
  } | null;
  payouts: ShopifyPayoutNode[];
};

export class ShopifyPaymentsUnavailableError extends Error {
  constructor(message = "Shopify Payments is not enabled for this store") {
    super(message);
    this.name = "ShopifyPaymentsUnavailableError";
  }
}

export function extractShopifyGidTail(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}

export function isShopifyPaymentsUnavailableError(error: unknown): boolean {
  if (error instanceof ShopifyPaymentsUnavailableError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /shopify payments|not enabled|not available|does not have shopify payments/i.test(message);
}

export async function fetchShopifyPaymentsSnapshot(
  shopDomain: string,
  accessToken: string,
): Promise<ShopifyPaymentsSnapshot> {
  const payouts: ShopifyPayoutNode[] = [];
  let cursor: string | null = null;
  let account: Record<string, unknown> | null = null;

  do {
    const response = await shopifyAdminGraphqlWithNull<{
      shopifyPaymentsAccount: Record<string, unknown> | null;
    }>(shopDomain, accessToken, SHOPIFY_PAYMENTS_QUERY, {
      payoutCursor: cursor,
    });

    if (!response.shopifyPaymentsAccount) {
      throw new ShopifyPaymentsUnavailableError();
    }

    account = response.shopifyPaymentsAccount;
    const payoutConnection = account.payouts as
      | {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: ShopifyPayoutNode[];
        }
      | undefined;

    payouts.push(...(payoutConnection?.nodes ?? []));
    if (payoutConnection?.pageInfo.hasNextPage && payoutConnection.pageInfo.endCursor) {
      cursor = payoutConnection.pageInfo.endCursor;
    } else {
      cursor = null;
    }
  } while (cursor);

  if (!account) {
    throw new ShopifyPaymentsUnavailableError();
  }

  if (account.activated === false) {
    throw new ShopifyPaymentsUnavailableError();
  }

  return {
    activated: Boolean(account.activated),
    balance: (account.balance as MoneyAmount[] | undefined) ?? [],
    payoutSchedule: (account.payoutSchedule as ShopifyPaymentsSnapshot["payoutSchedule"]) ?? null,
    payouts,
  };
}

async function shopifyAdminGraphqlWithNull<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify GraphQL request failed: ${res.status}`);
  }

  const json = (await res.json()) as ShopifyGraphqlResponse<T>;
  if (json.errors?.length) {
    const message = json.errors.map((error) => error.message).join("; ");
    if (isShopifyPaymentsUnavailableError(new Error(message))) {
      throw new ShopifyPaymentsUnavailableError(message);
    }
    throw new Error(message);
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL response missing data");
  }

  return json.data;
}

export function primaryBalanceAmount(snapshot: ShopifyPaymentsSnapshot): MoneyAmount | null {
  return snapshot.balance[0] ?? null;
}

export function payoutIntervalDays(payouts: ShopifyPayoutNode[]): number[] {
  const sorted = [...payouts]
    .filter((payout) => payout.issuedAt && payout.status === "PAID")
    .sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime());

  const intervals: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(sorted[index - 1]!.issuedAt);
    const current = new Date(sorted[index]!.issuedAt);
    const days = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 0) {
      intervals.push(days);
    }
  }
  return intervals;
}

export function averagePayoutIntervalDays(intervals: number[]): number | null {
  if (intervals.length === 0) return null;
  const total = intervals.reduce((sum, value) => sum + value, 0);
  return total / intervals.length;
}

export function daysSinceLastPayout(payouts: ShopifyPayoutNode[], now = new Date()): number | null {
  const completed = payouts
    .filter(
      (payout) =>
        payout.issuedAt &&
        (payout.status === "PAID" || payout.status === "IN_TRANSIT"),
    )
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  const latest = completed[0];
  if (!latest) return null;

  return (now.getTime() - new Date(latest.issuedAt).getTime()) / (1000 * 60 * 60 * 24);
}

export function shouldCreatePayoutDelayAlert(input: {
  daysSinceLastPayout: number | null;
  averageIntervalDays: number | null;
  thresholdDays: number;
}): boolean {
  if (input.daysSinceLastPayout == null || input.averageIntervalDays == null) {
    return false;
  }
  return input.daysSinceLastPayout > input.averageIntervalDays + input.thresholdDays;
}

export function expectedInflowPayouts(payouts: ShopifyPayoutNode[]): ShopifyPayoutNode[] {
  return payouts.filter((payout) => payout.status === "SCHEDULED" || payout.status === "IN_TRANSIT");
}

export function groupExpectedInflowsByDay(
  payouts: ShopifyPayoutNode[],
): Map<string, { amount: number; count: number; currency: string }> {
  const grouped = new Map<string, { amount: number; count: number; currency: string }>();

  for (const payout of expectedInflowPayouts(payouts)) {
    const day = payout.issuedAt.slice(0, 10);
    const existing = grouped.get(day) ?? { amount: 0, count: 0, currency: payout.net.currencyCode };
    existing.amount += Number(payout.net.amount);
    existing.count += 1;
    grouped.set(day, existing);
  }

  return grouped;
}
