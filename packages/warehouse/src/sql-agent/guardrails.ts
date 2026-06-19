import {
  SQL_AGENT_MAX_DATE_RANGE_DAYS,
  SQL_AGENT_MAX_ROWS,
  SQL_AGENT_SERVING_TABLES,
  servingTableFqn,
  type SqlAgentServingTable,
} from "./types.js";

const FORBIDDEN_PATTERN =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|attach|detach|kill|system|optimize|rename|exchange)\b/i;

const MULTI_STATEMENT_PATTERN = /;\s*\S/;

export type SqlGuardrailViolationCode =
  | "read_only_violation"
  | "store_filter_required"
  | "store_filter_mismatch"
  | "date_range_exceeded"
  | "row_limit_exceeded"
  | "table_not_allowed"
  | "invalid_sql";

export class SqlGuardrailError extends Error {
  constructor(
    public readonly code: SqlGuardrailViolationCode,
    message: string,
  ) {
    super(message);
    this.name = "SqlGuardrailError";
  }
}

export type DateRange = {
  start_date: string;
  end_date: string;
};

export function normalizeSql(sql: string): string {
  return sql.trim().replace(/;\s*$/, "");
}

export function assertReadOnlySelect(sql: string): void {
  const normalized = normalizeSql(sql);
  if (!normalized) {
    throw new SqlGuardrailError("invalid_sql", "SQL query is empty");
  }
  if (MULTI_STATEMENT_PATTERN.test(normalized)) {
    throw new SqlGuardrailError("read_only_violation", "Only a single SELECT statement is allowed");
  }
  if (!/^\s*(with\b|select\b)/i.test(normalized)) {
    throw new SqlGuardrailError("read_only_violation", "Only SELECT queries are allowed");
  }
  if (FORBIDDEN_PATTERN.test(normalized)) {
    throw new SqlGuardrailError("read_only_violation", "Mutating or administrative SQL is not allowed");
  }
}

export function assertStoreFilter(sql: string, storeId: string): void {
  const normalized = normalizeSql(sql).toLowerCase();
  if (!normalized.includes("store_id")) {
    throw new SqlGuardrailError("store_filter_required", "Queries must filter on store_id");
  }

  const storePattern = new RegExp(`store_id\\s*=\\s*['"]?${storeId.toLowerCase()}['"]?`, "i");
  const paramPattern = /store_id\s*=\s*\{store_id:[^}]+\}/i;

  if (!storePattern.test(normalized) && !paramPattern.test(sql)) {
    throw new SqlGuardrailError(
      "store_filter_mismatch",
      "store_id filter must match the authorized store",
    );
  }
}

export function parseIsoDay(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new SqlGuardrailError("invalid_sql", `Invalid date: ${value}`);
  }
  return date;
}

export function assertDateRange(range: DateRange, maxDays = SQL_AGENT_MAX_DATE_RANGE_DAYS): void {
  const start = parseIsoDay(range.start_date);
  const end = parseIsoDay(range.end_date);
  if (end < start) {
    throw new SqlGuardrailError("invalid_sql", "end_date must be on or after start_date");
  }

  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (spanDays > maxDays) {
    throw new SqlGuardrailError(
      "date_range_exceeded",
      `Date range exceeds ${maxDays} days (${spanDays} requested)`,
    );
  }
}

export function extractLimit(sql: string): number | null {
  const match = /\blimit\s+(\d+)\b/i.exec(sql);
  return match ? Number(match[1]) : null;
}

export function enforceRowLimit(sql: string, maxRows = SQL_AGENT_MAX_ROWS): string {
  const normalized = normalizeSql(sql);
  const currentLimit = extractLimit(normalized);
  if (currentLimit != null && currentLimit > maxRows) {
    throw new SqlGuardrailError("row_limit_exceeded", `LIMIT ${currentLimit} exceeds max ${maxRows}`);
  }
  if (currentLimit == null) {
    return `${normalized}\nLIMIT ${maxRows}`;
  }
  return normalized;
}

export function assertAllowedTables(sql: string): void {
  const normalized = normalizeSql(sql).toLowerCase();
  const referenced = SQL_AGENT_SERVING_TABLES.filter((table) => {
    const bare = table.toLowerCase();
    const qualified = servingTableFqn(table).toLowerCase();
    return normalized.includes(bare) || normalized.includes(qualified);
  });

  if (referenced.length === 0) {
    throw new SqlGuardrailError(
      "table_not_allowed",
      `Query must reference a serving mart: ${SQL_AGENT_SERVING_TABLES.join(", ")}`,
    );
  }

  for (const table of referenced) {
    if (!SQL_AGENT_SERVING_TABLES.includes(table as SqlAgentServingTable)) {
      throw new SqlGuardrailError("table_not_allowed", `Table ${table} is not allowed`);
    }
  }
}

export function validateAgentSql(
  sql: string,
  options: { storeId: string; startDate?: string; endDate?: string },
): string {
  assertReadOnlySelect(sql);
  assertStoreFilter(sql, options.storeId);
  assertAllowedTables(sql);

  if (options.startDate && options.endDate) {
    assertDateRange({ start_date: options.startDate, end_date: options.endDate });
  }

  return enforceRowLimit(sql);
}
