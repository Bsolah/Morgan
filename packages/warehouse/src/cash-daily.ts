import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type MartCashDailyRow = {
  store_id: string;
  day: string;
  balance: string;
  currency: string;
  expected_inflows: string;
  expected_inflow_count: number;
  shopify_payments_available: boolean;
  bank_balance?: string | null;
  bank_available_balance?: string | null;
  plaid_connected?: boolean;
  runway_days?: number | null;
  ingested_at: string;
};

export interface MartCashDailyWriter {
  upsert(row: MartCashDailyRow): Promise<void>;
  close?(): Promise<void>;
}

export class FileMartCashDailyWriter implements MartCashDailyWriter {
  constructor(private readonly basePath: string) {}

  async upsert(row: MartCashDailyRow): Promise<void> {
    const dir = path.join(this.basePath, "mart_cash_daily", row.store_id);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${row.day}.jsonl`);
    await appendFile(file, `${JSON.stringify(row)}\n`, "utf8");
  }
}

type ClickHouseClient = {
  insert(params: { table: string; values: MartCashDailyRow[]; format: "JSONEachRow" }): Promise<unknown>;
  close(): Promise<void>;
};

export class ClickHouseMartCashDailyWriter implements MartCashDailyWriter {
  constructor(
    private readonly client: ClickHouseClient,
    private readonly table: string,
  ) {}

  async upsert(row: MartCashDailyRow): Promise<void> {
    await this.client.insert({ table: this.table, values: [row], format: "JSONEachRow" });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function createMartCashDailyWriter(options: {
  clickhouseUrl?: string;
  fallbackPath: string;
  table?: string;
}): Promise<MartCashDailyWriter> {
  const fileWriter = new FileMartCashDailyWriter(options.fallbackPath);

  if (!options.clickhouseUrl) {
    return fileWriter;
  }

  try {
    const { createClient } = await import("@clickhouse/client");
    const client = createClient({ url: options.clickhouseUrl });
    const clickhouseWriter = new ClickHouseMartCashDailyWriter(
      client as unknown as ClickHouseClient,
      options.table ?? "mart_cash_daily",
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
