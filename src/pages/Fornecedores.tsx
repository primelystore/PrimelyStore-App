import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatarMoeda } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Loader2 } from "lucide-react";

interface Fornecedor {
    id: string;
    nome: string;
    cidade: string;
    estado: string;
    contato_pessoa: string;
    contato_email: string;
}

interface ProdutoVinculado {
    produto_id: string;
    produto_nome: string;
    produto_asin: string;
    produto_sku: string;
    codigo_produto_fornecedor: string;
    preco: number;
}

const PAGE_SIZE = 10;

async function fetchFornecedores() {
    const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, cidade, estado, contato_pessoa, contato_email")
        .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

// Componente de linha expansível
function FornecedorExpandido({ fornecedorId }: { fornecedorId: string }) {
    const navigate = useNavigate();
    const [produtos, setProdutos] = useState<ProdutoVinculado[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase
                .from("produto_fornecedores")
                .select("produto_id, codigo_produto_fornecedor, preco, produtos(nome, asin, sku)")
                .eq("fornecedor_id", fornecedorId);

            if (!error && data) {
                setProdutos(data.map((item: any) => ({
                    produto_id: item.produto_id,
                    produto_nome: item.produtos?.nome || "—",
                    produto_asin: item.produtos?.asin || "",
                    produto_sku: item.produtos?.sku || "",
                    codigo_produto_fornecedor: item.codigo_produto_fornecedor || "",
                    preco: item.preco || 0,
                })));
            }
            setLoading(false);
        })();
    }, [fornecedorId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando produtos...
            </div>
        );
    }

    if (produtos.length === 0) {
        return (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Package className="h-4 w-4 mr-2" /> Nenhum produto vinculado a este fornecedor.
            </div>
        );
    }

    return (
        <div className="px-2 pb-2">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs h-8">Produto</TableHead>
                        <TableHead className="text-xs h-8">ASIN</TableHead>
                        <TableHead className="text-xs h-8">SKU</TableHead>
                        <TableHead className="text-xs h-8">Cód. no Fornecedor</TableHead>
                        <TableHead className="text-xs h-8 text-right">Custo (R$)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {produtos.map((p) => (
                        <TableRow key={p.produto_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/produtos/editar/${p.produto_id}`)}>
                            <TableCell className="py-2 text-sm font-medium text-primary hover:underline">{p.produto_nome}</TableCell>
                            <TableCell className="py-2">
                                {p.produto_asin ? (
                                    <Badge variant="outline" className="font-mono text-xs">{p.produto_asin}</Badge>
                                ) : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-mono">{p.produto_sku || "—"}</TableCell>
                            <TableCell className="py-2 text-xs font-mono">{p.codigo_produto_fornecedor || "—"}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-sm">{formatarMoeda(p.preco)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="flex items-center justify-end pt-2 pr-2">
                <span className="text-xs text-muted-foreground">
                    {produtos.length} {produtos.length === 1 ? "produto vinculado" : "produtos vinculados"}
                </span>
            </div>
        </div>
    );
}

export default function Fornecedores() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(1);
    const [itemParaExcluir, setItemParaExcluir] = useState<Fornecedor | null>(null);
    const [expandido, setExpandido] = useState<string | null>(null);

    const { data: fornecedores = [], isLoading, isError } = useQuery<Fornecedor[]>({
        queryKey: ["fornecedores"],
        queryFn: fetchFornecedores,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("fornecedores").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Fornecedor excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        },
        onError: () => toast.error("Erro ao excluir fornecedor."),
        onSettled: () => setItemParaExcluir(null),
    });

    const fornecedoresFiltrados = useMemo(() =>
        fornecedores.filter(f =>
            f.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            f.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
            f.contato_pessoa?.toLowerCase().includes(busca.toLowerCase()) ||
            f.contato_email?.toLowerCase().includes(busca.toLowerCase())
        ), [fornecedores, busca]);

    const totalPaginas = Math.ceil(fornecedoresFiltrados.length / PAGE_SIZE);
    const fornecedoresPaginados = useMemo(() =>
        fornecedoresFiltrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
        [fornecedoresFiltrados, pagina]);

    const toggleExpandido = (id: string) => {
        setExpandido(prev => prev === id ? null : id);
    };

    return (
        <AlertDialog>
            <div className="space-y-6">
                <SectionHeader
                    title="Fornecedores"
                    description="Gerencie todos os seus fornecedores. Clique em um fornecedor para ver os produtos vinculados."
                    action={
                        <Button size="sm" onClick={() => navigate("/fornecedores/cadastro")}>
                            <Plus size={16} className="mr-2" /> Novo Fornecedor
                        </Button>
                    }
                />

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome, cidade, contato..."
                            value={busca}
                            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                            className="pl-10"
                        />
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell></TableRow>
                                ) : isError ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-red-500">Erro ao carregar dados.</TableCell></TableRow>
                                ) : fornecedoresPaginados.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum fornecedor encontrado.</TableCell></TableRow>
                                ) : (
                                    fornecedoresPaginados.map((fornecedor) => (
                                        <>
                                            <TableRow
                                                key={fornecedor.id}
                                                className="cursor-pointer"
                                                onClick={() => toggleExpandido(fornecedor.id)}
                                            >
                                                <TableCell className="px-3">
                                                    {expandido === fornecedor.id ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                                                <TableCell>{fornecedor.cidade}{fornecedor.estado ? ` - ${fornecedor.estado}` : ""}</TableCell>
                                                <TableCell>
                                                    <div>{fornecedor.contato_pessoa || "N/A"}</div>
                                                    <div className="text-xs text-muted-foreground">{fornecedor.contato_email}</div>
                                                </TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/fornecedores/editar/${fornecedor.id}`)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItemParaExcluir(fornecedor)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {expandido === fornecedor.id && (
                                                <TableRow key={`${fornecedor.id}-detail`}>
                                                    <TableCell colSpan={5} className="bg-muted/40 p-0">
                                                        <FornecedorExpandido fornecedorId={fornecedor.id} />
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Mostrando {((pagina - 1) * PAGE_SIZE) + 1} a {Math.min(pagina * PAGE_SIZE, fornecedoresFiltrados.length)} de {fornecedoresFiltrados.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium">{pagina} / {totalPaginas}</span>
                                <Button variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O fornecedor <span className="font-bold">{itemParaExcluir?.nome}</span> será excluído permanentemente.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setItemParaExcluir(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(itemParaExcluir!.id)}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
