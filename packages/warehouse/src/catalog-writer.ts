import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DimProductRow,
  InventoryLevelRow,
  OrderLineFactRow,
} from "./catalog-models.js";

type ClickHouseClient = {
  insert(params: { table: string; values: unknown[]; format: "JSONEachRow" }): Promise<unknown>;
  close(): Promise<void>;
};

async function appendJsonl(filePath: string, row: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

export class FileCatalogWriter {
  constructor(private readonly basePath: string) {}

  private productIndexPath(storeId: string): string {
    return path.join(this.basePath, "dim_products", storeId, "index.json");
  }

  async loadProductIndex(storeId: string): Promise<Map<string, DimProductRow>> {
    const indexPath = this.productIndexPath(storeId);
    try {
      const raw = await readFile(indexPath, "utf8");
      const rows = JSON.parse(raw) as DimProductRow[];
      const map = new Map<string, DimProductRow>();
      for (const row of rows) {
        map.set(`${row.store_id}:${row.variant_id}`, row);
        if (row.inventory_item_id) {
          map.set(`${row.store_id}:inv:${row.inventory_item_id}`, row);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private async persistProductIndex(storeId: string, index: Map<string, DimProductRow>): Promise<void> {
    const rows = [...index.values()];
    await mkdir(path.dirname(this.productIndexPath(storeId)), { recursive: true });
    await writeFile(this.productIndexPath(storeId), JSON.stringify(rows), "utf8");
  }

  async upsertProduct(row: DimProductRow): Promise<void> {
    const index = await this.loadProductIndex(row.store_id);
    index.set(`${row.store_id}:${row.variant_id}`, row);
    await this.persistProductIndex(row.store_id, index);
    await appendJsonl(
      path.join(this.basePath, "dim_products", row.store_id, `${row.updated_at.slice(0, 10)}.jsonl`),
      row,
    );
  }

  async deactivateProductVariants(
    storeId: string,
    productId: string,
    activeVariantIds: Set<string>,
    occurredAt: string,
  ): Promise<void> {
    const index = await this.loadProductIndex(storeId);
    for (const [key, row] of index) {
      if (row.product_id !== productId) continue;
      if (activeVariantIds.has(row.variant_id)) continue;
      const deactivated = { ...row, is_active: false, updated_at: occurredAt, ingested_at: new Date().toISOString() };
      index.set(key, deactivated);
      await appendJsonl(
        path.join(this.basePath, "dim_products", storeId, `${occurredAt.slice(0, 10)}.jsonl`),
        deactivated,
      );
    }
    await this.persistProductIndex(storeId, index);
  }

  async upsertInventoryLevel(row: InventoryLevelRow): Promise<void> {
    await appendJsonl(
      path.join(
        this.basePath,
        "inventory_levels",
        row.store_id,
        row.location_id,
        `${row.updated_at.slice(0, 10)}.jsonl`,
      ),
      row,
    );
  }

  async upsertOrderLine(row: OrderLineFactRow): Promise<void> {
    await appendJsonl(
      path.join(this.basePath, "fact_order_lines", row.store_id, `${row.ordered_at.slice(0, 10)}.jsonl`),
      row,
    );
  }
}

export class ClickHouseCatalogWriter {
  constructor(
    private readonly client: ClickHouseClient,
    private readonly tables: {
      dimProducts: string;
      inventoryLevels: string;
      factOrderLines: string;
    },
  ) {}

  async upsertProduct(row: DimProductRow): Promise<void> {
    await this.client.insert({ table: this.tables.dimProducts, values: [row], format: "JSONEachRow" });
  }

  async upsertInventoryLevel(row: InventoryLevelRow): Promise<void> {
    await this.client.insert({
      table: this.tables.inventoryLevels,
      values: [row],
      format: "JSONEachRow",
    });
  }

  async upsertOrderLine(row: OrderLineFactRow): Promise<void> {
    await this.client.insert({ table: this.tables.factOrderLines, values: [row], format: "JSONEachRow" });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export type CatalogWriter = {
  upsertProduct(row: DimProductRow): Promise<void>;
  deactivateProductVariants?(
    storeId: string,
    productId: string,
    activeVariantIds: Set<string>,
    occurredAt: string,
  ): Promise<void>;
  upsertInventoryLevel(row: InventoryLevelRow): Promise<void>;
  upsertOrderLine(row: OrderLineFactRow): Promise<void>;
  loadProductIndex?(storeId: string): Promise<Map<string, DimProductRow>>;
  close?(): Promise<void>;
};

export async function createCatalogWriter(options: {
  clickhouseUrl?: string;
  fallbackPath: string;
  tables?: {
    dimProducts?: string;
    inventoryLevels?: string;
    factOrderLines?: string;
  };
}): Promise<CatalogWriter> {
  const fileWriter = new FileCatalogWriter(options.fallbackPath);

  if (!options.clickhouseUrl) {
    return fileWriter;
  }

  try {
    const { createClient } = await import("@clickhouse/client");
    const client = createClient({ url: options.clickhouseUrl });
    const clickhouseWriter = new ClickHouseCatalogWriter(client as unknown as ClickHouseClient, {
      dimProducts: options.tables?.dimProducts ?? "dim_products",
      inventoryLevels: options.tables?.inventoryLevels ?? "inventory_levels",
      factOrderLines: options.tables?.factOrderLines ?? "fact_order_lines",
    });

    return {
      upsertProduct: async (row) => {
        await fileWriter.upsertProduct(row);
        await clickhouseWriter.upsertProduct(row);
      },
      deactivateProductVariants: fileWriter.deactivateProductVariants.bind(fileWriter),
      upsertInventoryLevel: async (row) => {
        await fileWriter.upsertInventoryLevel(row);
        await clickhouseWriter.upsertInventoryLevel(row);
      },
      upsertOrderLine: async (row) => {
        await fileWriter.upsertOrderLine(row);
        await clickhouseWriter.upsertOrderLine(row);
      },
      loadProductIndex: fileWriter.loadProductIndex.bind(fileWriter),
      close: async () => {
        await clickhouseWriter.close();
      },
    };
  } catch {
    return fileWriter;
  }
}
