import { validateAgentSql } from "./guardrails.js";
import {
  createClickHouseAgentClient,
  executeAgentQuery,
  executeStandardMetricQuery,
  type ClickHouseAgentClient,
  type SqlAgentClientOptions,
} from "./client.js";
import type { SqlAgentQueryParams, SqlAgentQueryResult, StandardMetricQueryId } from "./types.js";

export type SqlAgentServiceOptions = {
  clickhouseUrl: string;
  clickhouseUser: string;
  clickhousePassword: string;
  maxExecutionMs?: number;
};

export class SqlAgentService {
  private clientPromise: Promise<ClickHouseAgentClient> | null = null;

  constructor(private readonly options: SqlAgentServiceOptions) {}

  private async getClient(): Promise<ClickHouseAgentClient> {
    if (!this.clientPromise) {
      this.clientPromise = createClickHouseAgentClient({
        url: this.options.clickhouseUrl,
        username: this.options.clickhouseUser,
        password: this.options.clickhousePassword,
      });
    }
    return this.clientPromise;
  }

  private clientOptions(client: ClickHouseAgentClient): SqlAgentClientOptions {
    return {
      client,
      maxExecutionMs: this.options.maxExecutionMs,
    };
  }

  async runStandardMetricQuery(
    queryId: StandardMetricQueryId,
    params: SqlAgentQueryParams,
  ): Promise<SqlAgentQueryResult> {
    const client = await this.getClient();
    return executeStandardMetricQuery(this.clientOptions(client), queryId, params);
  }

  async runValidatedQuery(
    sql: string,
    params: SqlAgentQueryParams,
  ): Promise<SqlAgentQueryResult> {
    const safeSql = validateAgentSql(sql, {
      storeId: params.store_id,
      startDate: params.start_date,
      endDate: params.end_date,
    });
    const client = await this.getClient();
    return executeAgentQuery(this.clientOptions(client), safeSql, {
      store_id: params.store_id,
      start_date: params.start_date,
      end_date: params.end_date,
    });
  }
}

export async function createSqlAgentService(
  options: SqlAgentServiceOptions,
): Promise<SqlAgentService | null> {
  if (!options.clickhouseUrl || !options.clickhouseUser) {
    return null;
  }
  return new SqlAgentService(options);
}
