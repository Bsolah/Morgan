import { createSqlAgentService, type SqlAgentService } from "@morgan/warehouse";
import { env } from "../config.js";

let service: SqlAgentService | null | undefined;

export function getSqlAgentClickhouseUrl(): string | undefined {
  return env.CLICKHOUSE_AGENT_URL ?? env.CLICKHOUSE_URL;
}

export async function getSqlAgentService(): Promise<SqlAgentService | null> {
  if (service !== undefined) return service;

  const url = getSqlAgentClickhouseUrl();
  if (!url) {
    service = null;
    return service;
  }

  service = await createSqlAgentService({
    clickhouseUrl: url,
    clickhouseUser: env.CLICKHOUSE_AGENT_USER,
    clickhousePassword: env.CLICKHOUSE_AGENT_PASSWORD ?? "",
    maxExecutionMs: env.SQL_AGENT_MAX_EXECUTION_MS,
  });

  return service;
}

export function resetSqlAgentServiceForTests(): void {
  service = undefined;
}
