import { Movement, MovementNormalized, TipoMov, Deposito } from './types';
import { money } from './money';
import { z } from 'zod';

export function normalizeMoves(moves: Movement[]): MovementNormalized[] {
    return moves.map(m => {
        // Validation could happen here or before calling this.
        // We assume basic shape is correct or use Schema validation if strict.

        const dataMov = m.data_movimentacao;
        const createdAt = m.created_at;

        // Construct Sort Key: YYYY-MM-DD + ISO_TIMESTAMP + ID
        // To be safe, ensure ISO timestamp is comparable string.
        const sortKey = `${dataMov}|${createdAt}|${m.id}`;

        const normalized: MovementNormalized = {
            id: m.id,
            produtoId: m.produto_id,
            tipo: m.tipo as TipoMov,
            origem: m.deposito_origem as Deposito | null,
            destino: m.deposito_destino as Deposito | null,
            quantidade: m.quantidade,
            dataMov: dataMov,
            createdAt: createdAt,
            occurredAt: new Date(createdAt), // conceptual
            sortKey: sortKey,
            // Costs
            custoInformadoUnit: m.custo_unitario_informado ? money(m.custo_unitario_informado) : undefined,
            custoInformadoTotal: m.custo_total_informado ? money(m.custo_total_informado) : undefined
        };
        return normalized;
    });
}

export function sortMovements(moves: MovementNormalized[]): MovementNormalized[] {
    return moves.sort((a, b) => {
        if (a.sortKey < b.sortKey) return -1;
        if (a.sortKey > b.sortKey) return 1;
        return 0;
    });
}

export function normalizeAndSort(moves: Movement[]): MovementNormalized[] {
    const norm = normalizeMoves(moves);
    return sortMovements(norm);
}
