{{ serving_mart_config('week_start') }}

with lines as (
    select
        store_id,
        coalesce(nullif(sku, ''), variant_id, line_id) as sku_key,
        sku,
        variant_id,
        toStartOfWeek(order_day, 1) as week_start,
        count(distinct order_id) as orders_count,
        sum(quantity) as units_sold,
        sum(gross_revenue) as gross_revenue,
        sum(coalesce(unit_cost, toDecimal64(0, 4)) * quantity) as cogs,
        sum(line_contribution_margin) as contribution_margin
    from {{ ref('stg_shopify_order_lines') }}
    group by 1, 2, 3, 4, 5
),

returns as (
    select
        store_id,
        sku_key,
        week_start,
        sum(returned_units) as returned_units
    from {{ ref('stg_shopify_refund_lines') }}
    group by 1, 2, 3
),

products as (
    select
        store_id,
        variant_id,
        sku,
        price,
        unit_cost
    from {{ ref('stg_shopify_products') }}
)

select
    l.store_id,
    l.sku_key as sku,
    l.variant_id,
    toDate(l.week_start) as week_start,
    l.orders_count,
    l.units_sold,
    l.gross_revenue,
    l.cogs,
    l.contribution_margin,
    if(l.units_sold > 0, l.contribution_margin / l.units_sold, toDecimal64(0, 4)) as unit_margin,
    if(l.units_sold > 0, l.units_sold / 7.0, 0.0) as velocity_per_day,
    if(
        l.units_sold > 0,
        toDecimal64(coalesce(r.returned_units, 0) / l.units_sold, 4),
        toDecimal64(0, 4)
    ) as return_rate,
    p.price as list_price,
    p.unit_cost as catalog_unit_cost,
    now64(3) as refreshed_at
from lines l
left join returns r
    on l.store_id = r.store_id
   and l.sku_key = r.sku_key
   and l.week_start = r.week_start
left join products p
    on l.store_id = p.store_id
   and l.variant_id = p.variant_id
