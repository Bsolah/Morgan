#!/usr/bin/env node
/**
 * Re-publish bronze events to Kafka for a store and date range.
 *
 * Usage:
 *   pnpm bronze:replay -- --source shopify --store-id <uuid> --start 2026-06-01 --end 2026-06-17
 *   pnpm bronze:replay -- --source shopify --store-id <uuid> --start 2026-06-01 --end 2026-06-17 --dry-run
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBronzeStorage,
  createKafkaPublisher,
  InMemoryEventPublisher,
  replayBronzeEvents,
} from "@morgan/events";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireArg(name: string): string {
  const value = readArg(name);
  if (!value) {
    console.error(`Missing required argument: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const source = requireArg("--source");
  const storeId = requireArg("--store-id");
  const startDate = requireArg("--start");
  const endDate = requireArg("--end");
  const topic = readArg("--topic");
  const dryRun = process.argv.includes("--dry-run");

  const backend = (process.env.BRONZE_STORAGE_BACKEND ?? "filesystem") as "filesystem" | "s3";
  const bronze = await createBronzeStorage({
    backend,
    filesystemPath: process.env.BRONZE_STORAGE_PATH ?? "./data/bronze",
    s3Bucket: process.env.BRONZE_S3_BUCKET ?? "bronze",
    s3Region: process.env.BRONZE_S3_REGION,
  });

  const kafkaEnabled = process.env.KAFKA_ENABLED === "true";
  const fallback = new InMemoryEventPublisher();
  const publisher = kafkaEnabled
    ? await createKafkaPublisher(
        (process.env.KAFKA_BROKERS ?? "localhost:9092")
          .split(",")
          .map((broker) => broker.trim())
          .filter(Boolean),
        "morgan-bronze-replay",
        fallback,
      )
    : fallback;

  const result = await replayBronzeEvents({
    bronze,
    publisher,
    source,
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
    topic,
    dry_run: dryRun,
    onProgress: ({ key, topic: resolvedTopic, event_id }) => {
      console.log(`${dryRun ? "[dry-run] " : ""}${resolvedTopic} ${event_id} (${key})`);
    },
  });

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        kafka_enabled: kafkaEnabled,
        ...result,
      },
      null,
      2,
    ),
  );

  await publisher.close?.();

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
