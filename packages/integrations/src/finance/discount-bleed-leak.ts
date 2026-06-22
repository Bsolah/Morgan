import { extractOrderDay, parseMoneyField } from "./contribution-margin.js";

export const DISCOUNT_BLEED_THRESHOLDS = {
  short_window_days: 7,
  long_window_days: 30,
  discount_rate_multiplier: 1.25,
  conversion_rate_tolerance_pct: 0.05,
  projection_days: 30,
  top_discount_codes_limit: 3,
} as const;

export type OrderDiscountSnapshot = {
  day: string;
  order_id: string;
  gross_revenue_usd: number;
  discount_usd: number;
  discount_codes: string[];
};

export type DiscountBleedEvidence = {
  discount_rate_pct: number;
  prior_discount_rate_pct: number;
  conversion_rate_7d: number;
  conversion_rate_30d: number;
  discounts_usd: number;
  affected_orders_count: number;
  top_discount_codes: string[];
};

export type DiscountBleedEvaluation = {
  qualifies: boolean;
  should_resolve: boolean;
  amount_at_risk_usd: number;
  evidence: DiscountBleedEvidence | null;
};

export function isOrderCancelled(payload: Record<string, unknown>): boolean {
  const cancelledAt = payload.cancelled_at ?? payload.cancelledAt;
  return cancelledAt != null && String(cancelledAt).length > 0;
}

export function parseOrderDiscountUsd(payload: Record<string, unknown>): number {
  const totalDiscounts = payload.total_discounts ?? payload.total_discounts_set ?? payload.totalDiscountsSet;
  if (totalDiscounts && typeof totalDiscounts === "object") {
    const money =
      (totalDiscounts as Record<string, unknown>).shop_money ??
      (totalDiscounts as Record<string, unknown>).shopMoney;
    if (money && typeof money === "object") {
      return parseMoneyField((money as Record<string, unknown>).amount);
    }
  }

  return parseMoneyField(payload.total_discounts ?? payload.totalDiscounts);
}

export function parseOrderGrossRevenueUsd(payload: Record<string, unknown>): number {
  const lineItems = payload.line_items ?? payload.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    let gross = 0;
    for (const item of lineItems) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const quantity = Number(record.quantity ?? 1);
      const unitPrice = parseMoneyField(record.price ?? record.originalUnitPriceSet);
      if (unitPrice <= 0 && record.originalUnitPriceSet && typeof record.originalUnitPriceSet === "object") {
        const money =
          (record.originalUnitPriceSet as Record<string, unknown>).shop_money ??
          (record.originalUnitPriceSet as Record<string, unknown>).shopMoney;
        if (money && typeof money === "object") {
          gross += parseMoneyField((money as Record<string, unknown>).amount) * quantity;
          continue;
        }
      }
      gross += unitPrice * (Number.isFinite(quantity) ? quantity : 1);
    }
    if (gross > 0) return gross;
  }

  const subtotal = payload.subtotal_price ?? payload.subtotalPriceSet ?? payload.subtotal_price_set;
  let subtotalUsd = 0;
  if (typeof subtotal === "string" || typeof subtotal === "number") {
    subtotalUsd = parseMoneyField(subtotal);
  } else if (subtotal && typeof subtotal === "object") {
    const money =
      (subtotal as Record<string, unknown>).shop_money ??
      (subtotal as Record<string, unknown>).shopMoney;
    if (money && typeof money === "object") {
      subtotalUsd = parseMoneyField((money as Record<string, unknown>).amount);
    }
  }

  return subtotalUsd + parseOrderDiscountUsd(payload);
}

export function extractDiscountCodes(payload: Record<string, unknown>): string[] {
  const codes = new Set<string>();

  const discountCodes = payload.discount_codes ?? payload.discountCodes;
  if (Array.isArray(discountCodes)) {
    for (const entry of discountCodes) {
      if (!entry || typeof entry !== "object") continue;
      const code = (entry as Record<string, unknown>).code;
      if (typeof code === "string" && code.trim().length > 0) {
        codes.add(code.trim());
      }
    }
  }

  const applications = payload.discount_applications ?? payload.discountApplications;
  if (Array.isArray(applications)) {
    for (const entry of applications) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const code = record.code ?? record.title;
      if (typeof code === "string" && code.trim().length > 0) {
        codes.add(code.trim());
      }
    }
  }

  return [...codes];
}

export function parseOrderDiscountSnapshot(
  payload: Record<string, unknown>,
  orderId?: string,
): OrderDiscountSnapshot | null {
  if (isOrderCancelled(payload)) return null;

  const day = extractOrderDay(payload);
  if (!day) return null;

  const grossRevenue = parseOrderGrossRevenueUsd(payload);
  if (grossRevenue <= 0) return null;

  const discountUsd = parseOrderDiscountUsd(payload);
  const id =
    orderId ??
    (payload.id != null ? String(payload.id) : payload.name != null ? String(payload.name) : "unknown");

  return {
    day,
    order_id: id,
    gross_revenue_usd: grossRevenue,
    discount_usd: discountUsd,
    discount_codes: extractDiscountCodes(payload),
  };
}

export type DiscountWindowMetrics = {
  order_count: number;
  gross_revenue_usd: number;
  discount_usd: number;
  discount_rate: number;
  conversion_rate: number;
  discounted_order_count: number;
  discount_code_counts: Map<string, number>;
};

