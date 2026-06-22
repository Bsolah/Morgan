import type { EventEnvelope } from "@morgan/shared";
import { createCatalogWriter, createOrderFactWriter, type CatalogWriter, type OrderFactWriter } from "@morgan/warehouse";
import {
  createBronzeStorage,
  createIdempotencyStore,
  createKafkaPublisher,
  EventPipeline,
  FileDeadLetterStorage,
  InMemoryEventPublisher,
  InMemoryIdempotencyStore,
  OrderIngestWorker,
  SHOPIFY_INVENTORY_TOPIC,
  SHOPIFY_ORDERS_TOPIC,
  SHOPIFY_PRODUCTS_TOPIC,
  type BronzeStorageBackend,
  type EventPublisher,
  type IdempotencyStore,
} from "./index.js";
import {
  DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
  EventProcessingMetrics,
} from "./event-processing.js";
import {
  extractOrderLineFacts,
  extractShopifyId,
  mapInventoryWebhookToLevel,
  mapRestProductWebhookToDimProducts,
  type DimProductRow,
} from "@morgan/warehouse";

export type IngestRuntime = {
  pipeline: EventPipeline;
  publisher: EventPublisher;
  idempotency: IdempotencyStore;
  eventProcessingMetrics: EventProcessingMetrics;
  orderWriter: OrderFactWriter;
  catalogWriter: CatalogWriter;
  startWorkers(): void;
  close(): Promise<void>;
};

export async function createIngestRuntime(options: {
  bronzePath: string;
  bronzeBackend?: BronzeStorageBackend;
  bronzeS3Bucket?: string;
  bronzeS3Region?: string;
  deadLetterPath: string;
  clickhousePath: string;
  kafkaEnabled: boolean;
  kafkaBrokers: string[];
  redisUrl?: string;
  clickhouseUrl?: string;
  clickhouseTable?: string;
  clickhouseDimProductsTable?: string;
  clickhouseInventoryTable?: string;
  clickhouseOrderLinesTable?: string;
  eventProcessingTtlSeconds?: number;
}): Promise<IngestRuntime> {
  const fallbackPublisher = new InMemoryEventPublisher();
  const idempotencyFallback = new InMemoryIdempotencyStore();
  const eventProcessingMetrics = new EventProcessingMetrics();
  const workerOptions = {
    idempotency: idempotencyFallback,
    metrics: eventProcessingMetrics,
    idempotencyTtlSeconds: options.eventProcessingTtlSeconds ?? DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
  };

  const publisher = options.kafkaEnabled
    ? await createKafkaPublisher(options.kafkaBrokers, "morgan-api", fallbackPublisher)
    : fallbackPublisher;

  const idempotency = await createIdempotencyStore(options.redisUrl, idempotencyFallback);
  workerOptions.idempotency = idempotency;
  const orderWriter = await createOrderFactWriter({
    clickhouseUrl: options.clickhouseUrl,
    clickhouseTable: options.clickhouseTable,
    fallbackPath: options.clickhousePath,
  });
  const catalogWriter = await createCatalogWriter({
    clickhouseUrl: options.clickhouseUrl,
    fallbackPath: options.clickhousePath,
    tables: {
      dimProducts: options.clickhouseDimProductsTable,
      inventoryLevels: options.clickhouseInventoryTable,
      factOrderLines: options.clickhouseOrderLinesTable,
    },
  });

  const pipeline = new EventPipeline(
    publisher,
    await createBronzeStorage({
      backend: options.bronzeBackend ?? "filesystem",
      filesystemPath: options.bronzePath,
      s3Bucket: options.bronzeS3Bucket,
      s3Region: options.bronzeS3Region,
    }),
  );

  const deadLetter = new FileDeadLetterStorage(options.deadLetterPath);

  const orderWorker = new OrderIngestWorker(
    publisher,
    async (event: EventEnvelope) => {
      await orderWriter.upsert(event);
      const productIndex = (await catalogWriter.loadProductIndex?.(event.store_id)) ?? new Map<string, DimProductRow>();
      const lines = extractOrderLineFacts(
        {
          store_id: event.store_id,
          occurred_at: event.occurred_at,
          payload: event.payload as Record<string, unknown>,
        },
        productIndex,
      );
      for (const line of lines) {
        await catalogWriter.upsertOrderLine(line);
      }
    },
    deadLetter,
    SHOPIFY_ORDERS_TOPIC,
    workerOptions,
  );

  const productWorker = new OrderIngestWorker(
    publisher,
    async (event: EventEnvelope) => {
      const payload = event.payload as Record<string, unknown>;
      const topic = String(payload.topic ?? event.event_type);

      if (topic === "products/delete") {
        const productId = extractShopifyId(payload.id as string | number);
        if (!productId) return;
        const occurredAt = event.occurred_at;
        const index = (await catalogWriter.loadProductIndex?.(event.store_id)) ?? new Map();
        for (const row of index.values()) {
          if (row.product_id !== productId) continue;
          await catalogWriter.upsertProduct({
            ...row,
            is_active: false,
            updated_at: occurredAt,
            ingested_at: new Date().toISOString(),
          });
        }
        return;
      }

      const rows = mapRestProductWebhookToDimProducts({
        storeId: event.store_id,
        product: payload,
        occurredAt: event.occurred_at,
      });

      const activeVariantIds = new Set(rows.map((row) => row.variant_id));
      for (const row of rows) {
        await catalogWriter.upsertProduct(row);
      }

      if (catalogWriter.deactivateProductVariants && payload.id != null) {
        const productId = extractShopifyId(payload.id as string | number);
        if (productId) {
          await catalogWriter.deactivateProductVariants(
            event.store_id,
            productId,
            activeVariantIds,
            event.occurred_at,
          );
        }
      }
    },
    deadLetter,
    SHOPIFY_PRODUCTS_TOPIC,
    workerOptions,
  );

  const inventoryWorker = new OrderIngestWorker(
    publisher,
    async (event: EventEnvelope) => {
      const payload = event.payload as Record<string, unknown>;
      const index = (await catalogWriter.loadProductIndex?.(event.store_id)) ?? new Map();
      const inventoryItemId = String(payload.inventory_item_id ?? "");
      const product = index.get(`${event.store_id}:inv:${inventoryItemId}`);
      const row = mapInventoryWebhookToLevel({
        storeId: event.store_id,
        payload,
        variantId: product?.variant_id ?? null,
        occurredAt: event.occurred_at,
      });
      if (row) {
        await catalogWriter.upsertInventoryLevel(row);
      }
    },
    deadLetter,
    SHOPIFY_INVENTORY_TOPIC,
    workerOptions,
  );

  return {
    pipeline,
    publisher,
    idempotency,
    eventProcessingMetrics,
    orderWriter,
    catalogWriter,
    startWorkers: () => {
      orderWorker.start();
      productWorker.start();
      inventoryWorker.start();
    },
    close: async () => {
      await publisher.close?.();
      await idempotency.close?.();
      await orderWriter.close?.();
      await catalogWriter.close?.();
    },
  };
}
