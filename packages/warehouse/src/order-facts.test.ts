import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "@morgan/shared";
import { toOrderFactRow } from "./order-facts.js";

describe("toOrderFactRow", () => {
  it("maps envelope fields for ClickHouse upsert", () => {
    const event: EventEnvelope = {
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      event_type: "orders.create",
      store_id: "00000000-0000-4000-8000-000000000002",
      source: "shopify",
      occurred_at: "2026-06-17T10:00:00.000Z",
      payload: {
        shop_domain: "demo.myshopify.com",
        id: 42,
        total_price: "99.00",
      },
      schema_version: 1,
    };

    const row = toOrderFactRow(event);
    expect(row.event_id).toBe(event.event_id);
    expect(row.store_id).toBe(event.store_id);
    expect(row.order_id).toBe("42");
    expect(row.shop_domain).toBe("demo.myshopify.com");
  });
});
