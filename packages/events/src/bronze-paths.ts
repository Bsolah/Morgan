import type { EventEnvelope } from "@morgan/shared";

export function bronzeDateFromEvent(event: EventEnvelope): string {
  return event.occurred_at.slice(0, 10);
}

/** s3://bronze/{source}/{store_id}/{date}/{event_id}.json */
export function bronzeObjectKey(
  source: string,
  storeId: string,
  date: string,
  eventId: string,
): string {
  return `${source}/${storeId}/${date}/${eventId}.json`;
}

/** s3://bronze/quarantine/{schema_version}/{source}/{store_id}/{date}/{event_id}.json */
export function quarantineObjectKey(
  schemaVersion: number,
  source: string,
  storeId: string,
  date: string,
  eventId: string,
): string {
  return `quarantine/${schemaVersion}/${source}/${storeId}/${date}/${eventId}.json`;
}

export function parseBronzeObjectKey(key: string): {
  source: string;
  store_id: string;
  date: string;
  event_id: string;
  quarantined: boolean;
  schema_version?: number;
} | null {
  const quarantineMatch = /^quarantine\/(\d+)\/([^/]+)\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/.exec(
    key,
  );
  if (quarantineMatch) {
    return {
      schema_version: Number(quarantineMatch[1]),
      source: quarantineMatch[2]!,
      store_id: quarantineMatch[3]!,
      date: quarantineMatch[4]!,
      event_id: quarantineMatch[5]!,
      quarantined: true,
    };
  }

  const bronzeMatch = /^([^/]+)\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/([^/]+)\.json$/.exec(key);
  if (!bronzeMatch) return null;

  return {
    source: bronzeMatch[1]!,
    store_id: bronzeMatch[2]!,
    date: bronzeMatch[3]!,
    event_id: bronzeMatch[4]!,
    quarantined: false,
  };
}

export function* iterateDatesInclusive(startDate: string, endDate: string): Generator<string> {
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    yield cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}
