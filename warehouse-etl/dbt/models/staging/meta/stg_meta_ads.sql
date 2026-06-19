select
    store_id,
    channel,
    insight_level,
    entity_id,
    entity_name,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name,
    performance_date as day,
    toDecimal64OrZero(ad_spend, 4) as ad_spend,
    impressions,
    clicks,
    purchases,
    toDecimal64OrZero(purchase_value, 4) as purchase_value,
    updated_at,
    ingested_at
from {{ source('raw', 'meta_insights_daily') }}
where insight_level = 'campaign'
