import { describe, expect, it } from "vitest";
import { addDays } from "./sku-economics.js";
import {
  buildDeadStockSkuInputs,
  evaluateDeadStockLeak,
  evaluateDeadStockLeaks,
  hasDecliningVelocity,
  parseOrderSkuUnitSales,
  qualifiesForDeadStockLeak,
  type SkuUnitSale,
} from "./dead-stock-leak.js";

function buildSale(day: string, sku: string, units: number, orderId: string): SkuUnitSale {
  return { day, order_id: orderId, sku, units_sold: units };
}

function buildDecliningDeadStockFixture(referenceDay = "2026-06-30"): SkuUnitSale[] {
  const sales: SkuUnitSale[] = [];
  for (let offset = 89; offset >= 0; offset -= 1) {
    const day = addDays(referenceDay, -offset);
    const dayIndex = 89 - offset;
    const units = dayIndex < 60 ? 2 : 1;
    sales.push(buildSale(day, "HOODIE-GRAY-L", units, `order-${day}`));
  }
  return sales;
}

describe("dead stock leak detection", () => {
  it("parses Shopify line item unit sales", () => {
    const sales = parseOrderSkuUnitSales(
      {
        id: 3001,
        created_at: "2026-06-15T12:00:00Z",
        line_items: [
          { sku: "HOODIE-GRAY-L", quantity: 2, price: "60.00" },
          { sku: "TEE-BLUE-M", quantity: 1, price: "30.00" },
        ],
      },
      "3001",
    );

    expect(sales).toEqual([
      { day: "2026-06-15", order_id: "3001", sku: "HOODIE-GRAY-L", units_sold: 2 },
      { day: "2026-06-15", order_id: "3001", sku: "TEE-BLUE-M", units_sold: 1 },
    ]);
  });

  it("fires when days_of_stock exceeds 90 and 30d velocity is below 70% of 90d velocity", () => {
    const sales = buildDecliningDeadStockFixture();
    const inputs = buildDeadStockSkuInputs(
      sales,
      new Map([["HOODIE-GRAY-L", 200]]),
      new Map([["HOODIE-GRAY-L", 25]]),
      new Map([["HOODIE-GRAY-L", "Gray Hoodie (L)"]]),
      "2026-06-30",
    );

    const input = inputs.find((row) => row.sku === "HOODIE-GRAY-L");
    expect(input).toMatchObject({
      velocity_30d: 1,
      velocity_90d: expect.closeTo(1.67, 2),
    });
    expect(hasDecliningVelocity(input!.velocity_30d, input!.velocity_90d)).toBe(true);

    const evaluation = evaluateDeadStockLeak(input!);
    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.amount_at_risk_usd).toBe(5000);
    expect(evaluation.evidence).toMatchObject({
      sku: "HOODIE-GRAY-L",
      days_of_stock: 200,
      available_units: 200,
      inventory_value_usd: 5000,
      suggested_action: "liquidate",
    });
  });

  it("does not fire when supply cover is within 90 days", () => {
    const evaluation = evaluateDeadStockLeak({
      sku: "TEE-BLUE-M",
      title: "Blue Tee (M)",
      available_units: 100,
      unit_cost: 12,
      velocity_30d: 2,
      velocity_90d: 3,
    });

    expect(qualifiesForDeadStockLeak({
      sku: "TEE-BLUE-M",
      available_units: 100,
      unit_cost: 12,
      velocity_30d: 2,
      velocity_90d: 3,
    })).toBe(false);
    expect(evaluation.qualifies).toBe(false);
  });

  it("does not fire when velocity has not declined enough", () => {
    const evaluation = evaluateDeadStockLeak({
      sku: "TEE-BLUE-M",
      available_units: 300,
      unit_cost: 12,
      velocity_30d: 1,
      velocity_90d: 1.2,
    });

    expect(evaluation.qualifies).toBe(false);
  });

  it("suggests bundling when stock is slow-moving but still selling", () => {
    const evaluation = evaluateDeadStockLeak({
      sku: "SCARF-RED",
      title: "Red Scarf",
      available_units: 80,
      unit_cost: 8,
      velocity_30d: 0.5,
      velocity_90d: 1,
    });

    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.evidence?.suggested_action).toBe("bundle");
  });

  it("evaluates all inventoried SKUs", () => {
    const evaluations = evaluateDeadStockLeaks(
      buildDeadStockSkuInputs(
        buildDecliningDeadStockFixture(),
        new Map([
          ["HOODIE-GRAY-L", 200],
          ["TEE-BLUE-M", 0],
        ]),
        new Map([
          ["HOODIE-GRAY-L", 25],
          ["TEE-BLUE-M", 10],
        ]),
        new Map(),
        "2026-06-30",
      ),
    );

    const qualifying = evaluations.filter((evaluation) => evaluation.qualifies);
    expect(qualifying).toHaveLength(1);
    expect(qualifying[0]?.sku).toBe("HOODIE-GRAY-L");
  });
});
