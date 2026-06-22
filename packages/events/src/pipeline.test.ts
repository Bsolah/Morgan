import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "@morgan/shared";
import { EventProcessingMetrics } from "./event-processing.js";
import { InMemoryIdempotencyStore } from "./idempotency.js";
import { InMemoryEventPublisher } from "./publishers/in-memory.js";
import { FileDeadLetterStorage } from "./storage.js";
import { OrderIngestWorker } from "./pipeline.js";
import { withRetries } from "./types.js";

describe("withRetries", () => {
  it("retries up to 3 times with exponential backoff", async () => {
    let attempts = 0;
    const started = Date.now();

    await expect(
      withRetries(
        async () => {
          attempts += 1;
          if (attempts < 3) throw new Error("transient");
          return "ok";
        },
        { maxAttempts: 3, baseDelayMs: 20 },
      ),
    ).resolves.toBe("ok");

    expect(attempts).toBe(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
  });
});

describe("OrderIngestWorker", () => {
  it("dead-letters after 3 failed processing attempts", async () => {
    const publisher = new InMemoryEventPublisher();
    const deadLetter = new FileDeadLetterStorage("./data/test-dead-letter");
    let attempts = 0;

    const worker = new OrderIngestWorker(
      publisher,
      async () => {
        attempts += 1;
        throw new Error("clickhouse unavailable");
      },
      deadLetter,
      "shopify.orders",
      { idempotency: new InMemoryIdempotencyStore(), metrics: new EventProcessingMetrics() },
    );
    worker.start();

    const event: EventEnvelope = {
      event_id: "550e8400-e29b-41d4-a716-446655440001",
      event_type: "orders.create",
      store_id: "00000000-0000-4000-8000-000000000002",
      source: "shopify",
      occurred_at: new Date().toISOString(),
      payload: { id: 1 },
      schema_version: 1,
    };

    await publisher.publish("shopify.orders", event);
    expect(attempts).toBe(3);
  });

  it("does not reprocess duplicate event_id", async () => {
    const publisher = new InMemoryEventPublisher();
    const deadLetter = new FileDeadLetterStorage("./data/test-dead-letter");
    const idempotency = new InMemoryIdempotencyStore();
    const metrics = new EventProcessingMetrics();
    let attempts = 0;

    const worker = new OrderIngestWorker(
      publisher,
      async () => {
        attempts += 1;
      },
      deadLetter,
      "shopify.orders",
      { idempotency, metrics },
    );
    worker.start();

    const event: EventEnvelope = {
      event_id: "550e8400-e29b-41d4-a716-446655440002",
      event_type: "orders.create",
      store_id: "00000000-0000-4000-8000-000000000002",
      source: "shopify",
      occurred_at: new Date().toISOString(),
      payload: { id: 2 },
      schema_version: 1,
    };

    await publisher.publish("shopify.orders", event);
    await publisher.publish("shopify.orders", event);

    expect(attempts).toBe(1);
    expect(metrics.snapshot().topics[0]).toMatchObject({
      topic: "shopify.orders",
      processed: 1,
      duplicates: 1,
      duplicate_rate: 0.5,
    });
  });
});
