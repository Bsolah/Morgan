import { shopifyAdminGraphql } from "./admin-graphql.js";

const PRODUCTS_PAGE_QUERY = `
  query ProductCatalogPage($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          status
          variants(first: 100) {
            edges {
              node {
                id
                sku
                title
                price
                availableForSale
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const INVENTORY_LEVELS_QUERY = `
  query InventoryLevelsPage($locationCursor: String, $levelCursor: String) {
    locations(first: 10, after: $locationCursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          inventoryLevels(first: 100, after: $levelCursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                quantities(names: ["available"]) {
                  name
                  quantity
                }
                item {
                  id
                  variant {
                    id
                  }
                }
                location {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

export type ProductCatalogPage = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: Record<string, unknown>;
    }>;
  };
};

export type InventoryLevelsPage = {
  locations: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: {
        id: string;
        inventoryLevels: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: Array<{ node: Record<string, unknown> }>;
        };
      };
    }>;
  };
};

export async function fetchProductCatalogPage(
  shopDomain: string,
  accessToken: string,
  cursor?: string | null,
): Promise<ProductCatalogPage> {
  return shopifyAdminGraphql<ProductCatalogPage>(shopDomain, accessToken, PRODUCTS_PAGE_QUERY, {
    cursor: cursor ?? null,
  });
}

export async function fetchInventoryLevelsPage(
  shopDomain: string,
  accessToken: string,
  options: { locationCursor?: string | null; levelCursor?: string | null } = {},
): Promise<InventoryLevelsPage> {
  return shopifyAdminGraphql<InventoryLevelsPage>(
    shopDomain,
    accessToken,
    INVENTORY_LEVELS_QUERY,
    {
      locationCursor: options.locationCursor ?? null,
      levelCursor: options.levelCursor ?? null,
    },
  );
}

export function flattenProductVariants(page: ProductCatalogPage): Array<{
  product: Record<string, unknown>;
  variant: Record<string, unknown>;
}> {
  const rows: Array<{ product: Record<string, unknown>; variant: Record<string, unknown> }> = [];

  for (const edge of page.products.edges) {
    const product = edge.node;
    const variants = product.variants as
      | { edges: Array<{ node: Record<string, unknown> }> }
      | undefined;

    for (const variantEdge of variants?.edges ?? []) {
      rows.push({ product, variant: variantEdge.node });
    }
  }

  return rows;
}

export function flattenInventoryLevels(page: InventoryLevelsPage): Array<{
  locationId: string;
  inventoryItemId: string;
  variantId: string | null;
  available: number;
}> {
  const rows: Array<{
    locationId: string;
    inventoryItemId: string;
    variantId: string | null;
    available: number;
  }> = [];

  for (const locationEdge of page.locations.edges) {
    const locationGid = locationEdge.node.id;
    const locationId = locationGid.split("/").pop() ?? locationGid;

    for (const levelEdge of locationEdge.node.inventoryLevels.edges) {
      const node = levelEdge.node;
      const item = node.item as Record<string, unknown> | undefined;
      const variant = item?.variant as Record<string, unknown> | undefined;
      const inventoryItemGid = String(item?.id ?? "");
      const inventoryItemId = inventoryItemGid.split("/").pop() ?? inventoryItemGid;
      const variantGid = variant?.id ? String(variant.id) : null;
      const variantId = variantGid ? (variantGid.split("/").pop() ?? variantGid) : null;
      const quantities = Array.isArray(node.quantities)
        ? (node.quantities as Array<{ name: string; quantity: number }>)
        : [];
      const available = quantities.find((q) => q.name === "available")?.quantity ?? 0;

      rows.push({ locationId, inventoryItemId, variantId, available });
    }
  }

  return rows;
}
