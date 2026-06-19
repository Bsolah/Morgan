import type { Database } from "@morgan/db";
import { getDb } from "./db.js";
import { pollInventoryLevels, processProductCatalogSyncJobs } from "./product-catalog-service.js";
import { env } from "../config.js";

let catalogInterval: NodeJS.Timeout | null = null;
let inventoryInterval: NodeJS.Timeout | null = null;
let catalogRunning = false;
let inventoryRunning = false;

export function startProductCatalogRunner(): void {
  if (catalogInterval) return;

  const tickCatalog = async () => {
    if (catalogRunning) return;
    const db = getDb();
    if (!db) return;

    catalogRunning = true;
    try {
      await processProductCatalogSyncJobs(db);
    } finally {
      catalogRunning = false;
    }
  };

  const tickInventory = async () => {
    if (inventoryRunning) return;
    const db = getDb();
    if (!db) return;

    inventoryRunning = true;
    try {
      await pollInventoryLevels(db);
    } finally {
      inventoryRunning = false;
    }
  };

  void tickCatalog();
  void tickInventory();

  catalogInterval = setInterval(() => {
    void tickCatalog();
  }, 5_000);

  inventoryInterval = setInterval(() => {
    void tickInventory();
  }, env.INVENTORY_POLL_INTERVAL_MS);
}

export function stopProductCatalogRunner(): void {
  if (catalogInterval) {
    clearInterval(catalogInterval);
    catalogInterval = null;
  }
  if (inventoryInterval) {
    clearInterval(inventoryInterval);
    inventoryInterval = null;
  }
}

export async function runProductCatalogNow(db: Database): Promise<void> {
  await processProductCatalogSyncJobs(db);
}

export async function runInventoryPollNow(db: Database, storeId?: string): Promise<void> {
  await pollInventoryLevels(db, storeId);
}
