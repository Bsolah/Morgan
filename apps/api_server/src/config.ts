import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../.env") });

function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: optionalUrl,
  REDIS_URL: optionalUrl,
  JWT_SECRET: z.string().min(32).default("dev-only-jwt-secret-change-in-production-32chars"),
  ENCRYPTION_KEY: z
    .string()
    .min(16)
    .default("dev-only-encryption-key-change-in-production"),
  SHOPIFY_API_KEY: optionalString,
  SHOPIFY_API_SECRET: optionalString,
  SHOPIFY_APP_SCOPES: z
    .string()
    .default(
      "read_orders,read_products,read_inventory,read_locations,read_shopify_payments_payouts,read_customers",
    ),
  SHOPIFY_APP_URL: optionalUrl,
  MOBILE_DEEP_LINK_SCHEME: z.string().default("morgan"),
  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_APP_URL: optionalUrl,
  META_TOKEN_REFRESH_INTERVAL_MS: z.coerce.number().default(21_600_000),
  META_TOKEN_REFRESH_WITHIN_MS: z.coerce.number().default(1_209_600_000),
  META_INSIGHTS_SYNC_INTERVAL_MS: z.coerce.number().default(14_400_000),
  META_INSIGHTS_BACKFILL_DAYS: z.coerce.number().default(90),
  META_INSIGHTS_INCREMENTAL_DAYS: z.coerce.number().default(3),
  META_INSIGHTS_CHUNK_DAYS: z.coerce.number().min(1).max(30).default(7),
  META_INSIGHTS_RATE_LIMIT_MAX_RETRIES: z.coerce.number().min(1).max(10).default(5),
  META_INSIGHTS_RATE_LIMIT_BASE_DELAY_MS: z.coerce.number().default(1000),
  CLICKHOUSE_AD_PERFORMANCE_TABLE: z.string().default("mart_ad_performance"),
  BRONZE_STORAGE_PATH: z.string().default("./data/bronze"),
  BRONZE_STORAGE_BACKEND: z.enum(["filesystem", "s3"]).default("filesystem"),
  BRONZE_S3_BUCKET: z.string().default("bronze"),
  BRONZE_S3_REGION: optionalString,
  DEAD_LETTER_STORAGE_PATH: z.string().default("./data/dead-letter"),
  CLICKHOUSE_STORAGE_PATH: z.string().default("./data/clickhouse"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  CLICKHOUSE_URL: optionalUrl,
  CLICKHOUSE_ORDERS_TABLE: z.string().default("shopify_order_events"),
  CLICKHOUSE_DIM_PRODUCTS_TABLE: z.string().default("dim_products"),
  CLICKHOUSE_INVENTORY_TABLE: z.string().default("inventory_levels"),
  CLICKHOUSE_ORDER_LINES_TABLE: z.string().default("fact_order_lines"),
  PRODUCT_CATALOG_PAGE_SIZE: z.coerce.number().min(1).max(250).default(50),
  INVENTORY_POLL_INTERVAL_MS: z.coerce.number().default(86_400_000),
  PRODUCT_SYNC_SLA_MINUTES: z.coerce.number().default(15),
  PAYOUT_POLL_INTERVAL_MS: z.coerce.number().default(86_400_000),
  PAYOUT_DELAY_ALERT_THRESHOLD_DAYS: z.coerce.number().default(3),
  CLICKHOUSE_CASH_DAILY_TABLE: z.string().default("mart_cash_daily"),
  CLICKHOUSE_AGENT_URL: optionalUrl,
  CLICKHOUSE_AGENT_USER: z.string().default("morgan_agent"),
  CLICKHOUSE_AGENT_PASSWORD: optionalString,
  SQL_AGENT_MAX_DATE_RANGE_DAYS: z.coerce.number().default(90),
  SQL_AGENT_MAX_ROWS: z.coerce.number().default(10_000),
  SQL_AGENT_MAX_EXECUTION_MS: z.coerce.number().default(500),
  WEBHOOK_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86_400),
  EVENT_PROCESSING_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().default(86_400),
  ORDER_BACKFILL_DAYS: z.coerce.number().default(90),
  ORDER_BACKFILL_PARTIAL_BRIEF_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  ORDER_BACKFILL_BATCH_SIZE: z.coerce.number().min(1).max(5000).default(250),
  SHOP_REDACT_RETENTION_DAYS: z.coerce.number().default(30),
  COMPLIANCE_INTERNAL_KEY: optionalString,
  COMPLIANCE_PURGE_POLL_INTERVAL_MS: z.coerce.number().default(3_600_000),
  WAREHOUSE_CHAT_REFRESH_SIGNAL_PATH: z.string().default("./data/warehouse/chat_refresh.pending"),
  PLAID_CLIENT_ID: optionalString,
  PLAID_SECRET: optionalString,
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  PLAID_SYNC_INTERVAL_MS: z.coerce.number().default(14_400_000),
  PLAID_WEBHOOK_SKIP_VERIFY: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  CASH_RUNWAY_POLL_INTERVAL_MS: z.coerce.number().default(900_000),
  CASH_RUNWAY_LOCAL_HOUR: z.coerce.number().min(0).max(23).default(6),
  CASH_RUNWAY_WARNING_DAYS: z.coerce.number().default(30),
  CASH_RUNWAY_CRITICAL_DAYS: z.coerce.number().default(7),
  CASH_RUNWAY_TRAILING_DAYS: z.coerce.number().default(30),
  INTUIT_CLIENT_ID: optionalString,
  INTUIT_CLIENT_SECRET: optionalString,
  INTUIT_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  INTUIT_TOKEN_REFRESH_INTERVAL_MS: z.coerce.number().default(3_600_000),
  INTUIT_TOKEN_REFRESH_WITHIN_MS: z.coerce.number().default(900_000),
  INTUIT_REAUTH_PROMPT_WITHIN_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000),
  INTUIT_SYNC_INTERVAL_MS: z.coerce.number().default(86_400_000),
  INTUIT_SYNC_MAX_RETRIES: z.coerce.number().min(1).max(5).default(3),
  GOOGLE_ADS_CLIENT_ID: optionalString,
  GOOGLE_ADS_CLIENT_SECRET: optionalString,
  GOOGLE_ADS_DEVELOPER_TOKEN: optionalString,
  GOOGLE_ADS_INSIGHTS_BACKFILL_DAYS: z.coerce.number().default(90),
  GOOGLE_ADS_INSIGHTS_INCREMENTAL_DAYS: z.coerce.number().default(3),
  GOOGLE_ADS_INSIGHTS_CHUNK_DAYS: z.coerce.number().min(1).max(30).default(7),
  GOOGLE_ADS_INSIGHTS_SYNC_INTERVAL_MS: z.coerce.number().default(14_400_000),
  GOOGLE_ADS_API_MAX_RETRIES: z.coerce.number().min(1).max(10).default(5),
  GOOGLE_ADS_API_RETRY_BASE_MS: z.coerce.number().min(100).default(1000),
  GOOGLE_ADS_SHOPPING_PAGE_SIZE: z.coerce.number().min(100).max(10_000).default(10_000),
  GOOGLE_ADS_TOKEN_REFRESH_INTERVAL_MS: z.coerce.number().default(21_600_000),
  GOOGLE_ADS_TOKEN_REFRESH_WITHIN_MS: z.coerce.number().default(900_000),
  XERO_CLIENT_ID: optionalString,
  XERO_CLIENT_SECRET: optionalString,
  XERO_TOKEN_REFRESH_INTERVAL_MS: z.coerce.number().default(3_600_000),
  XERO_TOKEN_REFRESH_WITHIN_MS: z.coerce.number().default(900_000),
  XERO_REAUTH_PROMPT_WITHIN_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000),
  XERO_SYNC_INTERVAL_MS: z.coerce.number().default(86_400_000),
  XERO_SYNC_MAX_RETRIES: z.coerce.number().min(1).max(5).default(3),
  BRIEFING_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  LEAK_SCAN_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  LEAK_SCAN_TIME_LOCAL: z.string().default("05:30"),
  LEAK_SCAN_TIMEOUT_MS: z.coerce.number().default(60_000),
  REVENUE_FORECAST_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  REVENUE_FORECAST_TIME_LOCAL: z.string().default("06:00"),
  SKU_DEMAND_FORECAST_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  SKU_DEMAND_FORECAST_TIME_LOCAL: z.string().default("06:15"),
  RECOMMENDATION_RANK_WEIGHT_IMPACT: z.coerce.number().positive().default(1),
  RECOMMENDATION_RANK_WEIGHT_CONFIDENCE: z.coerce.number().positive().default(1),
  RECOMMENDATION_RANK_WEIGHT_URGENCY: z.coerce.number().positive().default(1),
  RECOMMENDATION_RANK_WEIGHT_EFFORT: z.coerce.number().positive().default(1),
  FORECAST_SERVICE_URL: optionalUrl,
  FORECAST_SERVICE_TIMEOUT_MS: z.coerce.number().default(120_000),
  BRIEFING_LLM_API_URL: optionalUrl,
  BRIEFING_LLM_API_KEY: optionalString,
  BRIEFING_LLM_MODEL: z.string().default("gpt-4o-mini"),
  BRIEFING_LLM_TIMEOUT_MS: z.coerce.number().default(30_000),
  BRIEFING_QUIET_HOURS_START: z.coerce.number().min(0).max(23).default(22),
  BRIEFING_QUIET_HOURS_END: z.coerce.number().min(0).max(23).default(5),
  BRIEFING_CRITICAL_CASH_OVERRIDE_DAYS: z.coerce.number().min(1).default(3),
  FCM_SERVER_KEY: optionalString,
  FCM_SEND_TIMEOUT_MS: z.coerce.number().default(10_000),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("Morgan <notifications@getmorgan.com>"),
  WEEKLY_DIGEST_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  METRICS_RECALC_POLL_INTERVAL_MS: z.coerce.number().default(30_000),
  WEEKLY_DIGEST_TIME_LOCAL: z.string().default("07:00"),
  MORGAN_POSTAL_ADDRESS: z
    .string()
    .default("Morgan by Cornerstone, 123 Market Street, San Francisco, CA 94105"),
});

