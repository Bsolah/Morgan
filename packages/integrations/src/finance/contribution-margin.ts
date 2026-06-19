export type CogsMethod = "shopify" | "manual_pct" | "qbo" | "xero";

export const SHOPIFY_PAYMENTS_RATE = 0.029;
export const SHOPIFY_PAYMENTS_FIXED_USD = 0.3;
export const DEFAULT_SHIPPING_COST_PCT = 8;

export type FinanceEconomicsConfig = {
  cogsMethod: CogsMethod;
  manualCogsPct?: number | null;
  accountingCogsRate?: number | null;
  paymentFeePct?: number | null;
  paymentFeeFixedUsd?: number | null;
  shippingCostPct?: number;
};

export type OrderLineEconomicsInput = {
  lineId: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  unitCost?: number | null;
};

export type OrderEconomicsInput = {
  orderId: string;
  lines: OrderLineEconomicsInput[];
  orderLevelDiscount?: number;
  shippingLabelCost?: number | null;
  shippingRevenue?: number;
  refundAmount?: number;
  paymentGateway?: string | null;
};

export type AdAllocationContext = {
  campaignSpend: number;
  totalAttributedNetRevenue: number;
};

export type OrderLineEconomicsResult = {
  line_id: string;
  gross_revenue: number;
  discount: number;
  cogs: number;
  shipping_cost: number;
  payment_fees: number;
  allocated_ad_cost: number;
  contribution_margin: number;
};

