import { describe, expect, it } from "vitest";
import { flattenInventoryLevels, flattenProductVariants } from "./product-catalog.js";

describe("product catalog helpers", () => {
  it("flattens GraphQL product variants", () => {
    const rows = flattenProductVariants({
      products: {
        pageInfo: { hasNextPage: false, endCursor: null },
        edges: [
          {
            node: {
              id: "gid://shopify/Product/10",
              title: "Blue Tee",
              status: "ACTIVE",
              variants: {
                edges: [{ node: { id: "gid://shopify/ProductVariant/20", sku: "BLUE-M" } }],
              },
            },
          },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.variant.id).toBe("gid://shopify/ProductVariant/20");
  });

  it("flattens inventory levels with variant ids", () => {
    const rows = flattenInventoryLevels({
      locations: {
        pageInfo: { hasNextPage: false, endCursor: null },
        edges: [
          {
            node: {
              id: "gid://shopify/Location/1",
              inventoryLevels: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    node: {
                      quantities: [{ name: "available", quantity: 7 }],
                      item: {
                        id: "gid://shopify/InventoryItem/55",
                        variant: { id: "gid://shopify/ProductVariant/20" },
                      },
                      location: { id: "gid://shopify/Location/1" },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    });

    expect(rows[0]).toMatchObject({
      locationId: "1",
      inventoryItemId: "55",
      variantId: "20",
      available: 7,
    });
  });
});