export const env = envSchema.parse(process.env);

export function isShopifyOAuthConfigured(): boolean {
  return Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET);
}

export function getShopifyOAuthCallbackUrl(): string {
  const base = (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}/api/v1/auth/shopify/callback`;
}

export function getMobileDeepLink(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  return `${env.MOBILE_DEEP_LINK_SCHEME}://${path}${suffix}`;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET);
}

export function getMetaOAuthCallbackUrl(): string {
  const base = (env.META_APP_URL ?? env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(
    /\/$/,
    "",
  );
  return `${base}/api/v1/integrations/meta/oauth/callback`;
}

export function isPlaidConfigured(): boolean {
  return Boolean(env.PLAID_CLIENT_ID && env.PLAID_SECRET);
}

export function getPlaidConfig() {
  if (!isPlaidConfigured()) {
    throw new Error("Plaid is not configured");
  }

  return {
    clientId: env.PLAID_CLIENT_ID!,
    secret: env.PLAID_SECRET!,
    environment: env.PLAID_ENV,
  };
}

export function isQuickBooksOAuthConfigured(): boolean {
  return Boolean(env.INTUIT_CLIENT_ID && env.INTUIT_CLIENT_SECRET);
}

export function getQuickBooksOAuthCallbackUrl(): string {
  const base = (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}/api/v1/integrations/quickbooks/oauth/callback`;
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return Boolean(
    env.GOOGLE_ADS_CLIENT_ID &&
      env.GOOGLE_ADS_CLIENT_SECRET &&
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
  );
}

export function getGoogleAdsOAuthCallbackUrl(): string {
  const base = (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}/api/v1/integrations/google-ads/oauth/callback`;
}

export function isXeroOAuthConfigured(): boolean {
  return Boolean(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET);
}

export function getXeroOAuthCallbackUrl(): string {
  const base = (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}/api/v1/integrations/xero/oauth/callback`;
}

export function getAppPublicUrl(): string {
  return (env.SHOPIFY_APP_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
}

export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
