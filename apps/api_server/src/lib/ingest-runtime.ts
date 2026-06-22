import { createIngestRuntime, InMemoryEventPublisher, type IngestRuntime } from "@morgan/events";
import { env } from "../config.js";

let runtime: IngestRuntime | null = null;
let initPromise: Promise<IngestRuntime> | null = null;

export async function getIngestRuntime(): Promise<IngestRuntime> {
  if (runtime) return runtime;
  if (!initPromise) {
    initPromise = createIngestRuntime({
      bronzePath: env.BRONZE_STORAGE_PATH,
      bronzeBackend: env.BRONZE_STORAGE_BACKEND,
      bronzeS3Bucket: env.BRONZE_S3_BUCKET,
      bronzeS3Region: env.BRONZE_S3_REGION,
      deadLetterPath: env.DEAD_LETTER_STORAGE_PATH,
      clickhousePath: env.CLICKHOUSE_STORAGE_PATH,
      kafkaEnabled: env.KAFKA_ENABLED,
      kafkaBrokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
      redisUrl: env.REDIS_URL,
      clickhouseUrl: env.CLICKHOUSE_URL,
      clickhouseTable: env.CLICKHOUSE_ORDERS_TABLE,
      clickhouseDimProductsTable: env.CLICKHOUSE_DIM_PRODUCTS_TABLE,
      clickhouseInventoryTable: env.CLICKHOUSE_INVENTORY_TABLE,
      clickhouseOrderLinesTable: env.CLICKHOUSE_ORDER_LINES_TABLE,
      eventProcessingTtlSeconds: env.EVENT_PROCESSING_IDEMPOTENCY_TTL_SECONDS,
    }).then((created) => {
      created.startWorkers();
      runtime = created;
      return created;
    });
  }
  return initPromise;
}

export function getInMemoryPublisher(): InMemoryEventPublisher | null {
  const publisher = runtime?.publisher;
  return publisher instanceof InMemoryEventPublisher ? publisher : null;
}

export function getEventProcessingMetrics() {
  return runtime?.eventProcessingMetrics ?? null;
}

export function resetIngestRuntimeForTests(): void {
  runtime = null;
  initPromise = null;
}

export async function closeIngestRuntime(): Promise<void> {
  if (runtime) {
    await runtime.close();
    runtime = null;
    initPromise = null;
  }
}
