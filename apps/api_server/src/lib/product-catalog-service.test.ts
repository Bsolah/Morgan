import { describe, expect, it } from "vitest";
import { formatCatalogSyncLabel } from "./product-catalog-service.js";

describe("formatCatalogSyncLabel", () => {
  it("formats in-progress product sync copy", () => {
    expect(formatCatalogSyncLabel(240, "syncing")).toBe("Syncing products… 240");
  });

  it("formats completed copy", () => {
    expect(formatCatalogSyncLabel(500, "completed")).toBe("Product catalog synced");
  });
});