export type OrderEconomicsResult = {
  order_id: string;
  lines: OrderLineEconomicsResult[];
  contribution_margin: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

export function allocateProportional(total: number, weights: number[]): number[] {
  if (total <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const safeWeights = weights.map((weight) => Math.max(0, weight));
  const weightSum = safeWeights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    const even = roundMoney(total / weights.length);
    return weights.map((_, index) =>
      index === weights.length - 1 ? roundMoney(total - even * (weights.length - 1)) : even,
    );
  }

  let allocated = 0;
  return safeWeights.map((weight, index) => {
    if (index === safeWeights.length - 1) {
      return roundMoney(total - allocated);
    }
    const share = roundMoney((total * weight) / weightSum);
    allocated += share;
    return share;
  });
}

export function computeLineCogs(
  line: OrderLineEconomicsInput,
  lineGross: number,
  config: FinanceEconomicsConfig,
): number {
  const gross = clampNonNegative(lineGross);

  if (config.cogsMethod === "manual_pct") {
    const pct = config.manualCogsPct ?? 0;
    return roundMoney(gross * (pct / 100));
  }

  if (config.cogsMethod === "qbo" || config.cogsMethod === "xero") {
    const rate = config.accountingCogsRate;
    if (rate != null && Number.isFinite(rate) && rate >= 0) {
      return roundMoney(gross * Math.min(1, rate));
    }
  }

  const unitCost = line.unitCost ?? 0;
  return roundMoney(Math.max(0, unitCost) * Math.max(0, line.quantity));
}

export function resolveOrderShippingCost(
  productNetRevenue: number,
  input: Pick<OrderEconomicsInput, "shippingLabelCost" | "shippingRevenue">,
  config: FinanceEconomicsConfig,
): number {
  if (input.shippingLabelCost != null && Number.isFinite(input.shippingLabelCost)) {
    return roundMoney(Math.max(0, input.shippingLabelCost));
  }

  const pct = config.shippingCostPct ?? DEFAULT_SHIPPING_COST_PCT;
  return roundMoney(Math.max(0, productNetRevenue) * (pct / 100));
}

export function resolveOrderPaymentFees(
  chargeableAmount: number,
  input: Pick<OrderEconomicsInput, "paymentGateway">,
  config: FinanceEconomicsConfig,
): number {
  const amount = clampNonNegative(chargeableAmount);
  if (amount <= 0) return 0;

  const usesShopifyPayments =
    config.paymentFeePct == null &&
    (input.paymentGateway == null ||
      /shopify/i.test(input.paymentGateway) ||
      input.paymentGateway.trim().length === 0);

  const pct = usesShopifyPayments
    ? SHOPIFY_PAYMENTS_RATE * 100
    : (config.paymentFeePct ?? SHOPIFY_PAYMENTS_RATE * 100);
  const fixed = usesShopifyPayments
    ? SHOPIFY_PAYMENTS_FIXED_USD
    : (config.paymentFeeFixedUsd ?? 0);

  return roundMoney(amount * (pct / 100) + fixed);
}

export function resolveOrderAllocatedAdCost(
  orderNetRevenue: number,
  adContext?: AdAllocationContext | null,
): number {
  if (!adContext || adContext.campaignSpend <= 0 || orderNetRevenue <= 0) {
    return 0;
  }

  const denominator = Math.max(adContext.totalAttributedNetRevenue, orderNetRevenue);
  return roundMoney((orderNetRevenue / denominator) * adContext.campaignSpend);
}

export function computeOrderLineEconomics(
  input: OrderEconomicsInput,
  config: FinanceEconomicsConfig,
  adContext?: AdAllocationContext | null,
): OrderEconomicsResult {
  const lines = input.lines;
  if (lines.length === 0) {
    return { order_id: input.orderId, lines: [], contribution_margin: 0 };
  }

  const lineGross = lines.map((line) =>
    roundMoney(Math.max(0, line.unitPrice) * Math.max(0, line.quantity)),
  );
  const lineDiscounts = lines.map((line) => roundMoney(Math.max(0, line.lineDiscount)));
  const orderLevelDiscount = roundMoney(Math.max(0, input.orderLevelDiscount ?? 0));
  const extraLineDiscounts = allocateProportional(orderLevelDiscount, lineGross);
  const totalDiscounts = lineDiscounts.map((discount, index) =>
    roundMoney(discount + extraLineDiscounts[index]!),
  );

  const refundAmount = roundMoney(Math.max(0, input.refundAmount ?? 0));
  const lineNetBeforeRefund = lineGross.map((gross, index) =>
    roundMoney(Math.max(0, gross - totalDiscounts[index]!)),
  );
  const refundAllocations = allocateProportional(refundAmount, lineNetBeforeRefund);
  const totalDiscountWithRefunds = totalDiscounts.map((discount, index) =>
    roundMoney(discount + refundAllocations[index]!),
  );
  const lineNet = lineNetBeforeRefund.map((value, index) =>
    roundMoney(Math.max(0, value - refundAllocations[index]!)),
  );
  const productNetRevenue = lineNet.reduce((sum, value) => sum + value, 0);

  const lineCogs = lines.map((line, index) => computeLineCogs(line, lineGross[index]!, config));
  const shippingRevenue = clampNonNegative(input.shippingRevenue ?? 0);
  const orderShippingCost = resolveOrderShippingCost(productNetRevenue, input, config);
  const chargeableAmount = roundMoney(productNetRevenue + shippingRevenue);
  const orderPaymentFees = resolveOrderPaymentFees(chargeableAmount, input, config);
  const orderAdCost = resolveOrderAllocatedAdCost(productNetRevenue, adContext);

  const shippingAllocations = allocateProportional(orderShippingCost, lineNet);
  const paymentFeeAllocations = allocateProportional(orderPaymentFees, lineNet);
  const adCostAllocations = allocateProportional(orderAdCost, lineNet);

  const resultLines: OrderLineEconomicsResult[] = lines.map((line, index) => {
    const gross = lineGross[index]!;
    const discount = totalDiscountWithRefunds[index]!;
    const cogs = lineCogs[index]!;
    const shipping_cost = shippingAllocations[index]!;
    const payment_fees = paymentFeeAllocations[index]!;
    const allocated_ad_cost = adCostAllocations[index]!;
    const contribution_margin = roundMoney(
      gross - discount - cogs - shipping_cost - payment_fees - allocated_ad_cost,
    );

    return {
      line_id: line.lineId,
      gross_revenue: gross,
      discount,
      cogs,
      shipping_cost,
      payment_fees,
      allocated_ad_cost,
      contribution_margin,
    };
  });

  return {
    order_id: input.orderId,
    lines: resultLines,
    contribution_margin: roundMoney(
      resultLines.reduce((sum, line) => sum + line.contribution_margin, 0),
    ),
  };
}

export function computeContributionMargin(input: {
  revenue: number;
  cogsMethod: CogsMethod;
  manualCogsPct?: number | null;
  lineItems?: Array<{ quantity: number; unitCost: number }>;
  qboCogsRate?: number | null;
  defaultMarginPct?: number;
  order?: OrderEconomicsInput;
  config?: FinanceEconomicsConfig;
  adContext?: AdAllocationContext | null;
}): number {
  if (input.order && input.config) {
    return computeOrderLineEconomics(input.order, input.config, input.adContext).contribution_margin;
  }

  const config: FinanceEconomicsConfig = input.config ?? {
    cogsMethod: input.cogsMethod,
    manualCogsPct: input.manualCogsPct,
    accountingCogsRate: input.qboCogsRate,
  };

  const revenue = Math.max(0, input.revenue);
  if (revenue === 0) return 0;

  const syntheticLines: OrderLineEconomicsInput[] =
    input.lineItems && input.lineItems.length > 0
      ? input.lineItems.map((line, index) => ({
          lineId: String(index + 1),
          quantity: line.quantity,
          unitPrice: line.quantity > 0 ? revenue / line.quantity : revenue,
          lineDiscount: 0,
          unitCost: line.unitCost,
        }))
      : [
          {
            lineId: "1",
            quantity: 1,
            unitPrice: revenue,
            lineDiscount: 0,
            unitCost: null,
          },
        ];

  const orderResult = computeOrderLineEconomics(
    { orderId: "synthetic", lines: syntheticLines },
    config,
    input.adContext,
  );

  if (
    config.cogsMethod === "shopify" &&
    (input.lineItems?.length ?? 0) === 0 &&
    orderResult.contribution_margin === revenue
  ) {
    const marginPct = input.defaultMarginPct ?? 50;
    return roundMoney(revenue * (marginPct / 100));
  }

  return orderResult.contribution_margin;
}

export function parseOrderRevenue(payload: Record<string, unknown>): number {
  const totalPrice = payload.total_price;
  if (typeof totalPrice === "string" || typeof totalPrice === "number") {
    return Math.max(0, Number(totalPrice));
  }

  const totalPriceSet = payload.total_price_set ?? payload.totalPriceSet;
  if (totalPriceSet && typeof totalPriceSet === "object") {
    const money =
      (totalPriceSet as Record<string, unknown>).shop_money ??
      (totalPriceSet as Record<string, unknown>).shopMoney;
    if (money && typeof money === "object") {
      const amount = (money as Record<string, unknown>).amount;
      if (typeof amount === "string" || typeof amount === "number") {
        return Math.max(0, Number(amount));
      }
    }
  }

  return 0;
}

export function extractOrderDay(payload: Record<string, unknown>): string | null {
  const createdAt = payload.created_at ?? payload.createdAt;
  if (typeof createdAt !== "string" || createdAt.length < 10) return null;
  return createdAt.slice(0, 10);
}

export function parseMoneyField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

export function parseShippingRevenue(payload: Record<string, unknown>): number {
  const totalShipping = payload.total_shipping_price_set ?? payload.totalShippingPriceSet;
  if (totalShipping && typeof totalShipping === "object") {
    const money =
      (totalShipping as Record<string, unknown>).shop_money ??
      (totalShipping as Record<string, unknown>).shopMoney;
    if (money && typeof money === "object") {
      return parseMoneyField((money as Record<string, unknown>).amount);
    }
  }

  return parseMoneyField(payload.total_shipping_price_set ?? payload.total_shipping_price);
}

export function parseShippingLabelCost(payload: Record<string, unknown>): number | null {
  const fulfillments = payload.fulfillments;
  if (!Array.isArray(fulfillments)) return null;

  let total = 0;
  let found = false;

  for (const fulfillment of fulfillments) {
    if (!fulfillment || typeof fulfillment !== "object") continue;
    const record = fulfillment as Record<string, unknown>;
    const labelCost =
      record.shipping_label_cost ??
      record.shippingLabelCost ??
      record.total_shipping_price_set ??
      record.totalShippingPriceSet;

    if (labelCost && typeof labelCost === "object") {
      const money =
        (labelCost as Record<string, unknown>).shop_money ??
        (labelCost as Record<string, unknown>).shopMoney;
      if (money && typeof money === "object") {
        total += parseMoneyField((money as Record<string, unknown>).amount);
        found = true;
        continue;
      }
    }

    if (typeof labelCost === "string" || typeof labelCost === "number") {
      total += parseMoneyField(labelCost);
      found = true;
    }
  }

  return found ? roundMoney(total) : null;
}

export function parseRefundAmount(payload: Record<string, unknown>): number {
  const refunds = payload.refunds;
  if (!Array.isArray(refunds)) return 0;

  return roundMoney(
    refunds.reduce((sum, refund) => {
      if (!refund || typeof refund !== "object") return sum;
      const record = refund as Record<string, unknown>;
      const transactions = record.transactions;
      if (Array.isArray(transactions)) {
        return (
          sum +
          transactions.reduce((txnSum, txn) => {
            if (!txn || typeof txn !== "object") return txnSum;
            const amount = (txn as Record<string, unknown>).amount;
            return txnSum + parseMoneyField(amount);
          }, 0)
        );
      }
      return sum + parseMoneyField(record.amount ?? record.total_refunded);
    }, 0),
  );
}

export function parsePaymentGateway(payload: Record<string, unknown>): string | null {
  const gateways = payload.payment_gateway_names ?? payload.paymentGatewayNames;
  if (Array.isArray(gateways) && gateways.length > 0) {
    const first = gateways[0];
    return typeof first === "string" ? first : null;
  }

  const gateway = payload.gateway;
  return typeof gateway === "string" ? gateway : null;
}

export function extractLineItemsForCogs(
  payload: Record<string, unknown>,
  unitCostBySku: Map<string, number>,
): Array<{ quantity: number; unitCost: number }> {
  const lineItems = payload.line_items ?? payload.lineItems;
  if (!Array.isArray(lineItems)) return [];

  const rows: Array<{ quantity: number; unitCost: number }> = [];

  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const quantity = Number(record.quantity ?? 1);
    const sku = typeof record.sku === "string" ? record.sku : "";
    rows.push({
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unitCost: unitCostBySku.get(sku) ?? 0,
    });
  }

  return rows;
}

