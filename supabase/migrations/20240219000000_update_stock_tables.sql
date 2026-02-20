-- Migration: Allow NULLs and Add Constraints for Strict Stock Logic

-- 1. Allow NULLs in deposito columns (Essential for 'entrada' and 'saida')
ALTER TABLE public.estoque_movimentacoes 
ALTER COLUMN deposito_origem DROP NOT NULL;

ALTER TABLE public.estoque_movimentacoes 
ALTER COLUMN deposito_destino DROP NOT NULL;

-- 2. Add Validator Constraint (Optional but recommended)
-- Ensure 'entrada' has destination, 'saida' has origin, 'transferencia' has both.
-- Using SAFE updates (Check existing data before applying strict constraints, 
-- or use NOT VALID initially).

ALTER TABLE public.estoque_movimentacoes 
ADD CONSTRAINT check_movimento_validity 
CHECK (
  (tipo = 'entrada' AND deposito_destino IS NOT NULL) OR
  (tipo = 'saida' AND deposito_origem IS NOT NULL) OR
  (tipo = 'transferencia' AND deposito_origem IS NOT NULL AND deposito_destino IS NOT NULL)
) NOT VALID;

-- Validate the constraint for future inserts
ALTER TABLE public.estoque_movimentacoes 
VALIDATE CONSTRAINT check_movimento_validity;

-- 3. Indexes for Performance (Filtering by Product and Date is common)
CREATE INDEX IF NOT EXISTS idx_estoque_produto_data 
ON public.estoque_movimentacoes (produto_id, data_movimentacao, created_at);

CREATE INDEX IF NOT EXISTS idx_estoque_tipo 
ON public.estoque_movimentacoes (tipo);
