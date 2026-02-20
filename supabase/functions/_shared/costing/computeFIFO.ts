import { EngineResult, LedgerEntry, MovementNormalized, ProductStockState, StockPosition, Deposito } from './types.ts';
import { add, sub, mul, div, calcProportional } from './money.ts';

interface FifoLayer {
    movementId: string;
    quantidade: number;
    valorTotalInicial: bigint;
    valorTotalAtual: bigint;
    custoUnitario: bigint;
    data: string;
}

interface ProductFifoState {
    layers: Record<Deposito, FifoLayer[]>;
}

export function computeFIFO(movements: MovementNormalized[]): EngineResult {
    const stock = new Map<string, ProductStockState>();
    const fifoState = new Map<string, ProductFifoState>();
    const ledger: LedgerEntry[] = [];
    const issues: Array<{ movementId: string; message: string }> = [];
    const cogs: Array<{ produtoId: string; deposito: Deposito; qty: number; value: bigint }> = [];

    const getProductAndFifoState = (pid: string) => {
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
            fifoState.set(pid, {
                layers: {
                    prep_center: [],
                    amazon_fba: [],
                    full_ml: []
                }
            });
        }
        return { pState: stock.get(pid)!, fState: fifoState.get(pid)! };
    };

    const updatePositionFromLayers = (pos: StockPosition, layers: FifoLayer[]) => {
        pos.quantidade = layers.reduce((sum, l) => sum + l.quantidade, 0);
        pos.valorTotal = layers.reduce((sum, l) => add(sum, l.valorTotalAtual), 0n);
        pos.custoMedio = pos.quantidade > 0 ? div(pos.valorTotal, pos.quantidade) : 0n;
    };

    const consumeLayers = (
        layers: FifoLayer[],
        qtdRequired: number,
        deposito: Deposito,
        pid: string
    ): { consumedLayers: FifoLayer[], totalValueConsumed: bigint } => {
        // Strict Check: Do we have enough?
        const totalAvailable = layers.reduce((acc, l) => acc + l.quantidade, 0);
        if (totalAvailable < qtdRequired) {
            throw new Error(`Estoque insuficiente em ${deposito}. Disp: ${totalAvailable}, Req: ${qtdRequired}`);
        }

        let remaining = qtdRequired;
        let totalValue = 0n;
        const consumed: FifoLayer[] = [];

        // Work on a copy/index basis or shift strictly?
        // Since we threw on insufficient stock, we can safely mutate.

        while (remaining > 0 && layers.length > 0) {
            const layer = layers[0];

            if (layer.quantidade <= remaining) {
                // Consume entire layer
                totalValue = add(totalValue, layer.valorTotalAtual);
                consumed.push({ ...layer });

                remaining -= layer.quantidade;
                layers.shift();
            } else {
                // Partial consume
                const valueOfPart = calcProportional(layer.valorTotalAtual, layer.quantidade, remaining);

                consumed.push({
                    ...layer,
                    quantidade: remaining,
                    valorTotalAtual: valueOfPart
                });

                totalValue = add(totalValue, valueOfPart);

                layer.valorTotalAtual = sub(layer.valorTotalAtual, valueOfPart);
                layer.quantidade -= remaining;
                remaining = 0;
            }
        }

        return { consumedLayers: consumed, totalValueConsumed: totalValue };
    };

    for (const mov of movements) {
        const { pState, fState } = getProductAndFifoState(mov.produtoId);

        const entry: LedgerEntry = {
            movementId: mov.id,
            produtoId: mov.produtoId,
            metodo: 'fifo',
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

                let custoTotal = 0n;
                if (mov.custoInformadoTotal !== undefined) {
                    custoTotal = mov.custoInformadoTotal;
                } else if (mov.custoInformadoUnit !== undefined) {
                    custoTotal = mul(mov.custoInformadoUnit, mov.quantidade);
                } else {
                    throw new Error("Entrada sem custo");
                }
                const unitCost = div(custoTotal, mov.quantidade);

                // Snapshots
                entry.saldoAnteriorDestino = { qtd: pState.positions[mov.destino].quantidade, valor: pState.positions[mov.destino].valorTotal };

                // Add Layer
                fState.layers[mov.destino].push({
                    movementId: mov.id,
                    quantidade: mov.quantidade,
                    valorTotalInicial: custoTotal,
                    valorTotalAtual: custoTotal,
                    custoUnitario: unitCost,
                    data: mov.dataMov
                });

                updatePositionFromLayers(pState.positions[mov.destino], fState.layers[mov.destino]);

                entry.saldoAtualDestino = { qtd: pState.positions[mov.destino].quantidade, valor: pState.positions[mov.destino].valorTotal };
                entry.custoTotalMovimento = custoTotal;
                entry.custoUnitarioAplicado = unitCost;

            } else if (mov.tipo === 'saida') {
                if (!mov.origem) throw new Error("Saída sem origem");

                entry.saldoAnteriorOrigem = { qtd: pState.positions[mov.origem].quantidade, valor: pState.positions[mov.origem].valorTotal };

                const { totalValueConsumed } = consumeLayers(fState.layers[mov.origem], mov.quantidade, mov.origem, mov.produtoId);

                updatePositionFromLayers(pState.positions[mov.origem], fState.layers[mov.origem]);

                entry.saldoAtualOrigem = { qtd: pState.positions[mov.origem].quantidade, valor: pState.positions[mov.origem].valorTotal };
                entry.custoTotalMovimento = totalValueConsumed;
                entry.custoUnitarioAplicado = div(totalValueConsumed, mov.quantidade);

                cogs.push({ produtoId: mov.produtoId, deposito: mov.origem, qty: mov.quantidade, value: totalValueConsumed });

            } else if (mov.tipo === 'transferencia') {
                if (!mov.origem || !mov.destino) throw new Error("Transferência mal definida");
                if (mov.origem === mov.destino) throw new Error("Origem e destino iguais");

                entry.saldoAnteriorOrigem = { qtd: pState.positions[mov.origem].quantidade, valor: pState.positions[mov.origem].valorTotal };
                entry.saldoAnteriorDestino = { qtd: pState.positions[mov.destino].quantidade, valor: pState.positions[mov.destino].valorTotal };

                const { consumedLayers, totalValueConsumed } = consumeLayers(fState.layers[mov.origem], mov.quantidade, mov.origem, mov.produtoId);

                // Update Origin
                updatePositionFromLayers(pState.positions[mov.origem], fState.layers[mov.origem]);

                // Add to Dest
                for (const layer of consumedLayers) {
                    fState.layers[mov.destino].push({
                        ...layer,
                        // Maintain original data/cost. 
                        // Note: Effectively we are moving the layer to the new location.
                    });
                }

                updatePositionFromLayers(pState.positions[mov.destino], fState.layers[mov.destino]);

                entry.saldoAtualOrigem = { qtd: pState.positions[mov.origem].quantidade, valor: pState.positions[mov.origem].valorTotal };
                entry.saldoAtualDestino = { qtd: pState.positions[mov.destino].quantidade, valor: pState.positions[mov.destino].valorTotal };

                entry.custoTotalMovimento = totalValueConsumed;
                entry.custoUnitarioAplicado = div(totalValueConsumed, mov.quantidade);
            }

            ledger.push(entry);

        } catch (err: any) {
            issues.push({ movementId: mov.id, message: err.message || "Erro FIFO" });
        }
    }

    // Aggregation
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
