import { z } from 'https://esm.sh/zod@3.22.4';
import { Deposito } from './types.ts';

export const MovementSchema = z.object({
    id: z.string().uuid(),
    produto_id: z.string(),
    tipo: z.enum(['entrada', 'saida', 'transferencia']),
    deposito_origem: z.enum(['prep_center', 'amazon_fba', 'full_ml']).nullable(),
    deposito_destino: z.enum(['prep_center', 'amazon_fba', 'full_ml']).nullable(),
    quantidade: z.number().int().positive(),
    data_movimentacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
    created_at: z.string().datetime(),
    custo_total_informado: z.nullable(z.union([z.number(), z.string()])).optional(), // Can be null, number or string (from numeric)
    custo_unitario_informado: z.nullable(z.union([z.number(), z.string()])).optional(),
});

// Strict Validation Logic
export const validateMovementRules = (data: z.infer<typeof MovementSchema>) => {
    if (data.tipo === 'entrada') {
        if (data.deposito_origem !== null) return "Entrada não pode ter origem";
        if (data.deposito_destino === null) return "Entrada deve ter destino";
    }
    if (data.tipo === 'saida') {
        if (data.deposito_origem === null) return "Saída deve ter origem";
        if (data.deposito_destino !== null) return "Saída não pode ter destino";
    }
    if (data.tipo === 'transferencia') {
        if (data.deposito_origem === null) return "Transferência deve ter origem";
        if (data.deposito_destino === null) return "Transferência deve ter destino";
        if (data.deposito_origem === data.deposito_destino) return "Origem e destino devem ser diferentes";
    }
    return null;
};
