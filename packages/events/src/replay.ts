import type { EventEnvelope } from "@morgan/shared";
import { resolveKafkaTopicForEvent } from "./topic-resolver.js";
import type { BronzeListQuery, BronzeStorage, EventPublisher } from "./types.js";

export type ReplayBronzeEventsOptions = {
  bronze: BronzeStorage;
  publisher: EventPublisher;
  source: string;
  store_id: string;
  start_date: string;
  end_date: string;
  topic?: string;
  dry_run?: boolean;
  onProgress?: (info: { key: string; topic: string; event_id: string }) => void;
};

export type ReplayBronzeEventsResult = {
  listed: number;
  published: number;
  skipped_quarantine: number;
  errors: Array<{ key: string; error: string }>;
};

export async function replayBronzeEvents(
  options: ReplayBronzeEventsOptions,
): Promise<ReplayBronzeEventsResult> {
  const query: BronzeListQuery = {
    source: options.source,
    store_id: options.store_id,
    start_date: options.start_date,
    end_date: options.end_date,
    include_quarantine: false,
  };

  const refs = await options.bronze.list(query);
  const result: ReplayBronzeEventsResult = {
    listed: refs.length,
    published: 0,
    skipped_quarantine: 0,
    errors: [],
  };

  for (const ref of refs) {
    if (ref.quarantined) {
      result.skipped_quarantine += 1;
      continue;
    }

    try {
      const event: EventEnvelope = await options.bronze.read(ref.key);
      const topic = options.topic ?? resolveKafkaTopicForEvent(event);
      options.onProgress?.({ key: ref.key, topic, event_id: event.event_id });

      if (!options.dry_run) {
        await options.publisher.publish(topic, event);
      }
      result.published += 1;
    } catch (error) {
      result.errors.push({
        key: ref.key,
        error: error instanceof Error ? error.message : "Unknown replay error",
      });
    }
  }

  return result;
}
