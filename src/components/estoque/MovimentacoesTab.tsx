import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda, formatarData } from "@/lib/utils";
import { Pencil, FileDown, Search, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Movimentacao, Produto } from "@/hooks/useEstoque";
import { type Deposito, type TipoMov } from "@/lib/costing";

const DEPOSITO_LABELS: Record<string, string> = {
    prep_center: "Prep Center",
    amazon_fba: "Amazon (FBA)",
    full_ml: "Full (ML)",
};

const TIPO_LABELS: Record<string, string> = {
    entrada: "Entrada",
    saida: "Saída",
    transferencia: "Transferência",
};

interface MovimentacoesTabProps {
    movimentacoes: Movimentacao[];
    produtos: Produto[];
    onEdit: (mov: Movimentacao) => void;
    onDelete: (id: string) => void;
}

export function MovimentacoesTab({ movimentacoes, produtos, onEdit, onDelete }: MovimentacoesTabProps) {
    const [filters, setFilters] = useState({
        search: "",
        tipo: "todos",
        deposito: "todos",
    });
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const toggleSort = () => {
        setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    };

    const filteredMoves = useMemo(() => {
        const filtered = movimentacoes.filter(m => {
            const prod = produtos.find(p => p.id === m.produto_id);
            const prodName = prod?.nome.toLowerCase() || "";
            const matchesSearch = prodName.includes(filters.search.toLowerCase()) ||
                (m.observacao || "").toLowerCase().includes(filters.search.toLowerCase());

            const matchesTipo = filters.tipo === "todos" || m.tipo === filters.tipo;

            const matchesDeposito = filters.deposito === "todos" ||
                m.deposito_origem === filters.deposito ||
                m.deposito_destino === filters.deposito;

            return matchesSearch && matchesTipo && matchesDeposito;
        });

        return [...filtered].sort((a, b) => {
            const dateA = new Date(a.data_movimentacao).getTime();
            const dateB = new Date(b.data_movimentacao).getTime();
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });
    }, [movimentacoes, produtos, filters, sortOrder]);

    const exportCSV = () => {
        const headers = ["ID,Data,Produto,Tipo,Origem,Destino,Qtd,PrecoUnit,Obs"];
        const rows = filteredMoves.map(m => {
            const prod = produtos.find(p => p.id === m.produto_id)?.nome || "Unknown";
            return [
                m.id,
                m.data_movimentacao,
                `"${prod.replace(/"/g, '""')}"`,
                m.tipo,
                m.deposito_origem || "",
                m.deposito_destino || "",
                m.quantidade,
                m.preco_unitario,
                `"${(m.observacao || "").replace(/"/g, '""')}"`
            ].join(",");
        });
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "movimentacoes.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar produto ou obs..."
                            value={filters.search}
                            onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                            className="pl-8"
                        />
                    </div>
                    <Select value={filters.tipo} onValueChange={(v) => setFilters(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos Tipos</SelectItem>
                            <SelectItem value="entrada">Entrada</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filters.deposito} onValueChange={(v) => setFilters(p => ({ ...p, deposito: v }))}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Depósito" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos Depósitos</SelectItem>
                            <SelectItem value="prep_center">Prep Center</SelectItem>
                            <SelectItem value="amazon_fba">Amazon FBA</SelectItem>
                            <SelectItem value="full_ml">Full ML</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" onClick={exportCSV} className="gap-2">
                    <FileDown className="h-4 w-4" /> Exportar CSV
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                onClick={toggleSort}
                            >
                                <div className="flex items-center gap-2">
                                    Data
                                    {sortOrder === "asc" ? (
                                        <ArrowUp className="h-4 w-4 text-primary" />
                                    ) : (
                                        <ArrowDown className="h-4 w-4 text-primary" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead>Obs.</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMoves.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="h-24 text-center">Nenhuma movimentação encontrada.</TableCell></TableRow>
                        ) : filteredMoves.map(mov => {
                            const prod = produtos.find(p => p.id === mov.produto_id);
                            return (
                                <TableRow key={mov.id}>
                                    <TableCell className="text-sm">{formatarData(mov.data_movimentacao)}</TableCell>
                                    <TableCell className="font-medium text-sm">{prod?.nome || "Produto desconhecido"}</TableCell>
                                    <TableCell>
                                        <Badge variant={mov.tipo === 'entrada' ? 'default' : mov.tipo === 'saida' ? 'destructive' : 'secondary'} className="text-xs">
                                            {TIPO_LABELS[mov.tipo] || mov.tipo}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{mov.deposito_origem ? DEPOSITO_LABELS[mov.deposito_origem] || mov.deposito_origem : "-"}</TableCell>
                                    <TableCell className="text-sm">{mov.deposito_destino ? DEPOSITO_LABELS[mov.deposito_destino] || mov.deposito_destino : "-"}</TableCell>
                                    <TableCell className="text-right text-sm">{mov.quantidade}</TableCell>
                                    <TableCell className="text-right text-sm">{formatarMoeda(mov.preco_unitario)}</TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate" title={mov.observacao || ""}>
                                        {mov.observacao || "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => onDelete(mov.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => onEdit(mov)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
