import { describe, expect, it } from "vitest";
import { buildOrdersBackfillBulkQuery, parseBulkOrderRecords } from "./order-backfill.js";

describe("order backfill helpers", () => {
  it("builds a 90-day orders bulk query", () => {
    const query = buildOrdersBackfillBulkQuery("2026-03-19T00:00:00.000Z");
    expect(query).toContain('created_at:>=2026-03-19');
    expect(query).toContain("orders(");
  });

  it("parses JSONL from a cursor line", () => {
    const jsonl = [
      '{"id":"gid://shopify/Order/1","name":"#1001"}',
      '{"id":"gid://shopify/Order/2","name":"#1002"}',
      '{"id":"gid://shopify/Order/3","name":"#1003"}',
    ].join("\n");

    const firstBatch = parseBulkOrderRecords(jsonl, 0);
    expect(firstBatch.records).toHaveLength(3);

    const resumed = parseBulkOrderRecords(jsonl, 2);
    expect(resumed.records).toHaveLength(1);
    expect(resumed.records[0]?.name).toBe("#1003");
  });
});
