import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { EventEnvelope } from "@morgan/shared";

export type OrderFactRow = {
  event_id: string;
  store_id: string;
  event_type: string;
  occurred_at: string;
  shop_domain: string | null;
  order_id: string | null;
  payload_json: string;
  ingested_at: string;
};

export interface OrderFactWriter {
  upsert(event: EventEnvelope): Promise<void>;
  close?(): Promise<void>;
}

function extractOrderId(payload: Record<string, unknown>): string | null {
  const id = payload.id ?? payload.order_id;
  if (typeof id === "number" || typeof id === "string") return String(id);
  return null;
}

export function toOrderFactRow(event: EventEnvelope): OrderFactRow {
  const payload = event.payload as Record<string, unknown>;
  const shopDomain =
    typeof payload.shop_domain === "string"
      ? payload.shop_domain
      : typeof payload.shopDomain === "string"
        ? payload.shopDomain
        : null;

  return {
    event_id: event.event_id,
    store_id: event.store_id,
    event_type: event.event_type,
    occurred_at: event.occurred_at,
    shop_domain: shopDomain,
    order_id: extractOrderId(payload),
    payload_json: JSON.stringify(payload),
    ingested_at: new Date().toISOString(),
  };
}

export class FileOrderFactWriter implements OrderFactWriter {
  constructor(private readonly basePath: string) {}

  async upsert(event: EventEnvelope): Promise<void> {
    const row = toOrderFactRow(event);
    const dir = path.join(this.basePath, "shopify_orders", row.store_id);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${row.occurred_at.slice(0, 10)}.jsonl`);
    await appendFile(file, `${JSON.stringify(row)}\n`, "utf8");
  }
}

type ClickHouseClient = {
  insert(params: { table: string; values: OrderFactRow[]; format: "JSONEachRow" }): Promise<unknown>;
  close(): Promise<void>;
};

export class ClickHouseOrderFactWriter implements OrderFactWriter {
  constructor(
    private readonly client: ClickHouseClient,
    private readonly table: string,
  ) {}

  async upsert(event: EventEnvelope): Promise<void> {
    const row = toOrderFactRow(event);
    await this.client.insert({
      table: this.table,
      values: [row],
      format: "JSONEachRow",
    });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function createOrderFactWriter(options: {
  clickhouseUrl?: string;
  clickhouseTable?: string;
  fallbackPath: string;
}): Promise<OrderFactWriter> {
  if (!options.clickhouseUrl) {
    return new FileOrderFactWriter(options.fallbackPath);
  }

  try {
    const { createClient } = await import("@clickhouse/client");
    const client = createClient({ url: options.clickhouseUrl });
    return new ClickHouseOrderFactWriter(
      client as unknown as ClickHouseClient,
      options.clickhouseTable ?? "shopify_order_events",
    );
  } catch {
    return new FileOrderFactWriter(options.fallbackPath);
  }
}
