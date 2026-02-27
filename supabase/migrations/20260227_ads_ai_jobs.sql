-- Migration: ads_ai_jobs
-- Tabela para jobs assíncronos de IA (integração n8n)
-- RLS RESTRITIVO: nenhuma policy para anon.
-- Acesso SOMENTE via Edge Functions com service_role key.

CREATE TABLE IF NOT EXISTS public.ads_ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_token UUID NOT NULL DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','OK','NEEDS_INPUT','API_ERROR')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB,
    render_markdown TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS (bloqueia tudo por padrão para anon)
ALTER TABLE public.ads_ai_jobs ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy SELECT/INSERT/UPDATE para anon.
-- Edge Functions usam service_role key (bypass RLS completo).

-- Index para lookup rápido por id + public_token
CREATE INDEX IF NOT EXISTS idx_ads_ai_jobs_id_token
    ON public.ads_ai_jobs (id, public_token);
