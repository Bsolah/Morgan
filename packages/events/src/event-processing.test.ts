import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "@morgan/shared";
import { InMemoryIdempotencyStore } from "./idempotency.js";
import {
  claimEventForProcessing,
  computeProcessingLagMs,
  DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
  EventProcessingMetrics,
  eventProcessingClaimKey,
  processEventIdempotently,
} from "./event-processing.js";
import { FileDeadLetterStorage } from "./storage.js";

describe("event processing idempotency", () => {
  it("uses event-process claim keys with 24h default ttl", async () => {
    expect(eventProcessingClaimKey("evt-123")).toBe("event-process:evt-123");
    expect(DEFAULT_EVENT_PROCESSING_TTL_SECONDS).toBe(86_400);
  });

  it("claims event_id once within ttl window", async () => {
    const store = new InMemoryIdempotencyStore();
    await expect(claimEventForProcessing(store, "evt-1", 86_400)).resolves.toBe(true);
    await expect(claimEventForProcessing(store, "evt-1", 86_400)).resolves.toBe(false);
  });
});

describe("EventProcessingMetrics", () => {
  it("tracks duplicate rate, error rate, and processing lag per topic", () => {
    const metrics = new EventProcessingMetrics();

    metrics.recordReceived("shopify.orders");
    metrics.recordDuplicate("shopify.orders");

    metrics.recordReceived("shopify.orders");
    metrics.recordProcessed("shopify.orders", 500);

    metrics.recordReceived("shopify.products");
    metrics.recordError("shopify.products");

    const snapshot = metrics.snapshot();
    const orders = snapshot.topics.find((topic) => topic.topic === "shopify.orders");
    const products = snapshot.topics.find((topic) => topic.topic === "shopify.products");

    expect(orders).toMatchObject({
      received: 2,
      processed: 1,
      duplicates: 1,
      errors: 0,
      duplicate_rate: 0.5,
      error_rate: 0,
      avg_processing_lag_ms: 500,
    });
    expect(products).toMatchObject({
      received: 1,
      processed: 0,
      duplicates: 0,
      errors: 1,
      duplicate_rate: 0,
      error_rate: 1,
      avg_processing_lag_ms: 0,
    });
  });
});

describe("processEventIdempotently", () => {
  const event: EventEnvelope = {
    event_id: "550e8400-e29b-41d4-a716-446655440099",
    event_type: "orders.create",
    store_id: "00000000-0000-4000-8000-000000000002",
    source: "shopify",
    occurred_at: new Date(Date.now() - 1_000).toISOString(),
    payload: { id: 1 },
    schema_version: 1,
  };

  it("acks duplicates without calling the processor", async () => {
    const idempotency = new InMemoryIdempotencyStore();
    const metrics = new EventProcessingMetrics();
    const deadLetter = new FileDeadLetterStorage("./data/test-dead-letter");
    let attempts = 0;

    const first = await processEventIdempotently({
      topic: "shopify.orders",
      event,
      idempotency,
      metrics,
      deadLetter,
      processor: async () => {
        attempts += 1;
      },
    });
    const second = await processEventIdempotently({
      topic: "shopify.orders",
      event,
      idempotency,
      metrics,
      deadLetter,
      processor: async () => {
        attempts += 1;
      },
    });

    expect(first).toBe("processed");
    expect(second).toBe("duplicate");
    expect(attempts).toBe(1);
    expect(metrics.snapshot().topics[0]?.duplicates).toBe(1);
  });

  it("computes processing lag from occurred_at", () => {
    const lagMs = computeProcessingLagMs(event);
    expect(lagMs).toBeGreaterThanOrEqual(1_000);
  });
});
