import { createMartCashDailyWriter, type MartCashDailyWriter } from "@morgan/warehouse";
import { env } from "../config.js";

let writer: MartCashDailyWriter | null = null;
let initPromise: Promise<MartCashDailyWriter> | null = null;

export async function getCashDailyWriter(): Promise<MartCashDailyWriter> {
  if (writer) return writer;
  if (!initPromise) {
    initPromise = createMartCashDailyWriter({
      clickhouseUrl: env.CLICKHOUSE_URL,
      fallbackPath: env.CLICKHOUSE_STORAGE_PATH,
      table: env.CLICKHOUSE_CASH_DAILY_TABLE,
    }).then((created) => {
      writer = created;
      return created;
    });
  }
  return initPromise;
}

export function resetCashDailyWriterForTests(): void {
  writer = null;
  initPromise = null;
}

export async function closeCashDailyWriter(): Promise<void> {
  if (writer) {
    await writer.close?.();
    writer = null;
    initPromise = null;
  }
}
