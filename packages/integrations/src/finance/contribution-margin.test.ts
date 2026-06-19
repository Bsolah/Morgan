import { describe, expect, it } from "vitest";
import {
  computeOrderLineEconomics,
  DEFAULT_SHIPPING_COST_PCT,
  financeConfigFromMerchantRow,
  parseShopifyOrderEconomicsInput,
  resolveOrderPaymentFees,
  resolveOrderShippingCost,
  SHOPIFY_PAYMENTS_FIXED_USD,
  SHOPIFY_PAYMENTS_RATE,
  type AdAllocationContext,
  type FinanceEconomicsConfig,
  type OrderEconomicsInput,
} from "./contribution-margin.js";

const shopifyConfig: FinanceEconomicsConfig = {
  cogsMethod: "shopify",
  shippingCostPct: DEFAULT_SHIPPING_COST_PCT,
};

function shopifyPaymentFees(amount: number): number {
  return Math.round((amount * SHOPIFY_PAYMENTS_RATE + SHOPIFY_PAYMENTS_FIXED_USD) * 10_000) / 10_000;
}

function adContext(spend: number, totalRevenue: number): AdAllocationContext {
  return { campaignSpend: spend, totalAttributedNetRevenue: totalRevenue };
}

describe("contribution margin per order line", () => {
  it("1. standard two-line order with Shopify unit costs and ad allocation", () => {
    const order: OrderEconomicsInput = {
      orderId: "1001",
      lines: [
        { lineId: "1", quantity: 2, unitPrice: 50, lineDiscount: 0, unitCost: 15 },
        { lineId: "2", quantity: 1, unitPrice: 40, lineDiscount: 5, unitCost: 10 },
      ],
      shippingRevenue: 10,
    };

    const result = computeOrderLineEconomics(
      order,
      shopifyConfig,
      adContext(100, 135),
    );

    const productNet = 135;
    const shippingCost = productNet * 0.08;
    const paymentFees = shopifyPaymentFees(productNet + 10);
    const adCost = 100;

    expect(result.lines[0]).toMatchObject({
      gross_revenue: 100,
      discount: 0,
      cogs: 30,
      shipping_cost: expect.any(Number),
      payment_fees: expect.any(Number),
      allocated_ad_cost: expect.any(Number),
    });
    expect(result.lines[1]).toMatchObject({
      gross_revenue: 40,
      discount: 5,
      cogs: 10,
    });

    const expectedMargin = productNet - 40 - shippingCost - paymentFees - adCost;
    expect(result.contribution_margin).toBe(
      Math.round(expectedMargin * 10_000) / 10_000,
    );
  });

  it("2. 100% discount order still deducts fulfillment and payment costs", () => {
    const order: OrderEconomicsInput = {
      orderId: "1002",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 80, lineDiscount: 80, unitCost: 20 }],
    };

    const result = computeOrderLineEconomics(order, shopifyConfig);

    expect(result.lines[0]).toMatchObject({
      gross_revenue: 80,
      discount: 80,
      cogs: 20,
      shipping_cost: 0,
      payment_fees: 0,
      allocated_ad_cost: 0,
      contribution_margin: -20,
    });
  });

  it("3. partial refund reduces net revenue and margin", () => {
    const order: OrderEconomicsInput = {
      orderId: "1003",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 100, lineDiscount: 0, unitCost: 30 }],
      refundAmount: 40,
    };

    const result = computeOrderLineEconomics(order, shopifyConfig);
    const net = 60;
    const shipping = net * 0.08;
    const fees = shopifyPaymentFees(net);
    const expected = net - 30 - shipping - fees;

    expect(result.lines[0]?.contribution_margin).toBe(
      Math.round(expected * 10_000) / 10_000,
    );
  });

  it("4. free shipping uses estimated shipping cost at default 8%", () => {
    const order: OrderEconomicsInput = {
      orderId: "1004",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 125, lineDiscount: 0, unitCost: 25 }],
      shippingRevenue: 0,
    };

    const result = computeOrderLineEconomics(order, shopifyConfig);

    expect(result.lines[0]?.shipping_cost).toBe(10);
    expect(resolveOrderShippingCost(125, { shippingRevenue: 0 }, shopifyConfig)).toBe(10);
  });

  it("5. actual label cost overrides revenue-percent shipping estimate", () => {
    const order: OrderEconomicsInput = {
      orderId: "1005",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 200, lineDiscount: 0, unitCost: 50 }],
      shippingLabelCost: 14.5,
      shippingRevenue: 0,
    };

    const result = computeOrderLineEconomics(order, shopifyConfig);

    expect(result.lines[0]?.shipping_cost).toBe(14.5);
  });

  it("6. manual_pct COGS applies configured percentage to line gross", () => {
    const order: OrderEconomicsInput = {
      orderId: "1006",
      lines: [{ lineId: "1", quantity: 2, unitPrice: 60, lineDiscount: 0, unitCost: 999 }],
    };

    const result = computeOrderLineEconomics(
      order,
      { cogsMethod: "manual_pct", manualCogsPct: 35, shippingCostPct: 0, paymentFeePct: 0 },
    );

    expect(result.lines[0]?.cogs).toBe(42);
  });

  it("7. QuickBooks COGS rate applies to gross when unit costs exist", () => {
    const order: OrderEconomicsInput = {
      orderId: "1007",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 100, lineDiscount: 0, unitCost: 10 }],
    };

    const result = computeOrderLineEconomics(
      order,
      {
        cogsMethod: "qbo",
        accountingCogsRate: 0.35,
        shippingCostPct: 0,
        paymentFeePct: 0,
      },
    );

    expect(result.lines[0]?.cogs).toBe(35);
    expect(result.lines[0]?.contribution_margin).toBe(65);
  });

  it("8. unattributed orders carry zero allocated ad cost", () => {
    const order: OrderEconomicsInput = {
      orderId: "1008",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 90, lineDiscount: 0, unitCost: 20 }],
    };

    const result = computeOrderLineEconomics(order, {
      ...shopifyConfig,
      paymentFeePct: 0,
      paymentFeeFixedUsd: 0,
    });

    expect(result.lines[0]?.allocated_ad_cost).toBe(0);
  });

  it("9. configurable payment fee pct replaces Shopify Payments defaults", () => {
    const amount = 150;
    const customFees = resolveOrderPaymentFees(
      amount,
      { paymentGateway: "stripe" },
      { cogsMethod: "shopify", paymentFeePct: 2.5, paymentFeeFixedUsd: 0.25 },
    );

    expect(customFees).toBe(4);

    const order: OrderEconomicsInput = {
      orderId: "1009",
      lines: [{ lineId: "1", quantity: 1, unitPrice: 150, lineDiscount: 0, unitCost: 0 }],
    };

    const result = computeOrderLineEconomics(order, {
      cogsMethod: "shopify",
      paymentFeePct: 2.5,
      paymentFeeFixedUsd: 0.25,
      shippingCostPct: 0,
    });

    expect(result.lines[0]?.payment_fees).toBe(4);
  });

  it("10. parses Shopify payload including refunds and label costs", () => {
    const parsed = parseShopifyOrderEconomicsInput(
      {
        id: 1010,
        total_discounts: "15.00",
        total_shipping_price_set: { shop_money: { amount: "0.00" } },
        payment_gateway_names: ["shopify_payments"],
        fulfillments: [{ shipping_label_cost: "6.75" }],
        refunds: [{ transactions: [{ amount: "25.00" }] }],
        line_items: [
          { id: 1, sku: "SKU-A", quantity: 1, price: "100.00", total_discount: "10.00" },
          { id: 2, sku: "SKU-B", quantity: 2, price: "30.00", total_discount: "5.00" },
        ],
      },
      new Map([
        ["SKU-A", 22],
        ["SKU-B", 8],
      ]),
    );

    expect(parsed).toMatchObject({
      orderId: "1010",
      shippingLabelCost: 6.75,
      shippingRevenue: 0,
      refundAmount: 25,
      paymentGateway: "shopify_payments",
    });

    const result = computeOrderLineEconomics(
      parsed,
      shopifyConfig,
      adContext(50, 120),
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.cogs).toBe(22);
    expect(result.lines[1]?.cogs).toBe(16);
    expect(result.contribution_margin).toBeLessThan(120);
  });
});

describe("finance config helpers", () => {
  it("maps merchant finance config row into economics config", () => {
    const config = financeConfigFromMerchantRow({
      cogsMethod: "manual_pct",
      manualCogsPct: "42.5",
      paymentFeePct: "2.75",
      shippingCostPct: "6",
    });

    expect(config).toEqual({
      cogsMethod: "manual_pct",
      manualCogsPct: 42.5,
      paymentFeePct: 2.75,
      shippingCostPct: 6,
    });
  });
});
