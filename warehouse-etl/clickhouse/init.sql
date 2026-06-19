-- Morgan warehouse raw + mirror tables for dbt silver/gold transforms.
-- Apply against ClickHouse: clickhouse-client --multiquery < init.sql

CREATE DATABASE IF NOT EXISTS morgan;

-- Ingest facts (MergeTree)
CREATE TABLE IF NOT EXISTS morgan.shopify_order_events (
    event_id UUID,
    store_id UUID,
    event_type String,
    occurred_at DateTime64(3, 'UTC'),
    shop_domain Nullable(String),
    order_id Nullable(String),
    payload_json String,
    ingested_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (store_id, order_id, occurred_at, event_id);

CREATE TABLE IF NOT EXISTS morgan.dim_products (
    store_id UUID,
    product_id String,
    variant_id String,
    inventory_item_id Nullable(String),
    sku String,
    title String,
    price Decimal(18, 4),
    unit_cost Nullable(Decimal(18, 4)),
    is_active UInt8,
    updated_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (store_id, variant_id);

CREATE TABLE IF NOT EXISTS morgan.fact_order_lines (
    store_id UUID,
    order_id String,
    line_id String,
    variant_id Nullable(String),
    sku Nullable(String),
    quantity Int32,
    gross_revenue Decimal(18, 4),
    unit_cost Nullable(Decimal(18, 4)),
    ordered_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(ordered_at)
ORDER BY (store_id, order_id, line_id);

-- Postgres mirrors (PostgreSQL table engine; configure host/db/user/password via env substitution in deploy)
CREATE TABLE IF NOT EXISTS morgan.meta_insights_daily (
    store_id UUID,
    channel String,
    insight_level String,
    entity_id String,
    entity_name String,
    campaign_id Nullable(String),
    campaign_name Nullable(String),
    adset_id Nullable(String),
    adset_name Nullable(String),
    ad_id Nullable(String),
    ad_name Nullable(String),
    performance_date String,
    ad_spend Decimal(18, 4),
    impressions Int32,
    clicks Int32,
    purchases Int32,
    purchase_value Decimal(18, 4),
    updated_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
ORDER BY (store_id, channel, insight_level, entity_id, performance_date);

CREATE TABLE IF NOT EXISTS morgan.google_ads_shopping_performance_daily (
    store_id UUID,
    campaign_id String,
    campaign_name String,
    product_item_id String,
    product_title String,
    performance_date String,
    ad_spend Decimal(18, 4),
    impressions Int32,
    clicks Int32,
    conversions Decimal(18, 4),
    conversion_value Decimal(18, 4),
    updated_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = MergeTree()
ORDER BY (store_id, campaign_id, product_item_id, performance_date);

CREATE TABLE IF NOT EXISTS morgan.profit_leaks (
    id UUID,
    store_id UUID,
    leak_type String,
    external_key String,
    status String,
    severity String,
    amount_at_risk_usd Nullable(Decimal(18, 4)),
    dedupe_key String,
    updated_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (store_id, dedupe_key);

CREATE TABLE IF NOT EXISTS morgan.recommendations (
    recommendation_id UUID,
    store_id UUID,
    engine String,
    category String,
    title String,
    body String,
    impact_low_usd Nullable(Decimal(18, 4)),
    impact_high_usd Nullable(Decimal(18, 4)),
    confidence Nullable(String),
    effort Nullable(String),
    status String,
    expires_at Nullable(DateTime64(3, 'UTC')),
    created_at DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC')
) ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (recommendation_id);
