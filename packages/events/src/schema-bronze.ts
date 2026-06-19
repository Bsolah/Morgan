import { randomUUID } from "node:crypto";
import {
  eventEnvelopeSchema,
  isSupportedEventSchemaVersion,
  type EventEnvelope,
} from "@morgan/shared";
import {
  bronzeDateFromEvent,
  bronzeObjectKey,
  quarantineObjectKey,
} from "./bronze-paths.js";
import type { BronzeWriteResult } from "./types.js";

export type BronzeObjectWriter = {
  putObject(key: string, body: string): Promise<void>;
};

export class SchemaRoutingBronzeWriter {
  constructor(private readonly writer: BronzeObjectWriter) {}

  async write(event: EventEnvelope): Promise<BronzeWriteResult> {
    const parsed = eventEnvelopeSchema.safeParse(event);
    if (!parsed.success) {
      const fallbackId =
        typeof event === "object" && event !== null && "event_id" in event
          ? String((event as EventEnvelope).event_id)
          : randomUUID();
      const fallbackSource =
        typeof event === "object" && event !== null && "source" in event
          ? String((event as EventEnvelope).source)
          : "unknown";
      const fallbackStoreId =
        typeof event === "object" && event !== null && "store_id" in event
          ? String((event as EventEnvelope).store_id)
          : "unknown";
      const fallbackOccurredAt =
        typeof event === "object" && event !== null && "occurred_at" in event
          ? String((event as EventEnvelope).occurred_at)
          : new Date().toISOString();
      const date = fallbackOccurredAt.slice(0, 10);
      const key = quarantineObjectKey(0, fallbackSource, fallbackStoreId, date, fallbackId);
      await this.writer.putObject(
        key,
        JSON.stringify(
          {
            reason: "invalid_envelope",
            validation_errors: parsed.error.flatten(),
            raw: event,
          },
          null,
          2,
        ),
      );
      return { status: "quarantined", key, schema_version: 0, reason: "invalid_envelope" };
    }

    const envelope = parsed.data;
    const date = bronzeDateFromEvent(envelope);

    if (!isSupportedEventSchemaVersion(envelope.schema_version)) {
      const key = quarantineObjectKey(
        envelope.schema_version,
        envelope.source,
        envelope.store_id,
        date,
        envelope.event_id,
      );
      await this.writer.putObject(key, JSON.stringify(envelope, null, 2));
      return {
        status: "quarantined",
        key,
        schema_version: envelope.schema_version,
        reason: "unsupported_schema_version",
      };
    }

    const key = bronzeObjectKey(envelope.source, envelope.store_id, date, envelope.event_id);
    await this.writer.putObject(key, JSON.stringify(envelope, null, 2));
    return { status: "stored", key };
  }
}
