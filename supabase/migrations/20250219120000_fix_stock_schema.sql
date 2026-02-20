-- Migration: Fix Stock Schema (Allow NULLs for strict logic + Create Ledger)

-- 1. Allow NULLs in deposit columns (Critical for 'entrada' and 'saida')
ALTER TABLE public.estoque_movimentacoes 
ALTER COLUMN deposito_origem DROP NOT NULL;

ALTER TABLE public.estoque_movimentacoes 
ALTER COLUMN deposito_destino DROP NOT NULL;

-- 2. Add Validator Constraint (Strict logic)
-- Using NOT VALID first to avoid blocking existing invalid data
ALTER TABLE public.estoque_movimentacoes 
ADD CONSTRAINT check_movimento_validity 
CHECK (
  (tipo = 'entrada' AND deposito_origem IS NULL AND deposito_destino IS NOT NULL) OR
  (tipo = 'saida' AND deposito_origem IS NOT NULL AND deposito_destino IS NULL) OR
  (tipo = 'transferencia' AND deposito_origem IS NOT NULL AND deposito_destino IS NOT NULL AND deposito_origem <> deposito_destino)
) NOT VALID;

-- Validate constraint (if data is clean, otherwise user must clean it)
-- ALTER TABLE public.estoque_movimentacoes VALIDATE CONSTRAINT check_movimento_validity;

-- 3. Create Ledger Table for Audit / Costing
CREATE TABLE IF NOT EXISTS public.estoque_custos_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    movimentacao_id uuid REFERENCES public.estoque_movimentacoes(id) ON DELETE CASCADE,
    metodo text CHECK (metodo IN ('cmp', 'fifo')) NOT NULL,
    produto_id uuid NOT NULL, -- De-normalized for easier querying
    tipo text NOT NULL,
    deposito_origem text,
    deposito_destino text,
    quantidade integer NOT NULL,
    
    -- Cost Applied
    custo_unit_aplicado numeric, -- Store as decimal for flexibility
    custo_total_movimento numeric,

    -- Balances After Snapshot
    saldo_qtd_origem integer,
    saldo_custo_origem numeric,
    saldo_qtd_destino integer,
    saldo_custo_destino numeric,

    created_at timestamptz DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_movimento_metodo ON public.estoque_custos_ledger(movimentacao_id, metodo);
CREATE INDEX IF NOT EXISTS idx_ledger_produto_metodo_created ON public.estoque_custos_ledger(produto_id, metodo, created_at);

-- 5. Indexes on movements for sorting
CREATE INDEX IF NOT EXISTS idx_movimentos_sort_composite ON public.estoque_movimentacoes(data_movimentacao, created_at, id);
