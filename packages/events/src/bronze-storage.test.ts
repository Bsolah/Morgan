import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EventEnvelope } from "@morgan/shared";
import { FileBronzeStorage } from "./storage.js";
import { InMemoryEventPublisher } from "./publishers/in-memory.js";
import { EventPipeline } from "./pipeline.js";
import { replayBronzeEvents } from "./replay.js";
import { resolveKafkaTopicForEvent } from "./topic-resolver.js";

const STORE_ID = "00000000-0000-4000-8000-000000000002";

function sampleEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    event_id: "550e8400-e29b-41d4-a716-446655440001",
    event_type: "orders.create",
    store_id: STORE_ID,
    source: "shopify",
    occurred_at: "2026-06-17T12:00:00.000Z",
    payload: { id: 1, topic: "orders/create" },
    schema_version: 1,
    ...overrides,
  };
}

describe("FileBronzeStorage", () => {
  let basePath = "";

  afterEach(async () => {
    basePath = "";
  });

  async function createStorage() {
    basePath = await mkdtemp(path.join(tmpdir(), "morgan-bronze-"));
    return new FileBronzeStorage(basePath);
  }

  it("writes supported events to bronze/{source}/{store_id}/{date}/{event_id}.json", async () => {
    const storage = await createStorage();
    const event = sampleEvent();
    const result = await storage.write(event);

    expect(result.status).toBe("stored");
    expect(result.key).toBe(`shopify/${STORE_ID}/2026-06-17/${event.event_id}.json`);

    const filePath = path.join(basePath, ...result.key.split("/"));
    const saved = JSON.parse(await readFile(filePath, "utf8"));
    expect(saved.event_id).toBe(event.event_id);
  });

  it("routes unsupported schema versions to quarantine prefix", async () => {
    const storage = await createStorage();
    const event = sampleEvent({ schema_version: 99 });
    const result = await storage.write(event);

    expect(result.status).toBe("quarantined");
    expect(result.key).toContain("quarantine/99/shopify/");
  });

  it("lists and reads events by store and date range", async () => {
    const storage = await createStorage();
    await storage.write(sampleEvent({ event_id: "550e8400-e29b-41d4-a716-446655440010" }));
    await storage.write(
      sampleEvent({
        event_id: "550e8400-e29b-41d4-a716-446655440011",
        occurred_at: "2026-06-18T12:00:00.000Z",
      }),
    );

    const refs = await storage.list({
      source: "shopify",
      store_id: STORE_ID,
      start_date: "2026-06-17",
      end_date: "2026-06-18",
    });

    expect(refs).toHaveLength(2);
    const event = await storage.read(refs[0]!.key);
    expect(event.event_id).toBe(refs[0]!.event_id);
  });
});

describe("EventPipeline bronze quarantine", () => {
  it("does not publish quarantined events to Kafka", async () => {
    const basePath = await mkdtemp(path.join(tmpdir(), "morgan-bronze-"));
    const bronze = new FileBronzeStorage(basePath);
    const publisher = new InMemoryEventPublisher();
    const pipeline = new EventPipeline(publisher, bronze);
    let published = 0;
    publisher.subscribe("shopify.orders", async () => {
      published += 1;
    });

    await pipeline.ingest("shopify.orders", sampleEvent({ schema_version: 99 }));
    expect(published).toBe(0);
  });
});

describe("replayBronzeEvents", () => {
  it("re-publishes bronze events for a store and date range", async () => {
    const basePath = await mkdtemp(path.join(tmpdir(), "morgan-bronze-"));
    const bronze = new FileBronzeStorage(basePath);
    const publisher = new InMemoryEventPublisher();
    const event = sampleEvent();
    await bronze.write(event);

    const published: string[] = [];
    publisher.subscribe("shopify.orders", async (envelope) => {
      published.push(envelope.event_id);
    });

    const result = await replayBronzeEvents({
      bronze,
      publisher,
      source: "shopify",
      store_id: STORE_ID,
      start_date: "2026-06-17",
      end_date: "2026-06-17",
    });

    expect(result.listed).toBe(1);
    expect(result.published).toBe(1);
    expect(published).toEqual([event.event_id]);
  });
});

describe("resolveKafkaTopicForEvent", () => {
  it("maps shopify order webhooks to shopify.orders", () => {
    expect(resolveKafkaTopicForEvent(sampleEvent())).toBe("shopify.orders");
  });

  it("maps morgan metrics events to metrics.recalculate", () => {
    expect(
      resolveKafkaTopicForEvent(
        sampleEvent({
          source: "morgan",
          event_type: "metrics.recalculate_requested",
          payload: {},
        }),
      ),
    ).toBe("metrics.recalculate");
  });
});
