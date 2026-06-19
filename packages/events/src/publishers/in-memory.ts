import type { EventEnvelope } from "@morgan/shared";
import type { EventPublisher } from "./types.js";

type Subscriber = (event: EventEnvelope) => Promise<void>;

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: Array<{ topic: string; event: EventEnvelope }> = [];
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  async publish(topic: string, event: EventEnvelope): Promise<void> {
    this.events.push({ topic, event });

    const handlers = this.subscribers.get(topic);
    if (!handlers) return;

    await Promise.all(
      [...handlers].map(async (handler) => {
        try {
          await handler(event);
        } catch {
          // Worker handles retries/DLQ; publisher must not block webhook ack.
        }
      }),
    );
  }

  subscribe(topic: string, handler: Subscriber): void {
    const existing = this.subscribers.get(topic) ?? new Set<Subscriber>();
    existing.add(handler);
    this.subscribers.set(topic, existing);
  }

  clear(): void {
    this.events.length = 0;
    this.subscribers.clear();
  }
}
