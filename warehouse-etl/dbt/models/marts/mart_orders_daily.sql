{{ serving_mart_config('day') }}

with line_metrics as (
    select
        store_id,
        order_day as day,
        sum(gross_revenue) as gross_revenue,
        sum(coalesce(unit_cost, toDecimal64(0, 4)) * quantity) as cogs,
        sum(line_contribution_margin) as contribution_margin,
        sum(quantity) as units_sold,
        count(distinct order_id) as orders_with_lines
    from {{ ref('stg_shopify_order_lines') }}
    group by 1, 2
),

order_metrics as (
    select
        store_id,
        order_day as day,
        count(distinct order_id) as orders,
        sum(gross_revenue) as order_gross_revenue,
        sum(total_discounts) as discounts,
        sum(total_tax) as tax,
        sum(shipping_revenue) as shipping_revenue
    from {{ ref('stg_shopify_orders') }}
    group by 1, 2
)

select
    coalesce(l.store_id, o.store_id) as store_id,
    toDate(coalesce(l.day, o.day)) as day,
    coalesce(o.orders, 0) as orders,
    coalesce(l.gross_revenue, o.order_gross_revenue, toDecimal64(0, 4)) as gross_revenue,
    coalesce(o.discounts, toDecimal64(0, 4)) as discounts,
    coalesce(o.tax, toDecimal64(0, 4)) as tax,
    coalesce(o.shipping_revenue, toDecimal64(0, 4)) as shipping_revenue,
    coalesce(l.cogs, toDecimal64(0, 4)) as cogs,
    coalesce(l.gross_revenue, o.order_gross_revenue, toDecimal64(0, 4))
        - coalesce(o.discounts, toDecimal64(0, 4)) as net_revenue,
    coalesce(l.contribution_margin, toDecimal64(0, 4)) as contribution_margin,
    coalesce(l.units_sold, 0) as units_sold,
    now64(3) as refreshed_at
from line_metrics l
full outer join order_metrics o
    on l.store_id = o.store_id
   and l.day = o.day
