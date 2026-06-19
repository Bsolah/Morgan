import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { OrderFactRow } from "@morgan/warehouse";

export async function readOrderFactsForStore(
  basePath: string,
  storeId: string,
  sinceDay: string,
  untilDay: string,
): Promise<OrderFactRow[]> {
  const dir = path.join(basePath, "shopify_orders", storeId);
  let files: string[];

  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const jsonlFiles = files.filter((file) => file.endsWith(".jsonl")).sort();
  const rows: OrderFactRow[] = [];

  for (const file of jsonlFiles) {
    const day = file.replace(".jsonl", "");
    if (day < sinceDay || day > untilDay) continue;

    const content = await readFile(path.join(dir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as OrderFactRow);
      } catch {
        // Skip malformed lines.
      }
    }
  }

  return rows;
}

export function parseOrderPayload(row: OrderFactRow): Record<string, unknown> {
  try {
    return JSON.parse(row.payload_json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