function filterSnapshotsForWindow(
  snapshots: OrderDiscountSnapshot[],
  windowDays: number,
  referenceDay: string,
): OrderDiscountSnapshot[] {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  return snapshots.filter((snapshot) => {
    const day = new Date(`${snapshot.day}T00:00:00.000Z`);
    return day >= start && day <= ref;
  });
}

export function aggregateDiscountWindowMetrics(
  snapshots: OrderDiscountSnapshot[],
  windowDays: number,
  referenceDay: string,
): DiscountWindowMetrics {
  const rows = filterSnapshotsForWindow(snapshots, windowDays, referenceDay);
  const discountCodeCounts = new Map<string, number>();

  let grossRevenue = 0;
  let discountUsd = 0;
  let discountedOrderCount = 0;

  for (const row of rows) {
    grossRevenue += row.gross_revenue_usd;
    discountUsd += row.discount_usd;
    if (row.discount_usd > 0) {
      discountedOrderCount += 1;
      for (const code of row.discount_codes) {
        discountCodeCounts.set(code, (discountCodeCounts.get(code) ?? 0) + 1);
      }
    }
  }

  const orderCount = rows.length;
  const discountRate = grossRevenue > 0 ? discountUsd / grossRevenue : 0;

  return {
    order_count: orderCount,
    gross_revenue_usd: grossRevenue,
    discount_usd: discountUsd,
    discount_rate: discountRate,
    conversion_rate: orderCount / windowDays,
    discounted_order_count: discountedOrderCount,
    discount_code_counts: discountCodeCounts,
  };
}

/** True when trailing daily order volume is within tolerance of the 30d baseline. */
export function isConversionRateFlat(
  conversionRate7d: number,
  conversionRate30d: number,
  tolerancePct = DISCOUNT_BLEED_THRESHOLDS.conversion_rate_tolerance_pct,
): boolean {
  if (conversionRate30d <= 0) {
    return conversionRate7d <= 0;
  }

  return Math.abs(conversionRate7d - conversionRate30d) / conversionRate30d <= tolerancePct;
}

export function qualifiesForDiscountBleedLeak(
  discountRate7d: number,
  discountRate30d: number,
  conversionRate7d: number,
  conversionRate30d: number,
): boolean {
  if (discountRate30d <= 0) return false;
  if (discountRate7d <= discountRate30d * DISCOUNT_BLEED_THRESHOLDS.discount_rate_multiplier) {
    return false;
  }

  return isConversionRateFlat(conversionRate7d, conversionRate30d);
}

export function projectDiscountBleedAmountAtRiskUsd(
  grossRevenue7dUsd: number,
  discountRate7d: number,
  discountRate30d: number,
): number {
  const excessRate = discountRate7d - discountRate30d;
  if (excessRate <= 0 || grossRevenue7dUsd <= 0) return 0;

  const excess7d = grossRevenue7dUsd * excessRate;
  return excess7d * (DISCOUNT_BLEED_THRESHOLDS.projection_days / DISCOUNT_BLEED_THRESHOLDS.short_window_days);
}

export function topDiscountCodes(
  discountCodeCounts: Map<string, number>,
  limit = DISCOUNT_BLEED_THRESHOLDS.top_discount_codes_limit,
): string[] {
  return [...discountCodeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([code]) => code);
}

export function buildDiscountBleedEvidence(
  shortWindow: DiscountWindowMetrics,
  longWindow: DiscountWindowMetrics,
  topCodes: string[],
): DiscountBleedEvidence {
  return {
    discount_rate_pct: shortWindow.discount_rate * 100,
    prior_discount_rate_pct: longWindow.discount_rate * 100,
    conversion_rate_7d: shortWindow.conversion_rate,
    conversion_rate_30d: longWindow.conversion_rate,
    discounts_usd: shortWindow.discount_usd,
    affected_orders_count: shortWindow.discounted_order_count,
    top_discount_codes: topCodes,
  };
}

export function evaluateDiscountBleedLeak(
  snapshots: OrderDiscountSnapshot[],
  referenceDay: string,
): DiscountBleedEvaluation {
  const shortWindow = aggregateDiscountWindowMetrics(
    snapshots,
    DISCOUNT_BLEED_THRESHOLDS.short_window_days,
    referenceDay,
  );
  const longWindow = aggregateDiscountWindowMetrics(
    snapshots,
    DISCOUNT_BLEED_THRESHOLDS.long_window_days,
    referenceDay,
  );

  if (longWindow.order_count === 0) {
    return {
      qualifies: false,
      should_resolve: false,
      amount_at_risk_usd: 0,
      evidence: null,
    };
  }

  const qualifies = qualifiesForDiscountBleedLeak(
    shortWindow.discount_rate,
    longWindow.discount_rate,
    shortWindow.conversion_rate,
    longWindow.conversion_rate,
  );

  const topCodes = topDiscountCodes(shortWindow.discount_code_counts);
  const evidence = buildDiscountBleedEvidence(shortWindow, longWindow, topCodes);

  return {
    qualifies,
    should_resolve: !qualifies,
    amount_at_risk_usd: qualifies
      ? projectDiscountBleedAmountAtRiskUsd(
          shortWindow.gross_revenue_usd,
          shortWindow.discount_rate,
          longWindow.discount_rate,
        )
      : 0,
    evidence: qualifies ? evidence : null,
  };
}
