import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { recalculateCosts } from "@/lib/costing/service";

// Types from other hook to avoid circular dependency on file, but we can import interfaces
import type { Deposito } from "@/lib/costing";

// ── Global Invalidation Helper ──────────────────────────────
const invalidateStock = async (queryClient: any) => {
    // Invalidate movements (Primary Data)
    await queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
    // Invalidate products (Primary Data - if new product/kit created)
    await queryClient.invalidateQueries({ queryKey: ["produtos-estoque"] });

    // Optional: Refetch immediately to ensure UI is in sync
    await queryClient.refetchQueries({ queryKey: ["estoque-movimentacoes"] });
};

// ── Mutations ───────────────────────────────────────────────
export function useEstoqueMutations() {
    const queryClient = useQueryClient();

    // 1. Transfer
    const transferMutation = useMutation({
        mutationFn: async ({ produtoId, origem, destino, quantidade, precoUnitario, data }: {
            produtoId: string; origem: Deposito; destino: Deposito; quantidade: number; precoUnitario: number; data: string;
        }) => {
            const { error } = await supabase.from("estoque_movimentacoes").insert({
                produto_id: produtoId,
                tipo: "transferencia",
                deposito_origem: origem,
                deposito_destino: destino,
                quantidade,
                preco_unitario: precoUnitario,
                data_movimentacao: data,
            });
            if (error) throw error;
        },
        onSuccess: async (_, variables) => {
            try {
                await recalculateCosts([variables.produtoId]);
            } catch (e) {
                console.error("Erro ao recalcular custos:", e);
            }
            toast.success("Transferência realizada com sucesso!");
            await invalidateStock(queryClient);
        },
        onError: () => toast.error("Erro ao registrar transferência."),
    });

    // 2. Exit (Saída)
    const saidaMutation = useMutation({
        mutationFn: async ({ produtoId, deposito, quantidade, precoUnitario, data, observacao }: {
            produtoId: string; deposito: Deposito; quantidade: number; precoUnitario: number; data: string; observacao: string;
        }) => {
            const { error } = await supabase.from("estoque_movimentacoes").insert({
                produto_id: produtoId,
                tipo: "saida",
                deposito_origem: deposito,
                deposito_destino: deposito,
                quantidade,
                preco_unitario: precoUnitario,
                data_movimentacao: data,
                observacao: observacao || null,
            });
            if (error) throw error;
        },
        onSuccess: async (_, variables) => {
            try {
                await recalculateCosts([variables.produtoId]);
            } catch (e) {
                console.error("Erro ao recalcular custos:", e);
            }
            toast.success("Saída registrada com sucesso!");
            await invalidateStock(queryClient);
        },
        onError: () => toast.error("Erro ao registrar saída."),
    });

    // 3. Delete
    const deleteMutation = useMutation({
        mutationFn: async (movId: string) => {
            // Get product ID before deleting for recalculation
            const { data } = await supabase.from("estoque_movimentacoes").select("produto_id").eq("id", movId).single();
            const produtoId = data?.produto_id;

            const { error } = await supabase.from("estoque_movimentacoes").delete().eq("id", movId);
            if (error) throw error;

            return produtoId;
        },
        onSuccess: async (produtoId) => {
            if (produtoId) {
                try {
                    await recalculateCosts([produtoId]);
                } catch (e) { console.error(e) }
            }
            toast.success("Movimentação excluída e estoque recalculado!");
            await invalidateStock(queryClient);
        },
        onError: () => toast.error("Erro ao excluir movimentação."),
    });

    // 4. Edit
    const editMutation = useMutation({
        mutationFn: async ({ id, quantidade, preco_unitario, data_movimentacao, observacao }: {
            id: string; quantidade: number; preco_unitario: number; data_movimentacao: string; observacao: string;
        }) => {
            // Get product ID before updating for recalculation
            const { data } = await supabase.from("estoque_movimentacoes").select("produto_id").eq("id", id).single();
            const produtoId = data?.produto_id;

            const { error } = await supabase.from("estoque_movimentacoes").update({
                quantidade,
                preco_unitario,
                data_movimentacao,
                observacao: observacao || null,
            }).eq("id", id);

            if (error) throw error;
            return produtoId;
        },
        onSuccess: async (produtoId) => {
            if (produtoId) {
                try {
                    await recalculateCosts([produtoId]);
                } catch (e) { console.error(e) }
            }
            toast.success("Movimentação atualizada!");
            await invalidateStock(queryClient);
        },
        onError: () => toast.error("Erro ao atualizar movimentação."),
    });

    // 5. Kit Creation
    const kitMutation = useMutation({
        mutationFn: async ({ nome, componentes, numKits, custoUnitario, prepItems }: {
            nome: string;
            componentes: { produtoId: string; qtdPorKit: number }[];
            numKits: number;
            custoUnitario: number;
            prepItems: any[]; // items to check cost
        }) => {
            // 1. Create kit as a product
            const { data: kitProduto, error: prodError } = await supabase
                .from("produtos")
                .insert({ nome, tipo: "kit" })
                .select("id")
                .single();
            if (prodError) throw prodError;

            // 2. Insert kit composition
            const { error: compError } = await supabase
                .from("kit_componentes")
                .insert(componentes.map(c => ({
                    kit_produto_id: kitProduto.id,
                    componente_produto_id: c.produtoId,
                    quantidade_por_kit: c.qtdPorKit,
                })));
            if (compError) throw compError;

            const hoje = new Date().toISOString().split("T")[0];

            // 3. Deduct components from Prep Center
            const saidas = componentes.map(c => ({
                produto_id: c.produtoId,
                tipo: "saida" as const,
                deposito_origem: "prep_center" as const,
                deposito_destino: "prep_center" as const, // Consumed in prep
                quantidade: c.qtdPorKit * numKits,
                preco_unitario: prepItems.find(i => i.produto_id === c.produtoId)?.custoCMP || 0,
                data_movimentacao: hoje,
                observacao: `Montagem kit: ${nome} (x${numKits})`,
            }));
            const { error: saidaError } = await supabase.from("estoque_movimentacoes").insert(saidas);
            if (saidaError) throw saidaError;

            // 4. Add kit to Prep Center
            const { error: entradaError } = await supabase.from("estoque_movimentacoes").insert({
                produto_id: kitProduto.id,
                tipo: "entrada",
                deposito_destino: "prep_center",
                quantidade: numKits,
                preco_unitario: custoUnitario,
                data_movimentacao: hoje,
                observacao: `Kit montado com ${componentes.length} produto(s)`,
            });
            if (entradaError) throw entradaError;

            // Recalculate costs for Kit + Components
            const prodIds = [kitProduto.id, ...componentes.map(c => c.produtoId)];
            return prodIds;
        },
        onSuccess: async (prodIds) => {
            if (prodIds) {
                try {
                    await recalculateCosts(prodIds);
                } catch (e) { console.error(e) }
            }
            toast.success("Kit criado com sucesso!");
            await invalidateStock(queryClient);
        },
        onError: (err: any) => toast.error(`Erro ao criar kit: ${err.message}`),
    });

    return {
        transferMutation,
        saidaMutation,
        deleteMutation,
        editMutation,
        kitMutation
    };
}
