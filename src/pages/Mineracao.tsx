import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, ChevronLeft, ChevronRight, PackagePlus } from "lucide-react";

type StatusMineracao = "A minerar" | "Minerando" | "Validado" | "Cotando" | "Não validado";

interface ProdutoMineracao {
    id: string;
    nome_produto: string;
    asin: string;
    status: StatusMineracao;
    ultimo_fornecedor_cotado: string | null;
}

const PAGE_SIZE = 10;

const statusColors: Record<StatusMineracao, string> = {
    "A minerar": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    "Minerando": "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    "Cotando": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    "Validado": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    "Não validado": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

async function fetchProdutosMineracao() {
    const { data, error } = await supabase
        .from("mineracao_produtos")
        .select("id, nome_produto, asin, status, ultimo_fornecedor_cotado")
        .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

export default function Mineracao() {
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(1);
    const [itemParaExcluir, setItemParaExcluir] = useState<ProdutoMineracao | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({ nome_produto: "", asin: "", status: "A minerar" as StatusMineracao });

    const { data: produtos = [], isLoading, isError } = useQuery<ProdutoMineracao[]>({
        queryKey: ["mineracao"],
        queryFn: fetchProdutosMineracao,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("mineracao_produtos").insert({
                nome_produto: form.nome_produto,
                asin: form.asin || null,
                status: form.status,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Produto adicionado à mineração!");
            queryClient.invalidateQueries({ queryKey: ["mineracao"] });
            setDialogOpen(false);
            setForm({ nome_produto: "", asin: "", status: "A minerar" });
        },
        onError: () => toast.error("Erro ao adicionar produto."),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("mineracao_produtos").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Produto removido da mineração!");
            queryClient.invalidateQueries({ queryKey: ["mineracao"] });
        },
        onError: () => toast.error("Erro ao remover produto."),
        onSettled: () => setItemParaExcluir(null),
    });

    const registrarProduto = async (item: ProdutoMineracao) => {
        toast.success(`Produto "${item.nome_produto}" registrado no estoque!`);
    };

    const filtrados = useMemo(() =>
        produtos.filter(p =>
            p.nome_produto?.toLowerCase().includes(busca.toLowerCase()) ||
            p.asin?.toLowerCase().includes(busca.toLowerCase())
        ), [produtos, busca]);

    const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE);
    const paginados = useMemo(() => filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE), [filtrados, pagina]);

    return (
        <AlertDialog>
            <div className="space-y-6">
                <SectionHeader
                    title="Mineração"
                    description="Pipeline de pesquisa e validação de novos produtos."
                    action={
                        <Button size="sm" onClick={() => { setForm({ nome_produto: "", asin: "", status: "A minerar" }); setDialogOpen(true); }}>
                            <Plus size={16} className="mr-2" /> Novo Produto
                        </Button>
                    }
                />

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por nome ou ASIN..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className="pl-10" />
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>ASIN</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Último Fornecedor</TableHead>
                                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Carregando...</TableCell></TableRow>
                                ) : isError ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-red-500">Erro ao carregar dados.</TableCell></TableRow>
                                ) : paginados.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum produto em mineração.</TableCell></TableRow>
                                ) : (
                                    paginados.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.nome_produto}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-mono text-xs">{item.asin || "—"}</Badge></TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status] || ""}`}>
                                                    {item.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>{item.ultimo_fornecedor_cotado || "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {item.status === "Validado" && (
                                                        <Button variant="ghost" size="icon" className="text-emerald-600" title="Cadastrar no estoque" onClick={() => registrarProduto(item)}>
                                                            <PackagePlus className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItemParaExcluir(item)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{((pagina - 1) * PAGE_SIZE) + 1}–{Math.min(pagina * PAGE_SIZE, filtrados.length)} de {filtrados.length}</p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                                <span className="text-sm">{pagina}/{totalPaginas}</span>
                                <Button variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remover da mineração?</AlertDialogTitle>
                    <AlertDialogDescription>Remover <span className="font-bold">{itemParaExcluir?.nome_produto}</span> da lista de mineração?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setItemParaExcluir(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(itemParaExcluir!.id)}>Remover</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Produto na Mineração</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nome do Produto *</Label>
                            <Input value={form.nome_produto} onChange={e => setForm(f => ({ ...f, nome_produto: e.target.value }))} placeholder="Ex: Fone Bluetooth XYZ" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>ASIN</Label>
                                <Input value={form.asin} onChange={e => setForm(f => ({ ...f, asin: e.target.value }))} placeholder="Ex: B0XXXXXXXX" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Status Inicial</Label>
                                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusMineracao }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A minerar">A minerar</SelectItem>
                                        <SelectItem value="Minerando">Minerando</SelectItem>
                                        <SelectItem value="Cotando">Cotando</SelectItem>
                                        <SelectItem value="Validado">Validado</SelectItem>
                                        <SelectItem value="Não validado">Não validado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!form.nome_produto.trim()}>Adicionar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AlertDialog>
    );
}
