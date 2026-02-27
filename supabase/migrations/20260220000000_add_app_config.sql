-- Migration: Add Global App Configuration (single-row table)

-- This table stores configuration that must be shared across devices (e.g., default sales tax).
-- It is designed as a SINGLE-ROW table (id=1).

CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY DEFAULT 1,
  imposto_venda_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_single_row CHECK (id = 1)
);

-- Ensure the single row exists
INSERT INTO public.app_config (id, imposto_venda_pct)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_config_set_updated_at ON public.app_config;
CREATE TRIGGER trg_app_config_set_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
