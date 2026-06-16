import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EventEnvelope } from "@morgan/shared";

export interface EventPublisher {
  publish(topic: string, event: EventEnvelope): Promise<void>;
}

export interface BronzeStorage {
  write(event: EventEnvelope): Promise<void>;
}

export class FileBronzeStorage implements BronzeStorage {
  constructor(private readonly basePath: string) {}

  async write(event: EventEnvelope): Promise<void> {
    const date = event.occurred_at.slice(0, 10);
    const dir = path.join(this.basePath, event.source, event.store_id, date);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${event.event_id}.json`), JSON.stringify(event, null, 2), "utf8");
  }
}

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: Array<{ topic: string; event: EventEnvelope }> = [];

  async publish(topic: string, event: EventEnvelope): Promise<void> {
    this.events.push({ topic, event });
  }
}

export class EventPipeline {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly bronze: BronzeStorage,
  ) {}

  async ingest(topic: string, event: EventEnvelope): Promise<void> {
    await this.bronze.write(event);
    await this.publisher.publish(topic, event);
  }
}
