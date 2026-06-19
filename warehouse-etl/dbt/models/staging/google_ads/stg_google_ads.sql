select
    store_id,
    'google_ads' as channel,
    campaign_id,
    campaign_name,
    product_item_id as product_id,
    product_title,
    performance_date as day,
    toDecimal64OrZero(ad_spend, 4) as ad_spend,
    impressions,
    clicks,
    conversions as purchases,
    toDecimal64OrZero(conversion_value, 4) as purchase_value,
    updated_at,
    ingested_at
from {{ source('raw', 'google_ads_shopping_performance_daily') }}
