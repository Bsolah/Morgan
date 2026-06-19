with source_events as (
    select
        event_id,
        store_id,
        event_type,
        occurred_at,
        shop_domain,
        order_id,
        payload_json,
        ingested_at,
        row_number() over (
            partition by store_id, order_id
            order by occurred_at desc, ingested_at desc
        ) as row_num
    from {{ source('raw', 'shopify_order_events') }}
    where order_id is not null
      and event_type in ('orders.create', 'orders.updated', 'orders.backfill')
),

parsed as (
    select
        event_id,
        store_id,
        event_type,
        toDate(occurred_at) as order_day,
        occurred_at,
        shop_domain,
        order_id,
        JSONExtractString(payload_json, 'currency') as currency,
        toDecimal64OrZero(JSONExtractString(payload_json, 'total_price'), 4) as gross_revenue,
        toDecimal64OrZero(JSONExtractString(payload_json, 'total_discounts'), 4) as total_discounts,
        toDecimal64OrZero(JSONExtractString(payload_json, 'total_tax'), 4) as total_tax,
        toDecimal64OrZero(JSONExtractString(payload_json, 'total_shipping_price_set', 'shop_money', 'amount'), 4) as shipping_revenue,
        JSONExtractString(payload_json, 'financial_status') as financial_status,
        JSONExtractString(payload_json, 'fulfillment_status') as fulfillment_status,
        ingested_at
    from source_events
    where row_num = 1
)

select *
from parsed
