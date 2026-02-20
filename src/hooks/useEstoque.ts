import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMemo } from "react";
import {
    computeCMP,
    computeFIFO,
    money,
    fromMoney,
    div,
    type MovementNormalized,
    type Deposito,
    type TipoMov
} from "@/lib/costing";

// ── Types ──────────────────────────────────────────────────
export interface Movimentacao {
    id: string;
    produto_id: string;
    tipo: TipoMov;
    deposito_origem: Deposito | null;
    deposito_destino: Deposito | null;
    quantidade: number;
    preco_unitario: number;
    data_movimentacao: string;
    observacao: string | null;
    created_at: string;
}

export interface Produto {
    id: string;
    nome: string;
    asin: string | null;
    marca: string | null;
}

export interface EstoqueProduto {
    produto_id: string;
    nome: string;
    asin: string | null;
    marca: string | null;
    quantidade: number;
    custoCMP: number;
    custoFIFO: number;
    valorTotal: number;
    valorTotalFIFO: number;
}

export interface EstoqueGlobalResult {
    prep_center: EstoqueProduto[];
    amazon_fba: EstoqueProduto[];
    full_ml: EstoqueProduto[];
}

// ── Search & Filter Types ────────────────────────────────
export interface EstoqueFilters {
    tipo: string;
    deposito: string;
    produto: string;
    dataInicio: string;
    dataFim: string;
}

// ── Fetch Functions ──────────────────────────────────────────
async function fetchMovimentacoes(): Promise<Movimentacao[]> {
    const { data, error } = await supabase
        .from("estoque_movimentacoes")
        .select("*")
        .order("data_movimentacao", { ascending: true })
        .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function fetchProdutos(): Promise<Produto[]> {
    const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, asin, marca")
        .order("nome", { ascending: true });
    if (error) throw error;
    return data || [];
}

// ── Adapter Logic (Moved from Estoque.tsx) ───────────────────
function runEngineAdapter(
    movimentacoes: Movimentacao[],
    produtos: Produto[]
): EstoqueGlobalResult {
    // 1. Normalize
    const normalized: MovementNormalized[] = movimentacoes.map(m => ({
        id: m.id,
        produtoId: m.produto_id,
        tipo: m.tipo,
        origem: m.deposito_origem,
        destino: m.deposito_destino,
        quantidade: m.quantidade,
        // Entry Cost: Use price as cost basis
        custoInformadoUnit: m.tipo === 'entrada' ? money(m.preco_unitario) : undefined,
        // For reporting only
        precoUnitarioRelatorio: money(m.preco_unitario),
        dataMov: m.data_movimentacao,
        createdAt: m.created_at,
        occurredAt: new Date(m.data_movimentacao),
        sortKey: `${m.data_movimentacao}|${m.created_at}|${m.id}`
    }));

    // 2. Run Engine (CMP and FIFO)
    const cmpResult = computeCMP(normalized);
    const fifoResult = computeFIFO(normalized);

    // 3. Map to UI format
    const resultado: EstoqueGlobalResult = {
        prep_center: [],
        amazon_fba: [],
        full_ml: []
    };

    const produtoMap = new Map(produtos.map(p => [p.id, p]));

    // We iterate over products present in the engine result (or all products if we want to show zeros)
    // Combining keys from both engines + product list
    const allIds = new Set([...cmpResult.stock.keys(), ...produtos.map(p => p.id)]);

    for (const pid of allIds) {
        const prod = produtoMap.get(pid);
        if (!prod) continue;

        const cmpState = cmpResult.stock.get(pid);
        const fifoState = fifoResult.stock.get(pid);

        // Helper to build UI Item
        const buildItem = (dep: Deposito): EstoqueProduto => {
            const posCMP = cmpState?.positions[dep];

            const qty = posCMP?.quantidade || 0;
            const valCMP = posCMP?.valorTotal || 0n;

            const valFIFO = fifoState?.positions[dep]?.valorTotal || 0n;
            const qtyFIFO = fifoState?.positions[dep]?.quantidade || 0;

            const unitCMP = (qty > 0) ? div(valCMP, qty) : 0n;
            const unitFIFO = (qtyFIFO > 0) ? div(valFIFO, qtyFIFO) : 0n;

            return {
                produto_id: pid,
                nome: prod.nome,
                asin: prod.asin,
                marca: prod.marca,
                quantidade: qty,
                custoCMP: fromMoney(unitCMP),
                custoFIFO: fromMoney(unitFIFO),
                valorTotal: fromMoney(valCMP),
                valorTotalFIFO: fromMoney(valFIFO)
            };
        };

        const itemPrep = buildItem('prep_center');
        if (itemPrep.quantidade > 0) resultado.prep_center.push(itemPrep);

        const itemAmz = buildItem('amazon_fba');
        if (itemAmz.quantidade > 0) resultado.amazon_fba.push(itemAmz);

        const itemFull = buildItem('full_ml');
        if (itemFull.quantidade > 0) resultado.full_ml.push(itemFull);
    }

    // Sort
    const sortFn = (a: EstoqueProduto, b: EstoqueProduto) => a.nome.localeCompare(b.nome);
    resultado.prep_center.sort(sortFn);
    resultado.amazon_fba.sort(sortFn);
    resultado.full_ml.sort(sortFn);

    return resultado;
}

// ── Hook Definition ──────────────────────────────────────────
export function useEstoqueData() {
    const { data: movimentacoes = [], isLoading: movLoading, error: movError } = useQuery({
        queryKey: ["estoque-movimentacoes"],
        queryFn: fetchMovimentacoes,
        staleTime: 1000 * 60 * 5, // 5 minutes cache (invalidated on mutation)
    });

    const { data: produtos = [], isLoading: prodLoading, error: prodError } = useQuery({
        queryKey: ["produtos-estoque"],
        queryFn: fetchProdutos,
        staleTime: 1000 * 60 * 60, // 1 hour cache (products verify rarely change)
    });

    const isLoading = movLoading || prodLoading;
    const error = movError || prodError;

    // Derived State (Memoized)
    const estoqueGlobal = useMemo(() => {
        if (isLoading || !produtos.length) {
            return { prep_center: [], amazon_fba: [], full_ml: [] };
        }
        return runEngineAdapter(movimentacoes, produtos);
    }, [movimentacoes, produtos, isLoading]);

    return {
        movimentacoes,
        produtos,
        estoqueGlobal,
        isLoading,
        error
    };
}
