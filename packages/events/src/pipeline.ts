import type { EventEnvelope } from "@morgan/shared";
import type { BronzeStorage, DeadLetterStorage, EventPublisher } from "./types.js";
import { withRetries } from "./types.js";

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

export type OrderProcessor = (event: EventEnvelope) => Promise<void>;

export class OrderIngestWorker {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly processor: OrderProcessor,
    private readonly deadLetter: DeadLetterStorage,
    private readonly topic: string,
  ) {}

  start(): void {
    this.publisher.subscribe?.(this.topic, async (event) => {
      await this.handle(event);
    });
  }

  async handle(event: EventEnvelope): Promise<void> {
    try {
      await withRetries(() => this.processor(event), { maxAttempts: 3, baseDelayMs: 250 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await this.deadLetter.write(this.topic, event, message, 3);
    }
  }
}
