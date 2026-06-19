import {
  SQL_AGENT_MAX_EXECUTION_MS,
  type SqlAgentQueryResult,
  type StandardMetricQueryId,
} from "./types.js";
import { assertDateRange } from "./guardrails.js";
import { buildStandardMetricQuery } from "./standard-queries.js";
import type { SqlAgentQueryParams } from "./types.js";

export type ClickHouseAgentClient = {
  query(input: {
    query: string;
    query_params?: Record<string, string>;
    format?: "JSONEachRow";
    clickhouse_settings?: Record<string, string | number>;
  }): Promise<{ json(): Promise<unknown[]> }>;
};

export type SqlAgentClientOptions = {
  client: ClickHouseAgentClient;
  maxExecutionMs?: number;
};

export async function executeStandardMetricQuery(
  options: SqlAgentClientOptions,
  queryId: StandardMetricQueryId,
  params: SqlAgentQueryParams,
): Promise<SqlAgentQueryResult> {
  assertDateRange({ start_date: params.start_date, end_date: params.end_date });
  const built = buildStandardMetricQuery(queryId, params);
  return executeAgentQuery(options, built.sql, built.query_params);
}

export async function executeAgentQuery(
  options: SqlAgentClientOptions,
  sql: string,
  queryParams?: Record<string, string>,
): Promise<SqlAgentQueryResult> {
  const started = Date.now();
  const maxExecutionMs = options.maxExecutionMs ?? SQL_AGENT_MAX_EXECUTION_MS;

  const result = await options.client.query({
    query: sql,
    query_params: queryParams,
    format: "JSONEachRow",
    clickhouse_settings: {
      max_execution_time: maxExecutionMs / 1000,
      readonly: 1,
    },
  });

  const rows = (await result.json()) as Record<string, unknown>[];
  const elapsed_ms = Date.now() - started;
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];

  return {
    columns,
    rows,
    row_count: rows.length,
    elapsed_ms,
  };
}

export async function createClickHouseAgentClient(options: {
  url: string;
  username: string;
  password: string;
}): Promise<ClickHouseAgentClient> {
  const { createClient } = await import("@clickhouse/client");
  const client = createClient({
    url: options.url,
    username: options.username,
    password: options.password,
  });

  return {
    query: (input) => client.query(input),
  };
}
