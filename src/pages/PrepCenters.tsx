import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface PrepCenter {
    id: string;
    nome: string;
    cidade: string;
    estado: string;
    contato_pessoa: string;
    contato_email: string;
}

const PAGE_SIZE = 10;

async function fetchPrepCenters() {
    const { data, error } = await supabase
        .from("prep_centers")
        .select("id, nome, cidade, estado, contato_pessoa, contato_email")
        .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export default function PrepCenters() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(1);
    const [itemParaExcluir, setItemParaExcluir] = useState<PrepCenter | null>(null);

    const { data: prepCenters = [], isLoading, isError } = useQuery<PrepCenter[]>({
        queryKey: ["prep-centers"],
        queryFn: fetchPrepCenters,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("prep_centers").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Prep Center excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["prep-centers"] });
        },
        onError: () => toast.error("Erro ao excluir Prep Center."),
        onSettled: () => setItemParaExcluir(null),
    });

    const filtrados = useMemo(() =>
        prepCenters.filter(pc =>
            pc.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            pc.cidade?.toLowerCase().includes(busca.toLowerCase())
        ), [prepCenters, busca]);

    const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE);
    const paginados = useMemo(() =>
        filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
        [filtrados, pagina]);

    return (
        <AlertDialog>
            <div className="space-y-6">
                <SectionHeader
                    title="Prep Centers"
                    description="Gerencie seus centros de preparação."
                    action={
                        <Button size="sm" onClick={() => navigate("/prep-centers/cadastro")}>
                            <Plus size={16} className="mr-2" /> Novo Prep Center
                        </Button>
                    }
                />

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou cidade..."
                            value={busca}
                            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                            className="pl-10"
                        />
                    </div>

                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Carregando...</TableCell></TableRow>
                                ) : isError ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-red-500">Erro ao carregar dados.</TableCell></TableRow>
                                ) : paginados.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhum Prep Center encontrado.</TableCell></TableRow>
                                ) : (
                                    paginados.map((pc) => (
                                        <TableRow key={pc.id}>
                                            <TableCell className="font-medium">{pc.nome}</TableCell>
                                            <TableCell>{pc.cidade}{pc.estado ? ` - ${pc.estado}` : ""}</TableCell>
                                            <TableCell>
                                                <div>{pc.contato_pessoa || "N/A"}</div>
                                                <div className="text-xs text-muted-foreground">{pc.contato_email}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/prep-centers/editar/${pc.id}`)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItemParaExcluir(pc)}>
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
                            <p className="text-sm text-muted-foreground">
                                {((pagina - 1) * PAGE_SIZE) + 1}–{Math.min(pagina * PAGE_SIZE, filtrados.length)} de {filtrados.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm">{pagina}/{totalPaginas}</span>
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
                        Excluir permanentemente o Prep Center <span className="font-bold">{itemParaExcluir?.nome}</span>?
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
