{{ serving_mart_config('day') }}

with meta_campaigns as (
    select
        store_id,
        channel,
        campaign_id,
        campaign_name,
        day,
        ad_spend,
        purchase_value as attributed_revenue,
        impressions,
        clicks,
        purchases
    from {{ ref('stg_meta_ads') }}
),

google_campaigns as (
    select
        store_id,
        channel,
        campaign_id,
        campaign_name,
        day,
        ad_spend,
        purchase_value as attributed_revenue,
        impressions,
        clicks,
        purchases
    from {{ ref('stg_google_ads') }}
),

combined as (
    select * from meta_campaigns
    union all
    select * from google_campaigns
)

select
    store_id,
    channel,
    campaign_id,
    campaign_name,
    toDate(day) as day,
    ad_spend,
    attributed_revenue,
    toDecimal64(0, 4) as attributed_contribution_margin,
    impressions,
    clicks,
    purchases,
    attributed_revenue as purchase_value,
    if(ad_spend > 0, attributed_revenue / ad_spend, null) as roas,
    null as poas,
    now64(3) as refreshed_at
from combined
