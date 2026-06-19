{{ config(
    materialized='table',
    database='morgan_serving',
    schema='gold',
    engine='MergeTree()',
    order_by='(store_id, created_at)',
    partition_by='toYYYYMM(toDate(created_at))',
    tags=['gold', 'serving']
) }}

select
    recommendation_id,
    store_id,
    engine,
    category,
    title,
    body,
    impact_low_usd,
    impact_high_usd,
    (impact_low_usd + impact_high_usd) / 2 as impact_mid_usd,
    confidence,
    effort,
    status,
    expires_at,
    created_at,
    updated_at,
    if(status = 'accepted', 'accepted', if(status = 'dismissed', 'dismissed', 'open')) as outcome_status,
    now64(3) as refreshed_at
from {{ ref('stg_recommendations') }}
where status in ('open', 'accepted', 'dismissed', 'expired')
