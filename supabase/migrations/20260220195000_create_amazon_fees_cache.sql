-- Tabela de cache para consultas da Amazon SP-API
CREATE TABLE IF NOT EXISTS public.amazon_fees_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marketplace_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    fulfillment TEXT NOT NULL,
    price_brl NUMERIC NOT NULL,
    response JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índice para acelerar a busca no cache
CREATE INDEX IF NOT EXISTS idx_amazon_fees_cache_lookup 
ON public.amazon_fees_cache (marketplace_id, sku, fulfillment, price_brl);

-- Habilita RLS (Row Level Security)
ALTER TABLE public.amazon_fees_cache ENABLE ROW LEVEL SECURITY;

-- Como essa tabela será acessada primariamente via Edge Functions (usando service_role key),
-- não vamos liberar acesso para roles anônimas ou autenticadas via API pública por padrão.
