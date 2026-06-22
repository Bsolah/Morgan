import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  createIdempotencyStore,
  EventProcessingMetrics,
  FileDeadLetterStorage,
  InMemoryIdempotencyStore,
  processEventIdempotently,
  SHOPIFY_ORDERS_TOPIC,
} from "@morgan/events";
import type { EventEnvelope } from "@morgan/shared";
import { createOrderFactWriter } from "@morgan/warehouse";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_GROUP_ID: z.string().default("morgan-order-ingest"),
  DEAD_LETTER_STORAGE_PATH: z.string().default("./data/dead-letter"),
  CLICKHOUSE_STORAGE_PATH: z.string().default("./data/clickhouse"),
  CLICKHOUSE_URL: z.string().url().optional(),
  CLICKHOUSE_ORDERS_TABLE: z.string().default("shopify_order_events"),
  REDIS_URL: z.string().url().optional(),
  EVENT_PROCESSING_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86_400),
});

const env = envSchema.parse(process.env);

async function startKafkaConsumer(
  processEvent: (event: EventEnvelope) => Promise<void>,
): Promise<() => Promise<void>> {
  const { Kafka } = await import("kafkajs");
  const kafka = new Kafka({
    clientId: "morgan-worker",
    brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
  });
  const consumer = kafka.consumer({ groupId: env.KAFKA_GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: SHOPIFY_ORDERS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString("utf8")) as EventEnvelope;
      await processEvent(event);
    },
  });

  return async () => {
    await consumer.disconnect();
  };
}

async function main() {
  const orderWriter = await createOrderFactWriter({
    clickhouseUrl: env.CLICKHOUSE_URL,
    clickhouseTable: env.CLICKHOUSE_ORDERS_TABLE,
    fallbackPath: env.CLICKHOUSE_STORAGE_PATH,
  });

  const deadLetter = new FileDeadLetterStorage(env.DEAD_LETTER_STORAGE_PATH);
  const idempotencyFallback = new InMemoryIdempotencyStore();
  const idempotency = await createIdempotencyStore(env.REDIS_URL, idempotencyFallback);
  const metrics = new EventProcessingMetrics();

  const processEvent = async (event: EventEnvelope) => {
    await processEventIdempotently({
      topic: SHOPIFY_ORDERS_TOPIC,
      event,
      idempotency,
      metrics,
      deadLetter,
      idempotencyTtlSeconds: env.EVENT_PROCESSING_IDEMPOTENCY_TTL_SECONDS,
      processor: async (envelope) => {
        await orderWriter.upsert(envelope);
      },
    });
  };

  const shutdown = await startKafkaConsumer(processEvent);
  console.log(`Morgan worker consuming ${SHOPIFY_ORDERS_TOPIC} with idempotent processing`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await shutdown();
      await orderWriter.close?.();
      await idempotency.close?.();
      process.exit(0);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
