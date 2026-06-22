import type { DeadStockEvidence } from "../finance/dead-stock-leak.js";

export const MAX_LIQUIDATION_DISCOUNT_PCT = 10;

export type LiquidationStrategy = "discount" | "bundle" | "pause_reorders";

export type LiquidationSuggestion = {
  strategy: LiquidationStrategy;
  discount_pct: number | null;
  title: string;
  body: string;
};

export type LiquidationImpactRange = {
  cash_recovered_low_usd: number;
  cash_recovered_high_usd: number;
  margin_sacrificed_low_usd: number;
  margin_sacrificed_high_usd: number;
};

export function capLiquidationDiscountPct(discountPct: number): number {
  return Math.min(MAX_LIQUIDATION_DISCOUNT_PCT, Math.max(0, discountPct));
}

export function suggestLiquidationStrategy(input: {
  velocity_30d: number;
  days_of_stock: number;
  available_units: number;
}): { strategy: LiquidationStrategy; discount_pct: number | null } {
  if (input.velocity_30d <= 0 || input.available_units <= 0) {
    return { strategy: "pause_reorders", discount_pct: null };
  }

  if (input.days_of_stock >= 180) {
    return { strategy: "discount", discount_pct: MAX_LIQUIDATION_DISCOUNT_PCT };
  }

  if (input.velocity_30d > 0 && input.days_of_stock >= 90) {
    return { strategy: "bundle", discount_pct: null };
  }

  const scaledDiscount = capLiquidationDiscountPct(Math.ceil(input.days_of_stock / 18));
  return { strategy: "discount", discount_pct: scaledDiscount };
}

export function buildLiquidationSuggestion(evidence: DeadStockEvidence): LiquidationSuggestion {
  const { strategy, discount_pct } = suggestLiquidationStrategy({
    velocity_30d: evidence.velocity_30d,
    days_of_stock: evidence.days_of_stock,
    available_units: evidence.available_units,
  });

  if (strategy === "pause_reorders") {
    return {
      strategy,
      discount_pct: null,
      title: `Pause reorders for ${evidence.sku}`,
      body: `${evidence.sku} is dead stock with ${evidence.available_units} units on hand (~$${Math.round(evidence.inventory_value_usd).toLocaleString("en-US")} tied up). Pause reorders and let existing stock sell through before buying more.`,
    };
  }

  if (strategy === "bundle") {
    return {
      strategy,
      discount_pct: null,
      title: `Bundle slow-moving ${evidence.sku}`,
      body: `${evidence.sku} has ${Math.round(evidence.days_of_stock)} days of supply at ${evidence.velocity_30d.toFixed(2)}/day. Bundle it with a top seller to move units without a deep markdown.`,
    };
  }

  const discount = discount_pct ?? MAX_LIQUIDATION_DISCOUNT_PCT;
  return {
    strategy,
    discount_pct: discount,
    title: `Markdown ${evidence.sku} by ${discount}%`,
    body: `${evidence.sku} has ${Math.round(evidence.days_of_stock)} days of supply. Try a ${discount}% markdown (max one step) to recover tied-up cash while limiting margin sacrifice.`,
  };
}

export function computeLiquidationImpactRange(input: {
  inventory_value_usd: number;
  strategy: LiquidationStrategy;
  discount_pct: number | null;
  velocity_30d: number;
}): LiquidationImpactRange {
  const inventoryValue = Math.max(0, input.inventory_value_usd);
  if (inventoryValue <= 0) {
    return {
      cash_recovered_low_usd: 0,
      cash_recovered_high_usd: 0,
      margin_sacrificed_low_usd: 0,
      margin_sacrificed_high_usd: 0,
    };
  }

  const sellThroughLow =
    input.strategy === "bundle" ? 0.25 : input.strategy === "pause_reorders" ? 0.05 : 0.15;
  const sellThroughHigh =
    input.strategy === "bundle" ? 0.45 : input.strategy === "pause_reorders" ? 0.1 : 0.35;

  const cashRecoveredLow = Math.round(inventoryValue * sellThroughLow);
  const cashRecoveredHigh = Math.round(inventoryValue * sellThroughHigh);

  if (input.strategy !== "discount" || input.discount_pct == null || input.discount_pct <= 0) {
    const bundleSacrificeHigh =
      input.strategy === "bundle" ? Math.round(cashRecoveredHigh * 0.12) : 0;
    return {
      cash_recovered_low_usd: cashRecoveredLow,
      cash_recovered_high_usd: cashRecoveredHigh,
      margin_sacrificed_low_usd: 0,
      margin_sacrificed_high_usd: bundleSacrificeHigh,
    };
  }

  const discountRate = capLiquidationDiscountPct(input.discount_pct) / 100;
  return {
    cash_recovered_low_usd: cashRecoveredLow,
    cash_recovered_high_usd: cashRecoveredHigh,
    margin_sacrificed_low_usd: Math.round(cashRecoveredLow * discountRate * 0.5),
    margin_sacrificed_high_usd: Math.round(cashRecoveredHigh * discountRate),
  };
}
