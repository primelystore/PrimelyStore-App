import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2 } from "lucide-react";
import { formatarMoeda } from "@/lib/utils";

interface Lancamento {
    id: string;
    descricao: string;
    valor: number;
    tipo: "pagar" | "receber";
    data_vencimento: string;
    status: "pendente" | "pago" | "recebido" | "atrasado";
    categoria: string;
}

async function fetchLancamentos(tipo: string): Promise<Lancamento[]> {
    const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("tipo", tipo)
        .order("data_vencimento", { ascending: true });
    if (error) return [];
    return data || [];
}

const statusBadge: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pendente: { variant: "outline", label: "Pendente" },
    pago: { variant: "default", label: "Pago" },
    recebido: { variant: "default", label: "Recebido" },
    atrasado: { variant: "destructive", label: "Atrasado" },
};

function LancamentosTable({ tipo }: { tipo: "pagar" | "receber" }) {
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editItem, setEditItem] = useState<Lancamento | null>(null);
    const [form, setForm] = useState({ descricao: "", valor: "", data_vencimento: "", status: "pendente", categoria: "" });

    const { data: lancamentos = [], isLoading } = useQuery({ queryKey: ["lancamentos", tipo], queryFn: () => fetchLancamentos(tipo) });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = { ...form, valor: parseFloat(form.valor), tipo };
            if (editItem) {
                const { error } = await supabase.from("lancamentos_financeiros").update(payload).eq("id", editItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("lancamentos_financeiros").insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success(editItem ? "Lançamento atualizado!" : "Lançamento criado!");
            queryClient.invalidateQueries({ queryKey: ["lancamentos", tipo] });
            setDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error("Erro ao salvar lançamento."),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Lançamento excluído!");
            queryClient.invalidateQueries({ queryKey: ["lancamentos", tipo] });
        },
    });

    const resetForm = () => {
        setForm({ descricao: "", valor: "", data_vencimento: "", status: "pendente", categoria: "" });
        setEditItem(null);
    };

    const openEdit = (item: Lancamento) => {
        setEditItem(item);
        setForm({ descricao: item.descricao, valor: String(item.valor), data_vencimento: item.data_vencimento, status: item.status, categoria: item.categoria || "" });
        setDialogOpen(true);
    };

    const total = lancamentos.reduce((acc, l) => acc + l.valor, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">Total: <span className="font-bold text-foreground">{formatarMoeda(total)}</span></p>
                </div>
                <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
                    <Plus size={16} className="mr-2" /> Novo Lançamento
                </Button>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[80px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Carregando...</TableCell></TableRow>
                        ) : lancamentos.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum lançamento.</TableCell></TableRow>
                        ) : lancamentos.map(l => (
                            <TableRow key={l.id}>
                                <TableCell className="font-medium">{l.descricao}</TableCell>
                                <TableCell>{l.categoria || "—"}</TableCell>
                                <TableCell className="text-right">{formatarMoeda(l.valor)}</TableCell>
                                <TableCell>{new Date(l.data_vencimento).toLocaleDateString("pt-BR")}</TableCell>
                                <TableCell><Badge variant={statusBadge[l.status]?.variant}>{statusBadge[l.status]?.label}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(l.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Descrição</Label>
                            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Valor (R$)</Label>
                                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Vencimento</Label>
                                <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Categoria</Label>
                                <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Fornecedor, Frete..." />
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pendente">Pendente</SelectItem>
                                        <SelectItem value={tipo === "pagar" ? "pago" : "recebido"}>{tipo === "pagar" ? "Pago" : "Recebido"}</SelectItem>
                                        <SelectItem value="atrasado">Atrasado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => saveMutation.mutate()} disabled={!form.descricao || !form.valor}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function Financeiro() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Financeiro" description="Gerencie contas a pagar e a receber." />

            <Tabs defaultValue="pagar" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
                    <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
                </TabsList>
                <TabsContent value="pagar" className="mt-6">
                    <LancamentosTable tipo="pagar" />
                </TabsContent>
                <TabsContent value="receber" className="mt-6">
                    <LancamentosTable tipo="receber" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
