import { EngineResult, LedgerEntry, MovementNormalized, ProductStockState, StockPosition, Deposito } from './types';
import { add, sub, mul, div, calcProportional } from './money';

export function computeCMP(movements: MovementNormalized[]): EngineResult {
    const stock = new Map<string, ProductStockState>();
    const ledger: LedgerEntry[] = [];
    const issues: Array<{ movementId: string; message: string }> = [];
    const cogs: Array<{ produtoId: string; deposito: Deposito; qty: number; value: bigint }> = [];

    // Helper to get or create product state
    const getProductState = (pid: string): ProductStockState => {
        if (!stock.has(pid)) {
            stock.set(pid, {
                produtoId: pid,
                positions: {
                    prep_center: { deposito: 'prep_center', quantidade: 0, valorTotal: 0n, custoMedio: 0n },
                    amazon_fba: { deposito: 'amazon_fba', quantidade: 0, valorTotal: 0n, custoMedio: 0n },
                    full_ml: { deposito: 'full_ml', quantidade: 0, valorTotal: 0n, custoMedio: 0n },
                },
                totalQty: 0,
                totalValue: 0n
            });
        }
        return stock.get(pid)!;
    };

    const updatePosition = (pos: StockPosition) => {
        if (pos.quantidade > 0) {
            pos.custoMedio = div(pos.valorTotal, pos.quantidade);
        } else {
            pos.quantidade = 0;
            pos.valorTotal = 0n;
            pos.custoMedio = 0n;
        }
    };

    // Strict validation: Sort order should be guaranteed by caller, but we process in order.
    for (const mov of movements) {
        const pState = getProductState(mov.produtoId);

        const entry: LedgerEntry = {
            movementId: mov.id,
            produtoId: mov.produtoId,
            metodo: 'cmp',
            tipo: mov.tipo,
            origem: mov.origem,
            destino: mov.destino,
            quantidade: mov.quantidade,
            custoUnitarioAplicado: 0n,
            custoTotalMovimento: 0n,
        };

        try {
            if (mov.tipo === 'entrada') {
                if (!mov.destino) throw new Error("Entrada sem destino");
                const dest = pState.positions[mov.destino];

                let custoTotal = 0n;
                if (mov.custoInformadoTotal !== undefined) {
                    custoTotal = mov.custoInformadoTotal;
                } else if (mov.custoInformadoUnit !== undefined) {
                    custoTotal = mul(mov.custoInformadoUnit, mov.quantidade);
                } else {
                    // Critical: No cost info on entry
                    throw new Error("Entrada sem custo informado");
                }

                // Snapshots
                entry.saldoAnteriorDestino = { qtd: dest.quantidade, valor: dest.valorTotal };

                // Apply
                dest.quantidade += mov.quantidade;
                dest.valorTotal = add(dest.valorTotal, custoTotal);
                updatePosition(dest);

                entry.saldoAtualDestino = { qtd: dest.quantidade, valor: dest.valorTotal };
                entry.custoTotalMovimento = custoTotal;
                entry.custoUnitarioAplicado = div(custoTotal, mov.quantidade);

            } else if (mov.tipo === 'saida') {
                if (!mov.origem) throw new Error("Saída sem origem");
                const orig = pState.positions[mov.origem];

                // Strict Stock Check - REMOVIDO: Permitir saldo negativo (vendas sem entrada registrada)
                if (orig.quantidade < mov.quantidade) {
                    issues.push({ movementId: mov.id, message: `Atenção: Estoque ficou negativo em ${mov.origem}. Tinha: ${orig.quantidade}, Saiu: ${mov.quantidade}` });
                }

                const unitCost = orig.quantidade > 0 ? div(orig.valorTotal, orig.quantidade) : 0n;
                const totalCost = calcProportional(orig.valorTotal, orig.quantidade, mov.quantidade);

                entry.saldoAnteriorOrigem = { qtd: orig.quantidade, valor: orig.valorTotal };

                // Apply
                orig.quantidade -= mov.quantidade;
                orig.valorTotal = sub(orig.valorTotal, totalCost);
                updatePosition(orig);

                entry.saldoAtualOrigem = { qtd: orig.quantidade, valor: orig.valorTotal };
                entry.custoUnitarioAplicado = unitCost;
                entry.custoTotalMovimento = totalCost;

                cogs.push({ produtoId: mov.produtoId, deposito: mov.origem, qty: mov.quantidade, value: totalCost });

            } else if (mov.tipo === 'transferencia') {
                if (!mov.origem || !mov.destino) throw new Error("Transferência mal definida");
                if (mov.origem === mov.destino) throw new Error("Origem e destino iguais");

                const orig = pState.positions[mov.origem];
                const dest = pState.positions[mov.destino];

                // Strict Stock Check - REMOVIDO: Permitir saldo negativo
                if (orig.quantidade < mov.quantidade) {
                    issues.push({ movementId: mov.id, message: `Atenção: Estoque ficou negativo em ${mov.origem}. Tinha: ${orig.quantidade}, Transferiu: ${mov.quantidade}` });
                }

                const transferValue = calcProportional(orig.valorTotal, orig.quantidade, mov.quantidade);
                const unitCost = div(transferValue, mov.quantidade);

                // Update Origin
                entry.saldoAnteriorOrigem = { qtd: orig.quantidade, valor: orig.valorTotal };
                orig.quantidade -= mov.quantidade;
                orig.valorTotal = sub(orig.valorTotal, transferValue);
                updatePosition(orig);
                entry.saldoAtualOrigem = { qtd: orig.quantidade, valor: orig.valorTotal };

                // Update Dest
                entry.saldoAnteriorDestino = { qtd: dest.quantidade, valor: dest.valorTotal };
                dest.quantidade += mov.quantidade;
                dest.valorTotal = add(dest.valorTotal, transferValue);
                updatePosition(dest);
                entry.saldoAtualDestino = { qtd: dest.quantidade, valor: dest.valorTotal };

                entry.custoUnitarioAplicado = unitCost;
                entry.custoTotalMovimento = transferValue;
            }

            ledger.push(entry);

        } catch (err: any) {
            issues.push({ movementId: mov.id, message: err.message || "Erro desconhecido" });
        }
    }

    // Final Aggregation
    for (const [pid, state] of stock) {
        state.totalQty =
            state.positions.prep_center.quantidade +
            state.positions.amazon_fba.quantidade +
            state.positions.full_ml.quantidade;
        state.totalValue =
            add(add(state.positions.prep_center.valorTotal, state.positions.amazon_fba.valorTotal), state.positions.full_ml.valorTotal);
    }

    return {
        status: issues.length > 0 ? 'NEEDS_INPUT' : 'OK',
        issues,
        stock,
        ledger,
        cogs
    };
}