export function parseShopifyOrderEconomicsInput(
  payload: Record<string, unknown>,
  unitCostBySku: Map<string, number>,
): OrderEconomicsInput {
  const lineItems = payload.line_items ?? payload.lineItems;
  const lines: OrderLineEconomicsInput[] = [];

  if (Array.isArray(lineItems)) {
    for (const item of lineItems) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const lineId = record.id != null ? String(record.id) : `${lines.length + 1}`;
      const quantity = Number(record.quantity ?? 1);
      const unitPrice = parseMoneyField(record.price);
      const lineDiscount = parseMoneyField(record.total_discount ?? record.totalDiscount);
      const sku = typeof record.sku === "string" ? record.sku : "";

      lines.push({
        lineId,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitPrice,
        lineDiscount,
        unitCost: unitCostBySku.get(sku) ?? null,
      });
    }
  }

  const lineGross = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const lineDiscountTotal = lines.reduce((sum, line) => sum + line.lineDiscount, 0);
  const orderDiscounts = parseMoneyField(payload.total_discounts ?? payload.total_discounts_set);
  const orderLevelDiscount = Math.max(0, orderDiscounts - lineDiscountTotal);

  return {
    orderId: payload.id != null ? String(payload.id) : "unknown",
    lines,
    orderLevelDiscount: roundMoney(orderLevelDiscount),
    shippingLabelCost: parseShippingLabelCost(payload),
    shippingRevenue: parseShippingRevenue(payload),
    refundAmount: parseRefundAmount(payload),
    paymentGateway: parsePaymentGateway(payload),
  };
}

export function financeConfigFromMerchantRow(row: {
  cogsMethod: CogsMethod;
  manualCogsPct?: string | number | null;
  paymentFeePct?: string | number | null;
  shippingCostPct?: string | number | null;
}): FinanceEconomicsConfig {
  return {
    cogsMethod: row.cogsMethod,
    manualCogsPct: row.manualCogsPct != null ? Number(row.manualCogsPct) : null,
    paymentFeePct: row.paymentFeePct != null ? Number(row.paymentFeePct) : null,
    shippingCostPct:
      row.shippingCostPct != null ? Number(row.shippingCostPct) : DEFAULT_SHIPPING_COST_PCT,
  };
}
