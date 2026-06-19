import { describe, expect, it } from "vitest";
import {
  extractOrderLineFacts,
  mapGraphqlVariantToDimProduct,
  mapRestProductWebhookToDimProducts,
  type DimProductRow,
} from "./catalog-models.js";

describe("catalog models", () => {
  it("maps GraphQL variant fields into dim_products", () => {
    const row = mapGraphqlVariantToDimProduct({
      storeId: "store-1",
      productId: "gid://shopify/Product/10",
      productTitle: "Blue Tee",
      productStatus: "ACTIVE",
      variant: {
        id: "gid://shopify/ProductVariant/20",
        sku: "BLUE-M",
        title: "Medium",
        price: "29.00",
        inventoryItem: { unitCost: { amount: "8.50" } },
      },
    });

    expect(row).toMatchObject({
      store_id: "store-1",
      product_id: "10",
      variant_id: "20",
      sku: "BLUE-M",
      price: "29.00",
      unit_cost: "8.50",
      is_active: true,
    });
  });

  it("links fact_order_lines to dim_products by variant_id and sku", () => {
    const product: DimProductRow = {
      store_id: "store-1",
      product_id: "10",
      variant_id: "20",
      inventory_item_id: "30",
      sku: "BLUE-M",
      title: "Blue Tee - Medium",
      price: "29.00",
      unit_cost: "8.50",
      is_active: true,
      updated_at: "2026-06-17T10:00:00.000Z",
      ingested_at: "2026-06-17T10:00:00.000Z",
    };
    const index = new Map<string, DimProductRow>([["store-1:20", product]]);

    const rows = extractOrderLineFacts(
      {
        store_id: "store-1",
        occurred_at: "2026-06-17T10:00:00.000Z",
        payload: {
          id: 1001,
          line_items: [{ id: 1, variant_id: 20, sku: "BLUE-M", quantity: 2, price: "29.00" }],
        },
      },
      index,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      order_id: "1001",
      variant_id: "20",
      sku: "BLUE-M",
      unit_cost: "8.50",
      gross_revenue: "58.0000",
    });
  });

  it("marks archived webhook variants inactive", () => {
    const rows = mapRestProductWebhookToDimProducts({
      storeId: "store-1",
      product: {
        id: 10,
        title: "Blue Tee",
        status: "ARCHIVED",
        variants: [{ id: 20, sku: "BLUE-M", price: "29.00" }],
      },
    });

    expect(rows[0]?.is_active).toBe(false);
  });
});
