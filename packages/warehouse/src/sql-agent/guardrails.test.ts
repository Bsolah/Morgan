import { describe, expect, it } from "vitest";
import {
  assertDateRange,
  assertReadOnlySelect,
  assertStoreFilter,
  enforceRowLimit,
  SqlGuardrailError,
  validateAgentSql,
} from "./guardrails.js";
import { buildStandardMetricQuery } from "./standard-queries.js";
import { servingTableFqn } from "./types.js";

const STORE_ID = "00000000-0000-4000-8000-000000000002";

describe("assertReadOnlySelect", () => {
  it("allows select queries", () => {
    expect(() => assertReadOnlySelect("SELECT 1")).not.toThrow();
  });

  it("rejects mutating statements", () => {
    expect(() => assertReadOnlySelect("DELETE FROM mart_orders_daily")).toThrow(SqlGuardrailError);
    expect(() => assertReadOnlySelect("INSERT INTO t VALUES (1)")).toThrow(SqlGuardrailError);
  });

  it("rejects multiple statements", () => {
    expect(() => assertReadOnlySelect("SELECT 1; DROP TABLE t")).toThrow(SqlGuardrailError);
  });
});

describe("assertStoreFilter", () => {
  it("requires store_id filter matching authorized store", () => {
    const sql = `SELECT * FROM ${servingTableFqn("mart_orders_daily")} WHERE store_id = '${STORE_ID}'`;
    expect(() => assertStoreFilter(sql, STORE_ID)).not.toThrow();
  });

  it("rejects missing store filter", () => {
    const sql = `SELECT * FROM ${servingTableFqn("mart_orders_daily")}`;
    expect(() => assertStoreFilter(sql, STORE_ID)).toThrow(SqlGuardrailError);
  });
});

describe("assertDateRange", () => {
  it("allows ranges up to 90 days", () => {
    expect(() =>
      assertDateRange({ start_date: "2026-06-01", end_date: "2026-06-17" }),
    ).not.toThrow();
  });

  it("rejects ranges over 90 days", () => {
    expect(() =>
      assertDateRange({ start_date: "2026-01-01", end_date: "2026-06-17" }),
    ).toThrow(SqlGuardrailError);
  });
});

describe("enforceRowLimit", () => {
  it("appends limit when missing", () => {
    expect(enforceRowLimit("SELECT 1")).toContain("LIMIT 10000");
  });

  it("rejects excessive limits", () => {
    expect(() => enforceRowLimit("SELECT 1 LIMIT 20000")).toThrow(SqlGuardrailError);
  });
});

describe("validateAgentSql", () => {
  it("validates a guarded serving mart query", () => {
    const sql = `
      SELECT day, net_revenue
      FROM ${servingTableFqn("mart_orders_daily")}
      WHERE store_id = '${STORE_ID}'
        AND day >= '2026-06-01'
        AND day <= '2026-06-17'
    `;

    const safe = validateAgentSql(sql, {
      storeId: STORE_ID,
      startDate: "2026-06-01",
      endDate: "2026-06-17",
    });

    expect(safe).toContain("LIMIT 10000");
  });
});

describe("buildStandardMetricQuery", () => {
  it("targets serving marts with store and date parameters", () => {
    const built = buildStandardMetricQuery("orders_daily", {
      store_id: STORE_ID,
      start_date: "2026-06-01",
      end_date: "2026-06-17",
    });

    expect(built.sql).toContain("morgan_serving.gold_mart_orders_daily");
    expect(built.sql).toContain("{store_id:UUID}");
    expect(built.query_params.store_id).toBe(STORE_ID);
    expect(built.sql).toContain("LIMIT 10000");
  });

  it("uses ad performance serving mart for campaign metrics", () => {
    const built = buildStandardMetricQuery("ad_performance", {
      store_id: STORE_ID,
      start_date: "2026-06-01",
      end_date: "2026-06-30",
    });

    expect(built.sql).toContain("morgan_serving.gold_mart_ad_performance");
  });
});
