with source_events as (
    select
        store_id,
        order_id,
        occurred_at,
        payload_json,
        row_number() over (
            partition by store_id, order_id
            order by occurred_at desc, ingested_at desc
        ) as row_num
    from {{ source('raw', 'shopify_order_events') }}
    where order_id is not null
      and event_type in ('orders.create', 'orders.updated', 'orders.backfill', 'refunds.create')
),

latest_orders as (
    select *
    from source_events
    where row_num = 1
),

refund_items as (
    select
        store_id,
        order_id,
        toDate(occurred_at) as refund_day,
        arrayJoin(JSONExtractArrayRaw(payload_json, 'refunds')) as refund_json,
        refund_json
    from latest_orders
    where length(JSONExtractArrayRaw(payload_json, 'refunds')) > 0
),

lines as (
    select
        store_id,
        order_id,
        refund_day,
        arrayJoin(JSONExtractArrayRaw(refund_json, 'refund_line_items')) as refund_line_json
    from refund_items
)

select
    store_id,
    order_id,
    coalesce(
        nullif(JSONExtractString(refund_line_json, 'line_item', 'sku'), ''),
        toString(JSONExtractInt(refund_line_json, 'line_item', 'variant_id')),
        toString(JSONExtractInt(refund_line_json, 'line_item_id'))
    ) as sku_key,
    JSONExtractString(refund_line_json, 'line_item', 'sku') as sku,
    toString(JSONExtractInt(refund_line_json, 'line_item', 'variant_id')) as variant_id,
    toInt64(JSONExtractInt(refund_line_json, 'quantity')) as returned_units,
    refund_day,
    toStartOfWeek(refund_day, 1) as week_start
from lines
where returned_units > 0
