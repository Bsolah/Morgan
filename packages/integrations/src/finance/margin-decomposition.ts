export type MarginDriverCategory = "cogs" | "discounts" | "refunds" | "ad_spend" | "shipping";

export type MarginPeriodTotals = {
  gross_revenue: number;
  discounts: number;
  cogs: number;
  ad_spend: number;
  shipping_cost: number;
  refunds: number;
  contribution_margin: number;
};

export type MarginDriver = {
  category: MarginDriverCategory;
  label: string;
  impact_usd: number;
  current_usd: number;
  prior_usd: number;
  chat_prompt: string;
};

const DRIVER_LABELS: Record<MarginDriverCategory, string> = {
  cogs: "COGS",
  discounts: "Discounts",
  refunds: "Refunds",
  ad_spend: "Ad spend",
  shipping: "Shipping",
};

function valueForCategory(totals: MarginPeriodTotals, category: MarginDriverCategory): number {
  switch (category) {
    case "cogs":
      return totals.cogs;
    case "discounts":
      return totals.discounts;
    case "refunds":
      return totals.refunds;
    case "ad_spend":
      return totals.ad_spend;
    case "shipping":
      return totals.shipping_cost;
  }
}

export function estimateRefundsUsd(totals: Omit<MarginPeriodTotals, "refunds">): number {
  const residual =
    totals.gross_revenue -
    totals.discounts -
    totals.cogs -
    totals.contribution_margin -
    totals.ad_spend -
    totals.shipping_cost;
  return Math.max(0, Math.round(residual));
}

export function buildMarginPeriodTotals(input: {
  gross_revenue: number;
  discounts: number;
  cogs: number;
  ad_spend: number;
  shipping_revenue: number;
  shipping_cost_pct: number;
  contribution_margin: number;
}): MarginPeriodTotals {
  const shippingCost = (input.shipping_revenue * input.shipping_cost_pct) / 100;
  const base = {
    gross_revenue: input.gross_revenue,
    discounts: input.discounts,
    cogs: input.cogs,
    ad_spend: input.ad_spend,
    shipping_cost: shippingCost,
    contribution_margin: input.contribution_margin,
  };

  return {
    ...base,
    refunds: estimateRefundsUsd(base),
  };
}

function buildChatPrompt(
  category: MarginDriverCategory,
  impactUsd: number,
  windowDays: number,
): string {
  const label = DRIVER_LABELS[category].toLowerCase();
  const magnitude = Math.abs(Math.round(impactUsd)).toLocaleString("en-US");
  const direction = impactUsd >= 0 ? "helped" : "hurt";

  return `Explain how ${label} ${direction} my contribution margin over the last ${windowDays} days. The estimated impact is about $${magnitude}. What changed and what should I do?`;
}

export function computeMarginDrivers(
  current: MarginPeriodTotals,
  prior: MarginPeriodTotals,
  windowDays: number,
): MarginDriver[] {
  const categories: MarginDriverCategory[] = [
    "cogs",
    "discounts",
    "refunds",
    "ad_spend",
    "shipping",
  ];

  const drivers = categories.map((category) => {
    const currentUsd = valueForCategory(current, category);
    const priorUsd = valueForCategory(prior, category);
    const impactUsd = Math.round(priorUsd - currentUsd);

    return {
      category,
      label: DRIVER_LABELS[category],
      impact_usd: impactUsd,
      current_usd: Math.round(currentUsd),
      prior_usd: Math.round(priorUsd),
      chat_prompt: buildChatPrompt(category, impactUsd, windowDays),
    };
  });

  return drivers
    .sort((left, right) => Math.abs(right.impact_usd) - Math.abs(left.impact_usd))
    .slice(0, 3);
}
