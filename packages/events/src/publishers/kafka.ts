import type { EventEnvelope } from "@morgan/shared";
import type { EventPublisher } from "../types.js";
import { InMemoryEventPublisher } from "./in-memory.js";

type KafkaProducer = {
  connect(): Promise<void>;
  send(input: {
    topic: string;
    messages: Array<{ key: string; value: string }>;
  }): Promise<unknown>;
  disconnect(): Promise<void>;
};

type KafkaModule = {
  Kafka: new (config: { clientId: string; brokers: string[] }) => {
    producer(): KafkaProducer;
  };
};

export class KafkaEventPublisher implements EventPublisher {
  private producer: KafkaProducer | null = null;
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly kafka: KafkaModule,
    private readonly brokers: string[],
    private readonly clientId: string,
  ) {}

  private async getProducer(): Promise<KafkaProducer> {
    if (this.producer) return this.producer;
    if (!this.connecting) {
      this.connecting = (async () => {
        const producer = new this.kafka.Kafka({
          clientId: this.clientId,
          brokers: this.brokers,
        }).producer();
        await producer.connect();
        this.producer = producer;
      })();
    }
    await this.connecting;
    return this.producer!;
  }

  async publish(topic: string, event: EventEnvelope): Promise<void> {
    const producer = await this.getProducer();
    await producer.send({
      topic,
      messages: [{ key: event.store_id, value: JSON.stringify(event) }],
    });
  }

  async close(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      this.connecting = null;
    }
  }
}

export class CompositeEventPublisher implements EventPublisher {
  constructor(private readonly publishers: EventPublisher[]) {}

  async publish(topic: string, event: EventEnvelope): Promise<void> {
    await Promise.all(this.publishers.map((publisher) => publisher.publish(topic, event)));
  }

  subscribe(topic: string, handler: (event: EventEnvelope) => Promise<void>): void {
    for (const publisher of this.publishers) {
      publisher.subscribe?.(topic, handler);
    }
  }

  async close(): Promise<void> {
    await Promise.all(this.publishers.map((publisher) => publisher.close?.()));
  }
}

export async function createKafkaPublisher(
  brokers: string[],
  clientId: string,
  fallback: InMemoryEventPublisher,
): Promise<EventPublisher> {
  try {
    const kafkaModule = (await import("kafkajs")) as KafkaModule;
    return new CompositeEventPublisher([
      new KafkaEventPublisher(kafkaModule, brokers, clientId),
      fallback,
    ]);
  } catch {
    return fallback;
  }
}
