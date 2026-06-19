import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEventEnvelope, type EventEnvelope } from "@morgan/shared";
import {
  bronzeObjectKey,
  iterateDatesInclusive,
  parseBronzeObjectKey,
  quarantineObjectKey,
} from "./bronze-paths.js";
import { SchemaRoutingBronzeWriter } from "./schema-bronze.js";
import type { BronzeListQuery, BronzeObjectRef, BronzeStorage, DeadLetterStorage } from "./types.js";

export class FileBronzeStorage implements BronzeStorage {
  private readonly router: SchemaRoutingBronzeWriter;

  constructor(private readonly basePath: string) {
    this.router = new SchemaRoutingBronzeWriter({
      putObject: async (key, body) => {
        const filePath = path.join(this.basePath, ...key.split("/"));
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, body, "utf8");
      },
    });
  }

  write(event: EventEnvelope) {
    return this.router.write(event);
  }

  async list(query: BronzeListQuery): Promise<BronzeObjectRef[]> {
    const refs: BronzeObjectRef[] = [];

    for (const date of iterateDatesInclusive(query.start_date, query.end_date)) {
      const bronzeDir = path.join(this.basePath, query.source, query.store_id, date);
      refs.push(...(await this.listDirectory(bronzeDir, query.source, query.store_id, date, false)));

      if (query.include_quarantine) {
        const quarantineRoot = path.join(this.basePath, "quarantine");
        let schemaVersions: string[] = [];
        try {
          schemaVersions = await readdir(quarantineRoot);
        } catch {
          continue;
        }

        for (const schemaVersion of schemaVersions) {
          const quarantineDir = path.join(quarantineRoot, schemaVersion, query.source, query.store_id, date);
          refs.push(
            ...(await this.listDirectory(
              quarantineDir,
              query.source,
              query.store_id,
              date,
              true,
              Number(schemaVersion),
            )),
          );
        }
      }
    }

    return refs.sort((a, b) => `${a.date}:${a.event_id}`.localeCompare(`${b.date}:${b.event_id}`));
  }

  async read(key: string): Promise<EventEnvelope> {
    const filePath = path.join(this.basePath, ...key.split("/"));
    const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const parsed = parseBronzeObjectKey(key);

    if (parsed?.quarantined && parsed.schema_version === 0) {
      throw new Error(`Cannot replay invalid quarantined envelope at ${key}`);
    }

    return parseEventEnvelope(raw);
  }

  private async listDirectory(
    dir: string,
    source: string,
    storeId: string,
    date: string,
    quarantined: boolean,
    schemaVersion?: number,
  ): Promise<BronzeObjectRef[]> {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const eventId = file.replace(/\.json$/, "");
        const key = quarantined
          ? quarantineObjectKey(schemaVersion ?? 0, source, storeId, date, eventId)
          : bronzeObjectKey(source, storeId, date, eventId);
        return {
          key,
          source,
          store_id: storeId,
          date,
          event_id: eventId,
          quarantined,
          schema_version: schemaVersion,
        };
      });
  }
}

export class FileDeadLetterStorage implements DeadLetterStorage {
  constructor(private readonly basePath: string) {}

  async write(topic: string, event: EventEnvelope, error: string, attempts: number): Promise<void> {
    const date = event.occurred_at.slice(0, 10);
    const dir = path.join(this.basePath, "dead-letter", topic, event.store_id, date);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${event.event_id}.json`),
      JSON.stringify(
        {
          topic,
          event,
          error,
          attempts,
          dead_lettered_at: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
}
