import {
  boolean,
  integer,
  jsonb,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const storeStatusEnum = pgEnum("store_status", [
  "active",
  "syncing",
  "uninstalled",
  "suspended",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "shopify",
  "meta",
  "plaid",
  "quickbooks",
  "google_ads",
  "xero",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "syncing",
  "error",
  "disconnected",
]);

export const cogsMethodEnum = pgEnum("cogs_method", ["shopify", "manual_pct", "qbo", "xero"]);

export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  triggeredBy: varchar("triggered_by", { length: 50 }).notNull().default("oauth_connect"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const orderBackfillJobs = pgTable("order_backfill_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  syncRunId: uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  shopifyBulkOperationId: varchar("shopify_bulk_operation_id", { length: 255 }),
  bulkResultsUrl: text("bulk_results_url"),
  bulkResultsPath: text("bulk_results_path"),
  processedCount: integer("processed_count").notNull().default(0),
  totalCount: integer("total_count"),
  cursorLine: integer("cursor_line").notNull().default(0),
  sinceDate: timestamp("since_date", { withTimezone: true }).notNull(),
  partialBriefAvailable: boolean("partial_brief_available").notNull().default(false),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const backfillOrderReceipts = pgTable(
  "backfill_order_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    shopifyOrderId: varchar("shopify_order_id", { length: 255 }).notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => orderBackfillJobs.id, { onDelete: "cascade" }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("backfill_order_receipts_store_order_unique").on(table.storeId, table.shopifyOrderId),
  ],
);

export const productCatalogSyncJobs = pgTable("product_catalog_sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  syncRunId: uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  productsCursor: text("products_cursor"),
  processedCount: integer("processed_count").notNull().default(0),
  totalCount: integer("total_count"),
  lastInventoryPollAt: timestamp("last_inventory_poll_at", { withTimezone: true }),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  planTier: varchar("plan_tier", { length: 50 }).notNull().default("trial"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull().default("shopify"),
  shopDomain: varchar("shop_domain", { length: 255 }).notNull().unique(),
  timezone: varchar("timezone", { length: 100 }).notNull().default("UTC"),
  shopifyTimezone: varchar("shopify_timezone", { length: 100 }).notNull().default("UTC"),
  timezoneSource: varchar("timezone_source", { length: 20 }).notNull().default("shopify"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  status: storeStatusEnum("status").notNull().default("syncing"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  provider: integrationProviderEnum("provider").notNull(),
  status: integrationStatusEnum("status").notNull().default("connected"),
  scopes: text("scopes"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

export const integrationCredentials = pgTable("integration_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => integrations.id, { onDelete: "cascade" }),
  encryptedPayload: text("encrypted_payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
  source: varchar("source", { length: 50 }).notNull(),
  topic: varchar("topic", { length: 100 }).notNull(),
  shopDomain: varchar("shop_domain", { length: 255 }),
  externalId: varchar("external_id", { length: 255 }),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("received"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export const merchantFinanceConfig = pgTable("merchant_finance_config", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  cogsMethod: cogsMethodEnum("cogs_method").notNull().default("shopify"),
  manualCogsPct: numeric("manual_cogs_pct", { precision: 5, scale: 2 }),
  paymentFeePct: numeric("payment_fee_pct", { precision: 5, scale: 3 }),
  shippingCostPct: numeric("shipping_cost_pct", { precision: 5, scale: 2 }).notNull().default("8"),
  targetContributionMarginPct: numeric("target_contribution_margin_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("40"),
  briefingTimeLocal: varchar("briefing_time_local", { length: 5 }).notNull().default("06:00"),
  pendingBriefingTimeLocal: varchar("pending_briefing_time_local", { length: 5 }),
  pendingTimezone: varchar("pending_timezone", { length: 100 }),
  scheduleEffectiveFrom: varchar("schedule_effective_from", { length: 10 }),
  notificationPrefs: jsonb("notification_prefs"),
  metricsRecalcRequestedAt: timestamp("metrics_recalc_requested_at", { withTimezone: true }),
  metricsRecalcDueBy: timestamp("metrics_recalc_due_by", { withTimezone: true }),
  metricsRecalcStartedAt: timestamp("metrics_recalc_started_at", { withTimezone: true }),
  metricsRecalcCompletedAt: timestamp("metrics_recalc_completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const merchantInventoryConfig = pgTable("merchant_inventory_config", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  defaultLeadTimeDays: integer("default_lead_time_days").notNull().default(14),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skuLeadTimeOverrides = pgTable(
  "sku_lead_time_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 255 }).notNull(),
    leadTimeDays: integer("lead_time_days").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sku_lead_time_overrides_store_sku_idx").on(table.storeId, table.sku)],
);

export const shopifyPaymentsSyncState = pgTable("shopify_payments_sync_state", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  available: boolean("available").notNull().default(false),
  lastPollAt: timestamp("last_poll_at", { withTimezone: true }),
  lastBalance: numeric("last_balance", { precision: 18, scale: 4 }),
  currency: varchar("currency", { length: 3 }),
  payoutSchedule: jsonb("payout_schedule").$type<{
    interval: string;
    monthlyAnchor?: number | null;
    weeklyAnchor?: string | null;
  } | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopifyPayouts = pgTable(
  "shopify_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    shopifyPayoutId: varchar("shopify_payout_id", { length: 255 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shopify_payouts_store_payout_unique").on(table.storeId, table.shopifyPayoutId),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    severity: alertSeverityEnum("severity").notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    metricSnapshot: jsonb("metric_snapshot").$type<Record<string, unknown>>(),
    dedupeKey: varchar("dedupe_key", { length: 255 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("alerts_store_dedupe_unique").on(table.storeId, table.dedupeKey)],
);

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 100 }).notNull(),
    value: numeric("value", { precision: 18, scale: 4 }).notNull(),
    period: varchar("period", { length: 50 }).notNull(),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
    source: varchar("source", { length: 100 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("metric_snapshots_store_key_period_unique").on(
      table.storeId,
      table.metricKey,
      table.period,
    ),
  ],
);

export const dailyBriefings = pgTable(
  "daily_briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    briefingDate: varchar("briefing_date", { length: 10 }).notNull(),
    headline: varchar("headline", { length: 140 }).notNull(),
    narrativeText: text("narrative_text").notNull(),
    summaryJson: jsonb("summary_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    version: integer("version").notNull().default(1),
    criticalRegenerationsCount: integer("critical_regenerations_count").notNull().default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_briefings_store_date_unique").on(table.storeId, table.briefingDate),
  ],
);

export const dailyBriefingVersions = pgTable(
  "daily_briefing_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    briefingDate: varchar("briefing_date", { length: 10 }).notNull(),
    version: integer("version").notNull(),
    headline: varchar("headline", { length: 140 }).notNull(),
    narrativeText: text("narrative_text").notNull(),
    summaryJson: jsonb("summary_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    trigger: varchar("trigger", { length: 50 }).notNull().default("scheduled"),
    alertType: varchar("alert_type", { length: 100 }),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_briefing_versions_store_date_version_unique").on(
      table.storeId,
      table.briefingDate,
      table.version,
    ),
  ],
);

export const pushDeviceTokens = pgTable(
  "push_device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    token: varchar("token", { length: 512 }).notNull(),
    platform: varchar("platform", { length: 20 }).notNull().default("unknown"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("push_device_tokens_store_token_unique").on(table.storeId, table.token),
  ],
);

export const weeklyEmailDigestSends = pgTable(
  "weekly_email_digest_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    weekStart: varchar("week_start", { length: 10 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    resendMessageId: varchar("resend_message_id", { length: 255 }),
  },
  (table) => [
    uniqueIndex("weekly_email_digest_store_week_unique").on(table.storeId, table.weekStart),
  ],
);

export const emailDigestUnsubscribeTokens = pgTable(
  "email_digest_unsubscribe_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("email_digest_unsub_store_unique").on(table.storeId)],
);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("shopify"),
  externalId: varchar("external_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).notNull().default("trial"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shopDataPurgeJobs = pgTable(
  "shop_data_purge_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull().default("soft_deleted"),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }).notNull().defaultNow(),
    purgeDueBy: timestamp("purge_due_by", { withTimezone: true }).notNull(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("shop_data_purge_jobs_store_unique").on(table.storeId)],
);

export const customerDataRequests = pgTable("customer_data_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  shopifyCustomerId: varchar("shopify_customer_id", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  dataRequestId: varchar("data_request_id", { length: 255 }),
  ordersRequested: jsonb("orders_requested").$type<Array<Record<string, unknown>>>(),
  exportJson: jsonb("export_json").$type<Record<string, unknown>>(),
  status: varchar("status", { length: 50 }).notNull().default("completed"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  shopifyCustomerId: varchar("shopify_customer_id", { length: 255 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  content: text("content").notNull(),
  redactedAt: timestamp("redacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessionMessages = pgTable(
  "chat_session_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Array<Record<string, unknown>>>(),
    confidence: varchar("confidence", { length: 20 }),
    followUps: jsonb("follow_ups").$type<string[]>(),
    actionCard: jsonb("action_card").$type<Record<string, unknown>>(),
    scenarioCard: jsonb("scenario_card").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_session_messages_session_created_unique").on(
      table.sessionId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const scenarios = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  channel: varchar("channel", { length: 50 }),
  spendChangePct: numeric("spend_change_pct", { precision: 8, scale: 2 }),
  inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
  results: jsonb("results").$type<Record<string, unknown>>().notNull(),
  source: varchar("source", { length: 50 }).notNull().default("chat"),
  chatMessageId: uuid("chat_message_id").references(() => chatSessionMessages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metaAdAccounts = pgTable(
  "meta_ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 3 }),
    accountStatus: integer("account_status"),
    isSelected: boolean("is_selected").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("meta_ad_accounts_integration_external_unique").on(
      table.integrationId,
      table.externalId,
    ),
  ],
);

export const metaIntegrationState = pgTable("meta_integration_state", {
  integrationId: uuid("integration_id")
    .primaryKey()
    .references(() => integrations.id, { onDelete: "cascade" }),
  pendingAccountSelection: boolean("pending_account_selection").notNull().default(false),
  refreshFailureCount: integer("refresh_failure_count").notNull().default(0),
  lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
  lastError: text("last_error"),
  lastInsightsError: text("last_insights_error"),
  insightsBackfillCompleted: boolean("insights_backfill_completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metaSyncJobs = pgTable("meta_sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => integrations.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketingAttributionRules = pgTable(
  "marketing_attribution_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 50 }).notNull().default("meta"),
    matchField: varchar("match_field", { length: 50 }).notNull().default("utm_source"),
    matchType: varchar("match_type", { length: 50 }).notNull().default("contains"),
    pattern: varchar("pattern", { length: 255 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marketing_attribution_rules_store_channel_pattern_unique").on(
      table.storeId,
      table.channel,
      table.matchField,
      table.pattern,
    ),
  ],
);

export const martAdPerformanceDaily = pgTable(
  "mart_ad_performance_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 50 }).notNull().default("meta"),
    campaignId: varchar("campaign_id", { length: 64 }).notNull(),
    campaignName: varchar("campaign_name", { length: 255 }).notNull(),
    performanceDate: varchar("performance_date", { length: 10 }).notNull(),
    adSpend: numeric("ad_spend", { precision: 18, scale: 4 }).notNull().default("0"),
    attributedRevenue: numeric("attributed_revenue", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    attributedContributionMargin: numeric("attributed_contribution_margin", {
      precision: 18,
      scale: 4,
    })
      .notNull()
      .default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    purchaseValue: numeric("purchase_value", { precision: 18, scale: 4 }).notNull().default("0"),
    roas: numeric("roas", { precision: 18, scale: 4 }),
    poas: numeric("poas", { precision: 18, scale: 4 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mart_ad_performance_daily_unique").on(
      table.storeId,
      table.channel,
      table.campaignId,
      table.performanceDate,
    ),
  ],
);

export const metaInsightsDaily = pgTable(
  "meta_insights_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 50 }).notNull().default("meta"),
    insightLevel: varchar("insight_level", { length: 20 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    entityName: varchar("entity_name", { length: 255 }).notNull(),
    campaignId: varchar("campaign_id", { length: 64 }),
    campaignName: varchar("campaign_name", { length: 255 }),
    adsetId: varchar("adset_id", { length: 64 }),
    adsetName: varchar("adset_name", { length: 255 }),
    adId: varchar("ad_id", { length: 64 }),
    adName: varchar("ad_name", { length: 255 }),
    performanceDate: varchar("performance_date", { length: 10 }).notNull(),
    adSpend: numeric("ad_spend", { precision: 18, scale: 4 }).notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    purchaseValue: numeric("purchase_value", { precision: 18, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("meta_insights_daily_unique").on(
      table.storeId,
      table.channel,
      table.insightLevel,
      table.entityId,
      table.performanceDate,
    ),
  ],
);

export const googleAdsCustomers = pgTable(
  "google_ads_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    customerId: varchar("customer_id", { length: 32 }).notNull(),
    descriptiveName: varchar("descriptive_name", { length: 255 }).notNull(),
    currencyCode: varchar("currency_code", { length: 3 }),
    isManager: boolean("is_manager").notNull().default(false),
    managerCustomerId: varchar("manager_customer_id", { length: 32 }),
    isSelectedManager: boolean("is_selected_manager").notNull().default(false),
    isSelectedClient: boolean("is_selected_client").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("google_ads_customers_integration_customer_unique").on(
      table.integrationId,
      table.customerId,
    ),
  ],
);

export const googleAdsIntegrationState = pgTable("google_ads_integration_state", {
  integrationId: uuid("integration_id")
    .primaryKey()
    .references(() => integrations.id, { onDelete: "cascade" }),
  pendingManagerSelection: boolean("pending_manager_selection").notNull().default(false),
  pendingClientSelection: boolean("pending_client_selection").notNull().default(false),
  selectedManagerCustomerId: varchar("selected_manager_customer_id", { length: 32 }),
  selectedClientCustomerId: varchar("selected_client_customer_id", { length: 32 }),
  refreshFailureCount: integer("refresh_failure_count").notNull().default(0),
  lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
  lastError: text("last_error"),
  lastInsightsError: text("last_insights_error"),
  insightsBackfillCompleted: boolean("insights_backfill_completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleAdsSyncJobs = pgTable("google_ads_sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id")
    .notNull()
    .references(() => integrations.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleAdsShoppingPerformanceDaily = pgTable(
  "google_ads_shopping_performance_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    campaignId: varchar("campaign_id", { length: 64 }).notNull(),
    campaignName: varchar("campaign_name", { length: 255 }).notNull(),
    productItemId: varchar("product_item_id", { length: 255 }).notNull(),
    productTitle: varchar("product_title", { length: 512 }).notNull(),
    performanceDate: varchar("performance_date", { length: 10 }).notNull(),
    adSpend: numeric("ad_spend", { precision: 18, scale: 4 }).notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    conversions: numeric("conversions", { precision: 18, scale: 4 }).notNull().default("0"),
    conversionValue: numeric("conversion_value", { precision: 18, scale: 4 }).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("google_ads_shopping_performance_daily_unique").on(
      table.storeId,
      table.campaignId,
      table.productItemId,
      table.performanceDate,
    ),
  ],
);

export const profitLeaks = pgTable(
  "profit_leaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    leakType: varchar("leak_type", { length: 50 }).notNull(),
    externalKey: varchar("external_key", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    severity: alertSeverityEnum("severity").notNull().default("warning"),
    amountAtRiskUsd: numeric("amount_at_risk_usd", { precision: 18, scale: 4 }),
    evidence: jsonb("evidence").$type<Array<Record<string, unknown>>>(),
    dedupeKey: varchar("dedupe_key", { length: 255 }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("profit_leaks_store_dedupe_unique").on(table.storeId, table.dedupeKey)],
);

export const plaidTransactionCategoryEnum = pgEnum("plaid_transaction_category", [
  "shopify_payout",
  "ad_spend",
  "cogs_payment",
  "payroll",
  "saas",
  "other",
  "uncategorized",
]);

export const plaidClassificationBatchStatusEnum = pgEnum("plaid_classification_batch_status", [
  "pending",
  "completed",
]);

export const plaidIntegrationState = pgTable("plaid_integration_state", {
  integrationId: uuid("integration_id")
    .primaryKey()
    .references(() => integrations.id, { onDelete: "cascade" }),
  transactionsCursor: text("transactions_cursor"),
  initialSyncCompleted: boolean("initial_sync_completed").notNull().default(false),
  oldestTransactionDate: varchar("oldest_transaction_date", { length: 10 }),
  lastTransactionSyncAt: timestamp("last_transaction_sync_at", { withTimezone: true }),
  lastBalanceSnapshotAt: timestamp("last_balance_snapshot_at", { withTimezone: true }),
  lastBankBalance: numeric("last_bank_balance", { precision: 18, scale: 4 }),
  lastBankAvailableBalance: numeric("last_bank_available_balance", { precision: 18, scale: 4 }),
  bankCurrency: varchar("bank_currency", { length: 3 }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plaidTransactions = pgTable(
  "plaid_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    plaidTransactionId: varchar("plaid_transaction_id", { length: 64 }).notNull(),
    plaidAccountId: varchar("plaid_account_id", { length: 64 }).notNull(),
    transactionDate: varchar("transaction_date", { length: 10 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    name: text("name").notNull(),
    merchantName: varchar("merchant_name", { length: 255 }),
    plaidCategories: jsonb("plaid_categories").$type<string[]>(),
    category: plaidTransactionCategoryEnum("category").notNull().default("uncategorized"),
    pending: boolean("pending").notNull().default(false),
    removed: boolean("removed").notNull().default(false),
    classificationBatchId: uuid("classification_batch_id").references(() => plaidClassificationBatches.id, {
      onDelete: "set null",
    }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plaid_transactions_store_txn_unique").on(table.storeId, table.plaidTransactionId),
  ],
);

export const plaidClassificationBatches = pgTable("plaid_classification_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  status: plaidClassificationBatchStatusEnum("status").notNull().default("pending"),
  transactionCount: integer("transaction_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const plaidClassificationQueue = pgTable(
  "plaid_classification_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    plaidTransactionId: uuid("plaid_transaction_id")
      .notNull()
      .references(() => plaidTransactions.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => plaidClassificationBatches.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plaid_classification_queue_txn_unique").on(table.plaidTransactionId),
  ],
);

export const payoutMatchSourceEnum = pgEnum("payout_match_source", ["auto", "manual"]);

export const payoutMatchStatusEnum = pgEnum("payout_match_status", ["active", "unlinked"]);

export const payoutDepositMatches = pgTable(
  "payout_deposit_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    shopifyPayoutRowId: uuid("shopify_payout_row_id")
      .notNull()
      .references(() => shopifyPayouts.id, { onDelete: "cascade" }),
    plaidTransactionRowId: uuid("plaid_transaction_row_id")
      .notNull()
      .references(() => plaidTransactions.id, { onDelete: "cascade" }),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull(),
    matchSource: payoutMatchSourceEnum("match_source").notNull(),
    status: payoutMatchStatusEnum("status").notNull().default("active"),
    matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
    unlinkedAt: timestamp("unlinked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_deposit_matches_payout_active_unique")
      .on(table.shopifyPayoutRowId)
      .where(sql`status = 'active'`),
    uniqueIndex("payout_deposit_matches_deposit_active_unique")
      .on(table.plaidTransactionRowId)
      .where(sql`status = 'active'`),
  ],
);

export const payoutMatchAuditLog = pgTable("payout_match_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").references(() => payoutDepositMatches.id, { onDelete: "set null" }),
  shopifyPayoutRowId: uuid("shopify_payout_row_id")
    .notNull()
    .references(() => shopifyPayouts.id, { onDelete: "cascade" }),
  plaidTransactionRowId: uuid("plaid_transaction_row_id")
    .notNull()
    .references(() => plaidTransactions.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 20 }).notNull(),
  source: payoutMatchSourceEnum("source").notNull(),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quickbooksAccountCategoryEnum = pgEnum("quickbooks_account_category", [
  "cogs",
  "shipping",
  "marketing",
  "opex",
  "other",
  "unmapped",
]);

export const quickbooksTransactionTypeEnum = pgEnum("quickbooks_transaction_type", [
  "bill",
  "purchase",
  "deposit",
]);

export const quickbooksCompanies = pgTable(
  "quickbooks_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    realmId: varchar("realm_id", { length: 64 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    country: varchar("country", { length: 2 }),
    isSelected: boolean("is_selected").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quickbooks_companies_integration_realm_unique").on(
      table.integrationId,
      table.realmId,
    ),
  ],
);

export const quickbooksIntegrationState = pgTable("quickbooks_integration_state", {
  integrationId: uuid("integration_id")
    .primaryKey()
    .references(() => integrations.id, { onDelete: "cascade" }),
  pendingCompanySelection: boolean("pending_company_selection").notNull().default(false),
  refreshFailureCount: integer("refresh_failure_count").notNull().default(0),
  lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  reauthDueAt: timestamp("reauth_due_at", { withTimezone: true }),
  needsReauth: boolean("needs_reauth").notNull().default(false),
  syncFailureCount: integer("sync_failure_count").notNull().default(0),
  lastBooksSyncAt: timestamp("last_books_sync_at", { withTimezone: true }),
  lastBooksSyncError: text("last_books_sync_error"),
  booksInitialSyncCompleted: boolean("books_initial_sync_completed").notNull().default(false),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quickbooksAccounts = pgTable(
  "quickbooks_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    qboAccountId: varchar("qbo_account_id", { length: 64 }).notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 100 }),
    accountSubtype: varchar("account_subtype", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quickbooks_accounts_store_qbo_account_unique").on(table.storeId, table.qboAccountId),
  ],
);

export const quickbooksAccountMappings = pgTable(
  "quickbooks_account_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    qboAccountId: varchar("qbo_account_id", { length: 64 }).notNull(),
    morganCategory: quickbooksAccountCategoryEnum("morgan_category").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quickbooks_account_mappings_store_account_unique").on(
      table.storeId,
      table.qboAccountId,
    ),
  ],
);

export const quickbooksPnlSnapshots = pgTable(
  "quickbooks_pnl_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    periodMonth: varchar("period_month", { length: 7 }).notNull(),
    asOfDay: varchar("as_of_day", { length: 10 }).notNull(),
    totalIncome: numeric("total_income", { precision: 18, scale: 4 }).notNull().default("0"),
    cogsTotal: numeric("cogs_total", { precision: 18, scale: 4 }).notNull().default("0"),
    shippingTotal: numeric("shipping_total", { precision: 18, scale: 4 }).notNull().default("0"),
    marketingTotal: numeric("marketing_total", { precision: 18, scale: 4 }).notNull().default("0"),
    opexTotal: numeric("opex_total", { precision: 18, scale: 4 }).notNull().default("0"),
    categoryTotals: jsonb("category_totals").notNull().default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quickbooks_pnl_snapshots_store_month_day_unique").on(
      table.storeId,
      table.periodMonth,
      table.asOfDay,
    ),
  ],
);

export const quickbooksTransactions = pgTable(
  "quickbooks_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    qboTxnId: varchar("qbo_txn_id", { length: 64 }).notNull(),
    txnType: quickbooksTransactionTypeEnum("txn_type").notNull(),
    txnDate: varchar("txn_date", { length: 10 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    accountIds: jsonb("account_ids").notNull().default([]),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quickbooks_transactions_store_txn_unique").on(
      table.storeId,
      table.qboTxnId,
      table.txnType,
    ),
  ],
);

export const xeroTransactionTypeEnum = pgEnum("xero_transaction_type", [
  "invoice",
  "bank_spend",
  "bank_receive",
]);

export const xeroTenants = pgTable(
  "xero_tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    connectionId: varchar("connection_id", { length: 64 }).notNull(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    tenantName: varchar("tenant_name", { length: 255 }).notNull(),
    tenantType: varchar("tenant_type", { length: 50 }),
    isSelected: boolean("is_selected").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("xero_tenants_integration_tenant_unique").on(table.integrationId, table.tenantId),
  ],
);

export const xeroIntegrationState = pgTable("xero_integration_state", {
  integrationId: uuid("integration_id")
    .primaryKey()
    .references(() => integrations.id, { onDelete: "cascade" }),
  pendingTenantSelection: boolean("pending_tenant_selection").notNull().default(false),
  refreshFailureCount: integer("refresh_failure_count").notNull().default(0),
  lastTokenRefreshAt: timestamp("last_token_refresh_at", { withTimezone: true }),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  reauthDueAt: timestamp("reauth_due_at", { withTimezone: true }),
  needsReauth: boolean("needs_reauth").notNull().default(false),
  syncFailureCount: integer("sync_failure_count").notNull().default(0),
  lastBooksSyncAt: timestamp("last_books_sync_at", { withTimezone: true }),
  lastBooksSyncError: text("last_books_sync_error"),
  booksInitialSyncCompleted: boolean("books_initial_sync_completed").notNull().default(false),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const xeroAccounts = pgTable(
  "xero_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    xeroAccountId: varchar("xero_account_id", { length: 64 }).notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountType: varchar("account_type", { length: 100 }),
    accountSubtype: varchar("account_subtype", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("xero_accounts_store_xero_account_unique").on(table.storeId, table.xeroAccountId),
  ],
);

export const xeroAccountMappings = pgTable(
  "xero_account_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    xeroAccountId: varchar("xero_account_id", { length: 64 }).notNull(),
    morganCategory: quickbooksAccountCategoryEnum("morgan_category").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("xero_account_mappings_store_account_unique").on(
      table.storeId,
      table.xeroAccountId,
    ),
  ],
);

export const xeroPnlSnapshots = pgTable(
  "xero_pnl_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    periodMonth: varchar("period_month", { length: 7 }).notNull(),
    asOfDay: varchar("as_of_day", { length: 10 }).notNull(),
    totalIncome: numeric("total_income", { precision: 18, scale: 4 }).notNull().default("0"),
    cogsTotal: numeric("cogs_total", { precision: 18, scale: 4 }).notNull().default("0"),
    shippingTotal: numeric("shipping_total", { precision: 18, scale: 4 }).notNull().default("0"),
    marketingTotal: numeric("marketing_total", { precision: 18, scale: 4 }).notNull().default("0"),
    opexTotal: numeric("opex_total", { precision: 18, scale: 4 }).notNull().default("0"),
    categoryTotals: jsonb("category_totals").notNull().default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("xero_pnl_snapshots_store_month_day_unique").on(
      table.storeId,
      table.periodMonth,
      table.asOfDay,
    ),
  ],
);

export const xeroTransactions = pgTable(
  "xero_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    xeroTxnId: varchar("xero_txn_id", { length: 64 }).notNull(),
    txnType: xeroTransactionTypeEnum("txn_type").notNull(),
    txnDate: varchar("txn_date", { length: 10 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GBP"),
    accountIds: jsonb("account_ids").notNull().default([]),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("xero_transactions_store_txn_unique").on(
      table.storeId,
      table.xeroTxnId,
      table.txnType,
    ),
  ],
);

export const cashRunwaySnapshots = pgTable(
  "cash_runway_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    asOfDay: varchar("as_of_day", { length: 10 }).notNull(),
    currentBalance: numeric("current_balance", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    avgDailyNetOutflow: numeric("avg_daily_net_outflow", { precision: 18, scale: 4 }).notNull(),
    runwayDays: numeric("runway_days", { precision: 10, scale: 2 }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cash_runway_snapshots_store_day_unique").on(table.storeId, table.asOfDay),
  ],
);

export const plaidBankAccounts = pgTable(
  "plaid_bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    plaidAccountId: varchar("plaid_account_id", { length: 64 }).notNull(),
    plaidItemId: varchar("plaid_item_id", { length: 64 }).notNull(),
    institutionName: varchar("institution_name", { length: 255 }),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountMask: varchar("account_mask", { length: 4 }),
    accountType: varchar("account_type", { length: 50 }).notNull(),
    accountSubtype: varchar("account_subtype", { length: 50 }),
    isPrimary: boolean("is_primary").notNull().default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plaid_bank_accounts_integration_account_unique").on(
      table.integrationId,
      table.plaidAccountId,
    ),
  ],
);

export const revenueForecastRuns = pgTable(
  "revenue_forecast_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    asOfDay: varchar("as_of_day", { length: 10 }).notNull(),
    horizonDays: integer("horizon_days").notNull().default(30),
    historyDays: integer("history_days").notNull(),
    mape: numeric("mape", { precision: 8, scale: 4 }),
    model: varchar("model", { length: 50 }).notNull().default("prophet"),
    status: varchar("status", { length: 50 }).notNull(),
    message: text("message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("revenue_forecast_runs_store_unique").on(table.storeId)],
);

export const revenueForecastPoints = pgTable(
  "revenue_forecast_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => revenueForecastRuns.id, { onDelete: "cascade" }),
    forecastDay: varchar("forecast_day", { length: 10 }).notNull(),
    p10: numeric("p10", { precision: 18, scale: 4 }).notNull(),
    p50: numeric("p50", { precision: 18, scale: 4 }).notNull(),
    p90: numeric("p90", { precision: 18, scale: 4 }).notNull(),
    cumulativeP10: numeric("cumulative_p10", { precision: 18, scale: 4 }).notNull(),
    cumulativeP50: numeric("cumulative_p50", { precision: 18, scale: 4 }).notNull(),
    cumulativeP90: numeric("cumulative_p90", { precision: 18, scale: 4 }).notNull(),
  },
  (table) => [
    uniqueIndex("revenue_forecast_points_run_day_unique").on(table.runId, table.forecastDay),
  ],
);

export const cashForecastAssumptions = pgTable("cash_forecast_assumptions", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  expectedDailyAdSpendUsd: numeric("expected_daily_ad_spend_usd", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  plannedInventoryPurchaseUsd: numeric("planned_inventory_purchase_usd", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
  plannedInventoryPurchaseDay: varchar("planned_inventory_purchase_day", { length: 10 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skuDemandForecastRuns = pgTable(
  "sku_demand_forecast_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    asOfDay: varchar("as_of_day", { length: 10 }).notNull(),
    horizonDays: integer("horizon_days").notNull().default(30),
    skuCount: integer("sku_count").notNull().default(0),
    status: varchar("status", { length: 50 }).notNull(),
    message: text("message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sku_demand_forecast_runs_store_unique").on(table.storeId)],
);

export const skuDemandForecastItems = pgTable(
  "sku_demand_forecast_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => skuDemandForecastRuns.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 255 }).notNull(),
    revenueRank: integer("revenue_rank").notNull(),
    model: varchar("model", { length: 50 }).notNull(),
    historyDays: integer("history_days").notNull(),
    zeroDayRatio: numeric("zero_day_ratio", { precision: 8, scale: 4 }),
    avgDailyUnits: numeric("avg_daily_units", { precision: 18, scale: 4 }).notNull(),
    forecastUnitsTotal: numeric("forecast_units_total", { precision: 18, scale: 4 }).notNull(),
  },
  (table) => [uniqueIndex("sku_demand_forecast_items_run_sku_unique").on(table.runId, table.sku)],
);

export const skuDemandForecastPoints = pgTable(
  "sku_demand_forecast_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => skuDemandForecastRuns.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 255 }).notNull(),
    forecastDay: varchar("forecast_day", { length: 10 }).notNull(),
    units: numeric("units", { precision: 18, scale: 4 }).notNull(),
  },
  (table) => [
    uniqueIndex("sku_demand_forecast_points_run_sku_day_unique").on(
      table.runId,
      table.sku,
      table.forecastDay,
    ),
  ],
);

export const recommendationCandidates = pgTable(
  "recommendation_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    engine: varchar("engine", { length: 50 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    impactLowUsd: numeric("impact_low_usd", { precision: 18, scale: 4 }).notNull(),
    impactHighUsd: numeric("impact_high_usd", { precision: 18, scale: 4 }).notNull(),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    effort: varchar("effort", { length: 20 }).notNull(),
    evidence: jsonb("evidence").$type<Array<Record<string, unknown>>>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    similarityHash: varchar("similarity_hash", { length: 255 }).notNull(),
    subjectSku: varchar("subject_sku", { length: 255 }),
    sourceKey: varchar("source_key", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    generatedDay: varchar("generated_day", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recommendation_candidates_store_hash_idx").on(table.storeId, table.similarityHash),
    index("recommendation_candidates_store_day_idx").on(table.storeId, table.generatedDay),
  ],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").references(() => recommendationCandidates.id, {
      onDelete: "set null",
    }),
    engine: varchar("engine", { length: 50 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    impactLowUsd: numeric("impact_low_usd", { precision: 18, scale: 4 }).notNull(),
    impactHighUsd: numeric("impact_high_usd", { precision: 18, scale: 4 }).notNull(),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    effort: varchar("effort", { length: 20 }).notNull(),
    rankScore: numeric("rank_score", { precision: 18, scale: 4 }).notNull(),
    rankPosition: integer("rank_position").notNull(),
    subjectSku: varchar("subject_sku", { length: 255 }),
    evidence: jsonb("evidence").$type<Array<Record<string, unknown>>>().notNull().default([]),
    status: varchar("status", { length: 50 }).notNull().default("open"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    generatedDay: varchar("generated_day", { length: 10 }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recommendations_store_status_idx").on(table.storeId, table.status),
    index("recommendations_store_day_idx").on(table.storeId, table.generatedDay),
  ],
);

