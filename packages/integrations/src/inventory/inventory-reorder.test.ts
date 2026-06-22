import { describe, expect, it } from "vitest";
import {
  computeDemandStdDev,
  computeReorderPointUnits,
  computeReorderQty,
  computeRunwayImpactDays,
  computeSafetyStockUnits,
  isEligibleForReorderRecommendation,
  SAFETY_STOCK_Z_SCORE,
} from "./inventory-reorder.js";

describe("inventory-reorder", () => {
  it("computes safety stock from demand standard deviation", () => {
    const demandStdDev = computeDemandStdDev([2, 4, 3, 5, 2, 4, 3]);
    const safetyStock = computeSafetyStockUnits(demandStdDev, 14, SAFETY_STOCK_Z_SCORE);

    expect(demandStdDev).toBeGreaterThan(0);
    expect(safetyStock).toBe(Math.ceil(SAFETY_STOCK_Z_SCORE * demandStdDev * Math.sqrt(14)));
  });

  it("computes reorder point and reorder quantity", () => {
    const velocity = 5;
    const leadTime = 14;
    const safetyStock = 12;
    const reorderPoint = computeReorderPointUnits(velocity, leadTime, safetyStock);
    const reorderQty = computeReorderQty(reorderPoint, 35, velocity, leadTime);

    expect(reorderPoint).toBe(velocity * leadTime + safetyStock);
    expect(reorderQty).toBe(Math.max(0, Math.ceil(reorderPoint - 35 + velocity * leadTime)));
  });

  it("estimates runway impact from reorder cost", () => {
    expect(computeRunwayImpactDays(5000, 1000)).toBe(5);
    expect(computeRunwayImpactDays(5000, null)).toBeNull();
  });

  it("excludes low-revenue SKUs unless stockout is within 3 days", () => {
    expect(
      isEligibleForReorderRecommendation({
        reorder_recommended: true,
        revenue_rank: 60,
        days_of_stock: 10,
      }),
    ).toBe(false);

    expect(
      isEligibleForReorderRecommendation({
        reorder_recommended: true,
        revenue_rank: 60,
        days_of_stock: 2,
      }),
    ).toBe(true);

    expect(
      isEligibleForReorderRecommendation({
        reorder_recommended: true,
        revenue_rank: 10,
        days_of_stock: 20,
      }),
    ).toBe(true);
  });
});
