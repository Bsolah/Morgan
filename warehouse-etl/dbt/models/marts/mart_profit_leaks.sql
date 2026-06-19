{{ serving_mart_config('day') }}

select
    store_id,
    toDate(day) as day,
    leak_type,
    external_key,
    status,
    severity,
    sum(coalesce(amount_at_risk_usd, toDecimal64(0, 4))) as amount_at_risk_usd,
    count(*) as leak_count,
    max(updated_at) as last_detected_at,
    now64(3) as refreshed_at
from {{ ref('stg_profit_leaks') }}
group by
    store_id,
    day,
    leak_type,
    external_key,
    status,
    severity
