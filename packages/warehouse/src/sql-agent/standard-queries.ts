import {
  SQL_AGENT_SERVING_DATABASE,
  SQL_AGENT_SERVING_SCHEMA,
  type SqlAgentQueryParams,
  type StandardMetricQueryId,
} from "./types.js";

function table(name: string): string {
  return `${SQL_AGENT_SERVING_DATABASE}.${SQL_AGENT_SERVING_SCHEMA}_${name}`;
}

export const STANDARD_METRIC_QUERIES: Record<StandardMetricQueryId, string> = {
  orders_daily: `
SELECT
  day,
  orders,
  gross_revenue,
  net_revenue,
  discounts,
  shipping_revenue,
  cogs,
  contribution_margin,
  units_sold
FROM ${table("mart_orders_daily")}
WHERE store_id = {store_id:UUID}
  AND day >= {start_date:Date}
  AND day <= {end_date:Date}
ORDER BY day
LIMIT 10000
`.trim(),

  ad_performance: `
SELECT
  day,
  channel,
  campaign_id,
  campaign_name,
  ad_spend,
  attributed_revenue,
  roas,
  poas,
  impressions,
  clicks,
  purchases
FROM ${table("mart_ad_performance")}
WHERE store_id = {store_id:UUID}
  AND day >= {start_date:Date}
  AND day <= {end_date:Date}
ORDER BY day, channel, campaign_id
LIMIT 10000
`.trim(),

  sku_economics: `
SELECT
  week_start,
  sku,
  orders_count,
  units_sold,
  gross_revenue,
  cogs,
  contribution_margin,
  unit_margin,
  velocity_per_day,
  return_rate
FROM ${table("mart_sku_economics")}
WHERE store_id = {store_id:UUID}
  AND week_start >= {start_date:Date}
  AND week_start <= {end_date:Date}
ORDER BY week_start, sku
LIMIT 10000
`.trim(),
};

export function buildStandardMetricQuery(
  queryId: StandardMetricQueryId,
  params: SqlAgentQueryParams,
): { sql: string; query_params: Record<string, string> } {
  return {
    sql: STANDARD_METRIC_QUERIES[queryId],
    query_params: {
      store_id: params.store_id,
      start_date: params.start_date,
      end_date: params.end_date,
    },
  };
}
