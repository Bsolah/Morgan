-- ClickHouse serving layer for the AI SQL agent (US-08-03).
-- Gold marts are materialized here by dbt (morgan_serving.gold.*).
-- Apply: clickhouse-client --multiquery < serving.sql

CREATE DATABASE IF NOT EXISTS morgan_serving;

CREATE TABLE IF NOT EXISTS morgan_serving.gold_mart_orders_daily (
    store_id UUID,
    day Date,
    orders UInt32,
    gross_revenue Decimal(18, 4),
    discounts Decimal(18, 4),
    tax Decimal(18, 4),
    shipping_revenue Decimal(18, 4),
    cogs Decimal(18, 4),
    net_revenue Decimal(18, 4),
    contribution_margin Decimal(18, 4),
    units_sold Int64,
    refreshed_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (store_id, day);

CREATE TABLE IF NOT EXISTS morgan_serving.gold_mart_sku_economics (
    store_id UUID,
    sku String,
    variant_id Nullable(String),
    week_start Date,
    orders_count Int64,
    units_sold Int64,
    gross_revenue Decimal(18, 4),
    cogs Decimal(18, 4),
    contribution_margin Decimal(18, 4),
    unit_margin Decimal(18, 4),
    velocity_per_day Float64,
    return_rate Decimal(18, 4),
    list_price Nullable(Decimal(18, 4)),
    catalog_unit_cost Nullable(Decimal(18, 4)),
    refreshed_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(week_start)
ORDER BY (store_id, week_start);

CREATE TABLE IF NOT EXISTS morgan_serving.gold_mart_ad_performance (
    store_id UUID,
    channel String,
    campaign_id String,
    campaign_name String,
    day Date,
    ad_spend Decimal(18, 4),
    attributed_revenue Decimal(18, 4),
    attributed_contribution_margin Decimal(18, 4),
    impressions Int64,
    clicks Int64,
    purchases Int64,
    purchase_value Decimal(18, 4),
    roas Nullable(Float64),
    poas Nullable(Float64),
    refreshed_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (store_id, day);

CREATE TABLE IF NOT EXISTS morgan_serving.gold_mart_profit_leaks (
    store_id UUID,
    day Date,
    leak_type String,
    external_key String,
    status String,
    severity String,
    amount_at_risk_usd Decimal(18, 4),
    leak_count UInt32,
    last_detected_at DateTime64(3, 'UTC'),
    refreshed_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (store_id, day);

CREATE TABLE IF NOT EXISTS morgan_serving.gold_mart_recommendations (
    recommendation_id UUID,
    store_id UUID,
    engine String,
    category String,
    title String,
    body String,
    impact_low_usd Nullable(Decimal(18, 4)),
    impact_high_usd Nullable(Decimal(18, 4)),
    impact_mid_usd Nullable(Decimal(18, 4)),
    confidence Nullable(String),
    effort Nullable(String),
    status String,
    expires_at Nullable(DateTime64(3, 'UTC')),
    created_at DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC'),
    outcome_status String,
    refreshed_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(toDate(created_at))
ORDER BY (store_id, created_at);

-- Read-only SQL agent credentials (set password via deploy secret management).
CREATE USER IF NOT EXISTS morgan_agent IDENTIFIED WITH plaintext_password BY 'change-me-agent-password';
GRANT SELECT ON morgan_serving.* TO morgan_agent;

-- Writer role used by dbt / ingest (grant separately in production).
-- REVOKE INSERT, ALTER, DROP ON morgan_serving.* FROM morgan_agent;
