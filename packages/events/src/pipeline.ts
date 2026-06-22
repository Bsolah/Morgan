import type { EventEnvelope } from "@morgan/shared";
import {
  DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
  EventProcessingMetrics,
  processEventIdempotently,
} from "./event-processing.js";
import type {
  BronzeStorage,
  DeadLetterStorage,
  EventPublisher,
  IdempotencyStore,
  OrderProcessor,
} from "./types.js";

export class EventPipeline {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly bronze: BronzeStorage,
  ) {}

  async ingest(topic: string, event: EventEnvelope): Promise<void> {
    const result = await this.bronze.write(event);
    if (result.status === "quarantined") {
      return;
    }
    await this.publisher.publish(topic, event);
  }
}

export type OrderIngestWorkerOptions = {
  idempotency: IdempotencyStore;
  metrics: EventProcessingMetrics;
  idempotencyTtlSeconds?: number;
};

export class OrderIngestWorker {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly processor: OrderProcessor,
    private readonly deadLetter: DeadLetterStorage,
    private readonly topic: string,
    private readonly options: OrderIngestWorkerOptions,
  ) {}

  start(): void {
    this.publisher.subscribe?.(this.topic, async (event) => {
      await this.handle(event);
    });
  }

  async handle(event: EventEnvelope) {
    return processEventIdempotently({
      topic: this.topic,
      event,
      idempotency: this.options.idempotency,
      metrics: this.options.metrics,
      processor: this.processor,
      deadLetter: this.deadLetter,
      idempotencyTtlSeconds:
        this.options.idempotencyTtlSeconds ?? DEFAULT_EVENT_PROCESSING_TTL_SECONDS,
    });
  }
}

export type { OrderProcessor };
