import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeAndSort } from "../_shared/costing/utils.ts";
import { computeCMP } from "../_shared/costing/computeCMP.ts";
import { computeFIFO } from "../_shared/costing/computeFIFO.ts";
import { EngineResult, LedgerEntry } from "../_shared/costing/types.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );

        // Debug Probe
        const { count: allMovesCount, data: anyMoves, error: countError } = await supabase
            .from("estoque_movimentacoes")
            .select("produto_id")
            .limit(5);

        // Debug PID
        const { data: hardcodedSearch, error: hardcodedError } = await supabase
            .from("estoque_movimentacoes")
            .select("id")
            .eq("produto_id", "fd53ea30-35c7-424a-b3bd-9a4f5b763e35");

        const { productIds, method = "cmp" } = await req.json();

        // ...

        // In loop:
        // Update response:
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return new Response(JSON.stringify({ error: "productIds array required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const results = [];

        for (const pid of productIds) {
            // 1. Fetch Movements
            const { data: moves, error: movesError } = await supabase
                .from("estoque_movimentacoes")
                .select("*")
                .eq("produto_id", pid);

            if (movesError) throw movesError;

            // 2. Normalize & Sort
            const normalizedMoves = normalizeAndSort(moves || []);

            // 3. Run Engine
            let result: EngineResult;
            if (method === "fifo") {
                result = computeFIFO(normalizedMoves);
            } else {
                result = computeCMP(normalizedMoves);
            }

            // 4. Update Ledger (Transactional: Delete old for this product/method, Insert new)
            if (result.status === "OK" || result.status === "NEEDS_INPUT") {
                // We persist even if NEEDS_INPUT to show partial valid history until the break?
                // Or strictly we only persist valid?
                // Let's persist what we have.

                // Delete existing ledger entries for this product + method
                const { error: delError } = await supabase
                    .from("estoque_custos_ledger")
                    .delete()
                    .eq("produto_id", pid)
                    .eq("metodo", method);

                if (delError) throw delError;

                if (result.ledger.length > 0) {
                    // Flatten for DB insert
                    const dbRows = result.ledger.map((l: LedgerEntry) => ({
                        movimentacao_id: l.movementId,
                        metodo: l.metodo,
                        produto_id: l.produtoId,
                        tipo: l.tipo,
                        deposito_origem: l.origem,
                        deposito_destino: l.destino,
                        quantidade: l.quantidade,
                        custo_unit_aplicado: Number(l.custoUnitarioAplicado) / 100, // DB numeric
                        custo_total_movimento: Number(l.custoTotalMovimento) / 100,
                        saldo_qtd_origem: l.saldoAtualOrigem?.qtd,
                        saldo_custo_origem: l.saldoAtualOrigem ? Number(l.saldoAtualOrigem.valor) / 100 : null,
                        saldo_qtd_destino: l.saldoAtualDestino?.qtd,
                        saldo_custo_destino: l.saldoAtualDestino ? Number(l.saldoAtualDestino.valor) / 100 : null,
                        created_at: new Date().toISOString()
                    }));

                    // Batch insert (Supabase limit is usually high enough for single product history)
                    const { error: insError } = await supabase
                        .from("estoque_custos_ledger")
                        .insert(dbRows);

                    if (insError) throw insError;
                }
            }

            results.push({
                productId: pid,
                status: result.status,
                issues: result.issues,
                ledgerCount: result.ledger.length,
                movesFound: moves?.length ?? 0,
                envCheck: {
                    serviceRole: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
                    url: Deno.env.get("SUPABASE_URL"),
                    serviceRolePrefix: (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").substring(0, 10)
                },
                receivedPid: pid,
                queryError: movesError,
                allMovesCount: allMovesCount, // Global count
                anyMoves: anyMoves,
                countError: countError
            });
        }

        return new Response(JSON.stringify({ data: results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
