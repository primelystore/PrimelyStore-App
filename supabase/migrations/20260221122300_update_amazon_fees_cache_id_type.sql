alter table public.amazon_fees_cache
  add column if not exists id_type text not null default 'SKU',
  add column if not exists identifier text;

update public.amazon_fees_cache
set identifier = sku
where identifier is null;

create index if not exists amazon_fees_cache_lookup_v2
on public.amazon_fees_cache (marketplace_id, id_type, identifier, fulfillment, price_brl, expires_at);
