select
    recommendation_id,
    store_id,
    engine,
    category,
    title,
    body,
    toDecimal64OrNull(impact_low_usd, 4) as impact_low_usd,
    toDecimal64OrNull(impact_high_usd, 4) as impact_high_usd,
    confidence,
    effort,
    status,
    expires_at,
    created_at,
    updated_at,
    ingested_at
from {{ source('raw', 'recommendations') }}
