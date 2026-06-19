import { iterateDatesInclusive } from "./bronze-paths.js";
import { parseEventEnvelope, type EventEnvelope } from "@morgan/shared";
import { SchemaRoutingBronzeWriter } from "./schema-bronze.js";
import type { BronzeListQuery, BronzeObjectRef, BronzeStorage } from "./types.js";

type S3ClientLike = {
  send(command: unknown): Promise<unknown>;
};

type PutObjectCommandLike = new (input: {
  Bucket: string;
  Key: string;
  Body: string;
  ContentType: string;
}) => unknown;

type GetObjectCommandLike = new (input: { Bucket: string; Key: string }) => unknown;

type ListObjectsV2CommandLike = new (input: {
  Bucket: string;
  Prefix: string;
  ContinuationToken?: string;
}) => unknown;

type S3Module = {
  S3Client: new (config: { region?: string }) => S3ClientLike;
  PutObjectCommand: PutObjectCommandLike;
  GetObjectCommand: GetObjectCommandLike;
  ListObjectsV2Command: ListObjectsV2CommandLike;
};

async function streamToString(body: unknown): Promise<string> {
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && "transformToString" in body) {
    return (body as { transformToString(): Promise<string> }).transformToString();
  }
  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("Unsupported S3 object body");
}

export class S3BronzeStorage implements BronzeStorage {
  private readonly router: SchemaRoutingBronzeWriter;
  private readonly client: S3ClientLike;

  constructor(
    private readonly s3: S3Module,
    private readonly bucket: string,
    region?: string,
  ) {
    this.client = new s3.S3Client({ region });
    this.router = new SchemaRoutingBronzeWriter({
      putObject: async (key, body) => {
        await this.client.send(
          new this.s3.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: "application/json",
          }),
        );
      },
    });
  }

  write(event: EventEnvelope) {
    return this.router.write(event);
  }

  async list(query: BronzeListQuery): Promise<BronzeObjectRef[]> {
    const refs: BronzeObjectRef[] = [];

    for (const date of iterateDatesInclusive(query.start_date, query.end_date)) {
      const prefix = `${query.source}/${query.store_id}/${date}/`;
      refs.push(...(await this.listPrefix(prefix, query.source, query.store_id, date, false)));

      if (query.include_quarantine) {
        const quarantinePrefix = `quarantine/`;
        const quarantineObjects = await this.listAllKeys(quarantinePrefix);
        const schemaVersions = new Set<number>();
        for (const key of quarantineObjects) {
          const match = /^quarantine\/(\d+)\//.exec(key);
          if (match) schemaVersions.add(Number(match[1]));
        }

        for (const schemaVersion of schemaVersions) {
          const qPrefix = `quarantine/${schemaVersion}/${query.source}/${query.store_id}/${date}/`;
          refs.push(
            ...(await this.listPrefix(qPrefix, query.source, query.store_id, date, true, schemaVersion)),
          );
        }
      }
    }

    return refs.sort((a, b) => `${a.date}:${a.event_id}`.localeCompare(`${b.date}:${b.event_id}`));
  }

  async read(key: string): Promise<EventEnvelope> {
    const response = (await this.client.send(
      new this.s3.GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )) as { Body?: unknown };

    const raw = JSON.parse(await streamToString(response.Body)) as unknown;
    if (key.startsWith("quarantine/0/")) {
      throw new Error(`Cannot replay invalid quarantined envelope at ${key}`);
    }
    return parseEventEnvelope(raw);
  }

  private async listPrefix(
    prefix: string,
    source: string,
    storeId: string,
    date: string,
    quarantined: boolean,
    schemaVersion?: number,
  ): Promise<BronzeObjectRef[]> {
    const keys = await this.listAllKeys(prefix);
    return keys
      .filter((key) => key.endsWith(".json"))
      .map((key) => {
        const eventId = key.slice(prefix.length).replace(/\.json$/, "");
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

  private async listAllKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = (await this.client.send(
        new this.s3.ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )) as { Contents?: Array<{ Key?: string }>; IsTruncated?: boolean; NextContinuationToken?: string };

      for (const item of response.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }
}

export async function createS3BronzeStorage(
  bucket: string,
  region?: string,
): Promise<S3BronzeStorage> {
  const s3Module = (await import("@aws-sdk/client-s3")) as S3Module;
  return new S3BronzeStorage(s3Module, bucket, region);
}
