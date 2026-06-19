import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { FileCatalogWriter, type InventoryLevelRow } from "@morgan/warehouse";

export async function loadUnitCostBySku(
  bronzeStoragePath: string,
  storeId: string,
): Promise<Map<string, number>> {
  const writer = new FileCatalogWriter(bronzeStoragePath);
  const index = await writer.loadProductIndex(storeId);
  const map = new Map<string, number>();

  for (const row of index.values()) {
    if (!row.sku || row.unit_cost == null) continue;
    const cost = Number(row.unit_cost);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    map.set(row.sku, cost);
  }

  return map;
}

export async function loadAvailableUnitsBySku(
  bronzeStoragePath: string,
  storeId: string,
): Promise<Map<string, number>> {
  const writer = new FileCatalogWriter(bronzeStoragePath);
  const productIndex = await writer.loadProductIndex(storeId);
  const variantToSku = new Map<string, string>();

  for (const row of productIndex.values()) {
    if (!row.sku) continue;
    variantToSku.set(row.variant_id, row.sku);
  }

  const latestByVariant = await loadLatestInventoryByVariant(bronzeStoragePath, storeId);
  const bySku = new Map<string, number>();

  for (const [variantId, available] of latestByVariant) {
    const sku = variantToSku.get(variantId);
    if (!sku) continue;
    bySku.set(sku, (bySku.get(sku) ?? 0) + available);
  }

  return bySku;
}

async function loadLatestInventoryByVariant(
  bronzeStoragePath: string,
  storeId: string,
): Promise<Map<string, number>> {
  const storeDir = path.join(bronzeStoragePath, "inventory_levels", storeId);
  const latestByVariant = new Map<string, { available: number; updatedAt: string }>();

  let locationDirs: string[] = [];
  try {
    locationDirs = await readdir(storeDir);
  } catch {
    return new Map();
  }

  for (const locationId of locationDirs) {
    const locationPath = path.join(storeDir, locationId);
    let files: string[] = [];
    try {
      files = (await readdir(locationPath)).filter((file) => file.endsWith(".jsonl"));
    } catch {
      continue;
    }

    files.sort();

    for (const file of files) {
      const raw = await readFile(path.join(locationPath, file), "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const row = JSON.parse(line) as InventoryLevelRow;
        const existing = latestByVariant.get(row.variant_id);
        if (!existing || row.updated_at >= existing.updatedAt) {
          latestByVariant.set(row.variant_id, {
            available: Number(row.available ?? 0),
            updatedAt: row.updated_at,
          });
        }
      }
    }
  }

  return new Map(
    [...latestByVariant.entries()].map(([variantId, value]) => [variantId, value.available]),
  );
}

export async function loadSkuTitlesBySku(
  bronzeStoragePath: string,
  storeId: string,
): Promise<Map<string, string>> {
  const writer = new FileCatalogWriter(bronzeStoragePath);
  const index = await writer.loadProductIndex(storeId);
  const map = new Map<string, string>();

  for (const row of index.values()) {
    if (!row.sku || !row.title) continue;
    if (!map.has(row.sku)) {
      map.set(row.sku, row.title);
    }
  }

  return map;
}
