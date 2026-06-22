import { describe, expect, it } from "vitest";
import {
  candidatesConflict,
  conflictGroupForCategory,
  selectNonConflictingCandidates,
} from "./recommendation-conflicts.js";

describe("recommendation-conflicts", () => {
  it("maps categories to opposing conflict groups on the same SKU", () => {
    expect(conflictGroupForCategory("inventory_reorder")).toBe("stock_up");
    expect(conflictGroupForCategory("inventory_liquidate")).toBe("stock_down");
    expect(conflictGroupForCategory("discount_bleed")).toBe("price_down");
    expect(conflictGroupForCategory("price_increase")).toBe("price_up");
  });

  it("detects conflicting recommendations on the same SKU", () => {
    expect(
      candidatesConflict(
        { category: "inventory_reorder", subject_sku: "SKU-1", rank_score: 100 },
        { category: "inventory_liquidate", subject_sku: "SKU-1", rank_score: 90 },
      ),
    ).toBe(true);

    expect(
      candidatesConflict(
        { category: "price_increase", subject_sku: "SKU-1", rank_score: 100 },
        { category: "discount_bleed", subject_sku: "SKU-1", rank_score: 90 },
      ),
    ).toBe(true);
  });

  it("does not treat different SKUs as conflicting", () => {
    expect(
      candidatesConflict(
        { category: "inventory_reorder", subject_sku: "SKU-1", rank_score: 100 },
        { category: "inventory_liquidate", subject_sku: "SKU-2", rank_score: 90 },
      ),
    ).toBe(false);
  });

  it("keeps the highest-ranked non-conflicting candidates", () => {
    const ranked = [
      { category: "inventory_reorder", subject_sku: "SKU-1", rank_score: 120 },
      { category: "inventory_liquidate", subject_sku: "SKU-1", rank_score: 110 },
      { category: "ad_waste", subject_sku: null, rank_score: 100 },
    ];

    expect(selectNonConflictingCandidates(ranked)).toEqual([
      { category: "inventory_reorder", subject_sku: "SKU-1", rank_score: 120 },
      { category: "ad_waste", subject_sku: null, rank_score: 100 },
    ]);
  });
});
