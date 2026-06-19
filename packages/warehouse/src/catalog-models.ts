export type DimProductRow = {
  store_id: string;
  product_id: string;
  variant_id: string;
  inventory_item_id: string | null;
  sku: string;
  title: string;
  price: string;
  unit_cost: string | null;
  is_active: boolean;
  updated_at: string;
  ingested_at: string;
};

export type InventoryLevelRow = {
  store_id: string;
  variant_id: string;
  location_id: string;
  available: number;
  updated_at: string;
  ingested_at: string;
};

export type OrderLineFactRow = {
  store_id: string;
  order_id: string;
  line_id: string;
  variant_id: string | null;
  sku: string | null;
  quantity: number;
  gross_revenue: string;
  unit_cost: string | null;
  ordered_at: string;
  ingested_at: string;
};

export function extractShopifyId(gidOrId: string | number | null | undefined): string | null {
  if (gidOrId == null) return null;
  const value = String(gidOrId);
  const parts = value.split("/");
  return parts[parts.length - 1] ?? value;
}

export function mapGraphqlVariantToDimProduct(input: {
  storeId: string;
  productId: string;
  productTitle: string;
  productStatus: string;
  variant: Record<string, unknown>;
  occurredAt?: string;
}): DimProductRow | null {
  const variantId = extractShopifyId(input.variant.id as string);
  if (!variantId) return null;

  const inventoryItem = input.variant.inventoryItem as Record<string, unknown> | undefined;
  const unitCost = inventoryItem?.unitCost as Record<string, unknown> | undefined;
  const amount = unitCost?.amount;
  const inventoryItemId = extractShopifyId(inventoryItem?.id as string);

  const isActive = input.productStatus !== "ARCHIVED" && input.variant.availableForSale !== false;

  return {
    store_id: input.storeId,
    product_id: extractShopifyId(input.productId) ?? input.productId,
    variant_id: variantId,
    inventory_item_id: inventoryItemId,
    sku: typeof input.variant.sku === "string" ? input.variant.sku : "",
    title:
      typeof input.variant.title === "string" && input.variant.title.length > 0
        ? `${input.productTitle} - ${input.variant.title}`
        : input.productTitle,
    price: typeof input.variant.price === "string" ? input.variant.price : String(input.variant.price ?? "0"),
    unit_cost: amount != null ? String(amount) : null,
    is_active: isActive,
    updated_at: input.occurredAt ?? new Date().toISOString(),
    ingested_at: new Date().toISOString(),
  };
}

export function mapRestProductWebhookToDimProducts(input: {
  storeId: string;
  product: Record<string, unknown>;
  occurredAt?: string;
}): DimProductRow[] {
  const productId = extractShopifyId(input.product.id as string | number) ?? String(input.product.id ?? "");
  const productTitle = String(input.product.title ?? "Product");
  const productStatus = String(input.product.status ?? "ACTIVE");
  const variants = Array.isArray(input.product.variants) ? input.product.variants : [];

  return variants
    .map((variant) =>
      mapGraphqlVariantToDimProduct({
        storeId: input.storeId,
        productId,
        productTitle,
        productStatus,
        variant: variant as Record<string, unknown>,
        occurredAt: input.occurredAt,
      }),
    )
    .filter((row): row is DimProductRow => row != null);
}

export function mapInventoryWebhookToLevel(input: {
  storeId: string;
  payload: Record<string, unknown>;
  variantId?: string | null;
  occurredAt?: string;
}): InventoryLevelRow | null {
  const inventoryItemId = extractShopifyId(input.payload.inventory_item_id as string | number);
  const locationId = extractShopifyId(input.payload.location_id as string | number);
  if (!inventoryItemId || !locationId) return null;

  return {
    store_id: input.storeId,
    variant_id: input.variantId ?? inventoryItemId,
    location_id: locationId,
    available: Number(input.payload.available ?? 0),
    updated_at: input.occurredAt ?? new Date().toISOString(),
    ingested_at: new Date().toISOString(),
  };
}

export function extractOrderLineFacts(
  event: { store_id: string; occurred_at: string; payload: Record<string, unknown> },
  productIndex: Map<string, DimProductRow>,
): OrderLineFactRow[] {
  const orderId = extractShopifyId(event.payload.id as string | number);
  if (!orderId) return [];

  const lineItems = Array.isArray(event.payload.line_items)
    ? event.payload.line_items
    : [];

  return lineItems
    .map((line) => {
      const item = line as Record<string, unknown>;
      const lineId = extractShopifyId(item.id as string | number);
      if (!lineId) return null;

      const variantId = extractShopifyId(item.variant_id as string | number);
      const sku = typeof item.sku === "string" ? item.sku : null;
      const product = variantId
        ? productIndex.get(`${event.store_id}:${variantId}`)
        : sku
          ? [...productIndex.values()].find((row) => row.store_id === event.store_id && row.sku === sku)
          : undefined;

      const quantity = Number(item.quantity ?? 0);
      const price = Number(item.price ?? 0);

      return {
        store_id: event.store_id,
        order_id: orderId,
        line_id: lineId,
        variant_id: variantId,
        sku: sku ?? product?.sku ?? null,
        quantity,
        gross_revenue: (price * quantity).toFixed(4),
        unit_cost: product?.unit_cost ?? null,
        ordered_at: event.occurred_at,
        ingested_at: new Date().toISOString(),
      } satisfies OrderLineFactRow;
    })
    .filter((row): row is OrderLineFactRow => row != null);
}
