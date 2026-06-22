import { LOW_CONFIDENCE_ORDER_THRESHOLD } from "../finance/sku-economics.js";

export const MAX_PRICE_INCREASE_PCT = 5;
export const DEFAULT_TARGET_MARGIN_RATE = 0.4;
export const PRICE_ELASTICITY = -0.5;

export type SkuPriceIncreaseInput = {
  sku: string;
  title?: string | null;
  current_price: number;
  margin_rate: number;
  orders_30d: number;
  velocity_30d: number;
  velocity_90d: number;
  target_margin_rate?: number;
};

export type PriceIncreaseSuggestion = {
  sku: string;
  current_price: number;
  suggested_price: number;
  increase_pct: number;
  expected_margin_delta_usd: number;
  expected_unit_delta_pct: number;
  expected_unit_delta: number;
  confidence: "high" | "low";
};

export function qualifiesForPriceIncrease(input: SkuPriceIncreaseInput): boolean {
  const target = input.target_margin_rate ?? DEFAULT_TARGET_MARGIN_RATE;
  if (input.current_price <= 0 || input.margin_rate <= 0) return false;
  if (input.margin_rate >= target) return false;
  if (input.velocity_30d < input.velocity_90d) return false;
  if (input.orders_30d < LOW_CONFIDENCE_ORDER_THRESHOLD) return false;
  return true;
}

export function pricingConfidenceFromOrders(ordersCount: number): "high" | "low" {
  return ordersCount >= LOW_CONFIDENCE_ORDER_THRESHOLD ? "high" : "low";
}

export function computePriceIncreasePct(
  currentMarginRate: number,
  targetMarginRate: number,
): number {
  if (currentMarginRate <= 0 || targetMarginRate <= currentMarginRate) {
    return MAX_PRICE_INCREASE_PCT;
  }

  const requiredRatio = targetMarginRate / currentMarginRate;
  const requiredPct = (requiredRatio - 1) * 100;
  return Math.min(MAX_PRICE_INCREASE_PCT, Math.max(1, Math.round(requiredPct * 10) / 10));
}

export function buildPriceIncreaseSuggestion(
  input: SkuPriceIncreaseInput,
): PriceIncreaseSuggestion | null {
  if (!qualifiesForPriceIncrease(input)) return null;

  const target = input.target_margin_rate ?? DEFAULT_TARGET_MARGIN_RATE;
  const increasePct = computePriceIncreasePct(input.margin_rate, target);
  const suggestedPrice = Math.round(input.current_price * (1 + increasePct / 100) * 100) / 100;
  const expectedUnitDeltaPct = Math.round(increasePct * PRICE_ELASTICITY * 10) / 10;

  const monthlyUnits = input.velocity_30d * 30;
  const unitCogs = input.current_price * (1 - input.margin_rate);
  const currentUnitMargin = input.current_price * input.margin_rate;
  const newUnitMargin = suggestedPrice - unitCogs;
  const expectedUnits = monthlyUnits * (1 + expectedUnitDeltaPct / 100);
  const expectedUnitDelta = Math.round((expectedUnits - monthlyUnits) * 10) / 10;
  const expectedMarginDelta =
    Math.round((newUnitMargin * expectedUnits - currentUnitMargin * monthlyUnits) * 100) / 100;

  return {
    sku: input.sku,
    current_price: input.current_price,
    suggested_price: suggestedPrice,
    increase_pct: increasePct,
    expected_margin_delta_usd: expectedMarginDelta,
    expected_unit_delta_pct: expectedUnitDeltaPct,
    expected_unit_delta: expectedUnitDelta,
    confidence: pricingConfidenceFromOrders(input.orders_30d),
  };
}
