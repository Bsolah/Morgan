-- Line-level economics (full contribution margin) are computed in
-- @morgan/integrations finance/contribution-margin.ts during POAS refresh.
-- This staging model exposes raw line revenue and Shopify unit cost for marts.
select
    store_id,
    order_id,
    line_id,
    variant_id,
    sku,
    quantity,
    toDecimal64OrZero(gross_revenue, 4) as gross_revenue,
    toDecimal64OrNull(unit_cost, 4) as unit_cost,
    toDecimal64OrZero(gross_revenue, 4)
        - (toDecimal64OrNull(unit_cost, 4) * quantity) as line_contribution_margin,
    toDate(ordered_at) as order_day,
    ordered_at,
    ingested_at
from {{ source('raw', 'fact_order_lines') }}
