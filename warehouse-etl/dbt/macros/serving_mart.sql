{# Gold marts materialized into morgan_serving for the AI SQL agent. #}
{% macro serving_mart_config(date_column) %}
{{ config(
    materialized='table',
    database='morgan_serving',
    schema='gold',
    engine='MergeTree()',
    order_by='(store_id, ' ~ date_column ~ ')',
    partition_by='toYYYYMM(toDate(' ~ date_column ~ '))',
    tags=['gold', 'serving']
) }}
{% endmacro %}
