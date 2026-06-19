select
    store_id,
    id as leak_id,
    leak_type,
    external_key,
    status,
    severity,
    toDate(updated_at) as day,
    toDecimal64OrNull(amount_at_risk_usd, 4) as amount_at_risk_usd,
    dedupe_key,
    updated_at,
    ingested_at
from {{ source('raw', 'profit_leaks') }}
where status = 'active'
