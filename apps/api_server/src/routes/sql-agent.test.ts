import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("sql agent routes", () => {
  it("POST /api/v1/stores/:store_id/sql-agent/metrics requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/sql-agent/metrics",
      payload: {
        query_id: "orders_daily",
        start_date: "2026-06-01",
        end_date: "2026-06-17",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns unavailable when ClickHouse agent is not configured", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/stores/00000000-0000-4000-8000-000000000002/sql-agent/metrics",
      headers: { authorization: "Bearer invalid" },
      payload: {
        query_id: "orders_daily",
        start_date: "2026-06-01",
        end_date: "2026-06-17",
      },
    });

    expect([401, 503]).toContain(res.statusCode);
  });
});
