import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type MartAdPerformanceRow = {
  store_id: string;
  channel: string;
  campaign_id: string;
  campaign_name: string;
  day: string;
  ad_spend: string;
  attributed_revenue: string;
  attributed_contribution_margin: string;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: string;
  roas: string | null;
  poas: string | null;
  ingested_at: string;
};

export interface MartAdPerformanceWriter {
  upsert(row: MartAdPerformanceRow): Promise<void>;
  close?(): Promise<void>;
}

export class FileMartAdPerformanceWriter implements MartAdPerformanceWriter {
  constructor(private readonly basePath: string) {}

  async upsert(row: MartAdPerformanceRow): Promise<void> {
    const dir = path.join(this.basePath, "mart_ad_performance", row.store_id);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${row.day}.jsonl`);
    await appendFile(file, `${JSON.stringify(row)}\n`, "utf8");
  }
}

type ClickHouseClient = {
  insert(params: {
    table: string;
    values: MartAdPerformanceRow[];
    format: "JSONEachRow";
  }): Promise<unknown>;
  close(): Promise<void>;
};

export class ClickHouseMartAdPerformanceWriter implements MartAdPerformanceWriter {
  constructor(
    private readonly client: ClickHouseClient,
    private readonly table: string,
  ) {}

  async upsert(row: MartAdPerformanceRow): Promise<void> {
    await this.client.insert({ table: this.table, values: [row], format: "JSONEachRow" });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function createMartAdPerformanceWriter(options: {
  clickhouseUrl?: string;
  fallbackPath: string;
  table?: string;
}): Promise<MartAdPerformanceWriter> {
  const fileWriter = new FileMartAdPerformanceWriter(options.fallbackPath);

  if (!options.clickhouseUrl) {
    return fileWriter;
  }

  try {
    const { createClient } = await import("@clickhouse/client");
    const client = createClient({ url: options.clickhouseUrl });
    const clickhouseWriter = new ClickHouseMartAdPerformanceWriter(
      client as unknown as ClickHouseClient,
      options.table ?? "mart_ad_performance",
    );

    return {
      upsert: async (row) => {
        await fileWriter.upsert(row);
        await clickhouseWriter.upsert(row);
      },
      close: async () => {
        await clickhouseWriter.close();
      },
    };
  } catch {
    return fileWriter;
  }
}
