with ranked as (
    select
        store_id,
        product_id,
        variant_id,
        inventory_item_id,
        sku,
        title,
        toDecimal64OrZero(price, 4) as price,
        toDecimal64OrNull(unit_cost, 4) as unit_cost,
        is_active,
        updated_at,
        ingested_at,
        row_number() over (
            partition by store_id, variant_id
            order by updated_at desc, ingested_at desc
        ) as row_num
    from {{ source('raw', 'dim_products') }}
)

select
    store_id,
    product_id,
    variant_id,
    inventory_item_id,
    sku,
    title,
    price,
    unit_cost,
    is_active,
    updated_at,
    ingested_at
from ranked
where row_num = 1
