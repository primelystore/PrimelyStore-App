create table if not exists public.produto_calculos (
  id bigserial primary key,
  produto_id uuid references public.produtos(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  preco_venda numeric not null,
  imposto_pct numeric default 0,
  margem_pct numeric default 0,
  bep_preco numeric default 0,
  roas_ideal numeric default 0,
  lucro_liquido numeric default 0,
  roi_pct numeric default 0,
  fonte_taxas text default 'MANUAL'
);

create index if not exists produto_calculos_produto_id_created_at_idx 
on public.produto_calculos (produto_id, created_at desc);

-- RLS Setup
alter table public.produto_calculos enable row level security;

create policy "produto_calculos_select_authenticated"
on public.produto_calculos for select
to authenticated
using (true);

create policy "produto_calculos_insert_authenticated"
on public.produto_calculos for insert
to authenticated
with check (true);
