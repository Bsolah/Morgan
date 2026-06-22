import type { EventEnvelope } from "@morgan/shared";
import type { DeadLetterStorage, IdempotencyStore, OrderProcessor } from "./types.js";
import { withRetries } from "./types.js";

export const DEFAULT_EVENT_PROCESSING_TTL_SECONDS = 86_400;
export const EVENT_PROCESSING_CLAIM_PREFIX = "event-process:";

export function eventProcessingClaimKey(eventId: string): string {
  return `${EVENT_PROCESSING_CLAIM_PREFIX}${eventId}`;
}

export async function claimEventForProcessing(
  store: IdempotencyStore,
  eventId: string,
  ttlSeconds = DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
): Promise<boolean> {
  return store.claim(eventProcessingClaimKey(eventId), ttlSeconds);
}

export type TopicProcessingMetricsSnapshot = {
  topic: string;
  received: number;
  processed: number;
  duplicates: number;
  errors: number;
  duplicate_rate: number;
  error_rate: number;
  avg_processing_lag_ms: number;
  last_processed_at: string | null;
};

type TopicCounters = {
  received: number;
  processed: number;
  duplicates: number;
  errors: number;
  lagTotalMs: number;
  lagSamples: number;
  lastProcessedAt: string | null;
};

export class EventProcessingMetrics {
  private readonly topics = new Map<string, TopicCounters>();

  private counters(topic: string): TopicCounters {
    const existing = this.topics.get(topic);
    if (existing) return existing;

    const created: TopicCounters = {
      received: 0,
      processed: 0,
      duplicates: 0,
      errors: 0,
      lagTotalMs: 0,
      lagSamples: 0,
      lastProcessedAt: null,
    };
    this.topics.set(topic, created);
    return created;
  }

  recordReceived(topic: string): void {
    this.counters(topic).received += 1;
  }

  recordDuplicate(topic: string): void {
    this.counters(topic).duplicates += 1;
  }

  recordProcessed(topic: string, processingLagMs: number): void {
    const row = this.counters(topic);
    row.processed += 1;
    row.lagTotalMs += processingLagMs;
    row.lagSamples += 1;
    row.lastProcessedAt = new Date().toISOString();
  }

  recordError(topic: string): void {
    this.counters(topic).errors += 1;
  }

  snapshot(): { updated_at: string; topics: TopicProcessingMetricsSnapshot[] } {
    const topics = [...this.topics.entries()]
      .map(([topic, row]) => {
        const attempts = row.processed + row.errors;
        return {
          topic,
          received: row.received,
          processed: row.processed,
          duplicates: row.duplicates,
          errors: row.errors,
          duplicate_rate: row.received > 0 ? row.duplicates / row.received : 0,
          error_rate: attempts > 0 ? row.errors / attempts : 0,
          avg_processing_lag_ms:
            row.lagSamples > 0 ? Math.round(row.lagTotalMs / row.lagSamples) : 0,
          last_processed_at: row.lastProcessedAt,
        };
      })
      .sort((left, right) => left.topic.localeCompare(right.topic));

    return {
      updated_at: new Date().toISOString(),
      topics,
    };
  }

  clear(): void {
    this.topics.clear();
  }
}

export type EventProcessingOutcome = "processed" | "duplicate" | "error";

export function computeProcessingLagMs(event: EventEnvelope, processedAt = Date.now()): number {
  const occurredAt = Date.parse(event.occurred_at);
  if (!Number.isFinite(occurredAt)) return 0;
  return Math.max(0, processedAt - occurredAt);
}

export async function processEventIdempotently(input: {
  topic: string;
  event: EventEnvelope;
  idempotency: IdempotencyStore;
  metrics: EventProcessingMetrics;
  processor: OrderProcessor;
  deadLetter: DeadLetterStorage;
  idempotencyTtlSeconds?: number;
}): Promise<EventProcessingOutcome> {
  input.metrics.recordReceived(input.topic);

  const claimed = await claimEventForProcessing(
    input.idempotency,
    input.event.event_id,
    input.idempotencyTtlSeconds ?? DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
  );
  if (!claimed) {
    input.metrics.recordDuplicate(input.topic);
    return "duplicate";
  }

  try {
    await withRetries(() => input.processor(input.event), { maxAttempts: 3, baseDelayMs: 250 });
    input.metrics.recordProcessed(input.topic, computeProcessingLagMs(input.event));
    return "processed";
  } catch (error) {
    input.metrics.recordError(input.topic);
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await input.deadLetter.write(input.topic, input.event, message, 3);
    return "error";
  }
}
