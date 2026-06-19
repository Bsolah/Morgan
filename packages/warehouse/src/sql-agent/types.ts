export const SQL_AGENT_SERVING_DATABASE = "morgan_serving";
export const SQL_AGENT_SERVING_SCHEMA = "gold";

export const SQL_AGENT_MAX_DATE_RANGE_DAYS = 90;
export const SQL_AGENT_MAX_ROWS = 10_000;
export const SQL_AGENT_MAX_EXECUTION_MS = 500;
export const SQL_AGENT_P95_LATENCY_TARGET_MS = 500;

export const SQL_AGENT_SERVING_TABLES = [
  "mart_orders_daily",
  "mart_sku_economics",
  "mart_ad_performance",
  "mart_profit_leaks",
  "mart_recommendations",
] as const;

export type SqlAgentServingTable = (typeof SQL_AGENT_SERVING_TABLES)[number];

export function servingTableFqn(table: SqlAgentServingTable): string {
  return `${SQL_AGENT_SERVING_DATABASE}.${SQL_AGENT_SERVING_SCHEMA}_${table}`;
}

export type SqlAgentQueryParams = {
  store_id: string;
  start_date: string;
  end_date: string;
};

export type SqlAgentQueryResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  elapsed_ms: number;
};

export type StandardMetricQueryId = "orders_daily" | "ad_performance" | "sku_economics";
