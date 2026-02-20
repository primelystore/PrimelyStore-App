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
import { ArrowRightLeft, LogOut, History } from "lucide-react";
import { formatarMoeda } from "@/lib/utils";
import type { EstoqueProduto } from "@/hooks/useEstoque";
import type { Deposito } from "@/lib/costing";

interface EstoqueTableProps {
    items: EstoqueProduto[];
    isLoading: boolean;
    deposito: Deposito;
    onTransferir?: (item: EstoqueProduto, destino: Deposito) => void;
    onSaida: (item: EstoqueProduto) => void;
    onHistorico: (item: EstoqueProduto) => void;
}

export function EstoqueTable({ items, isLoading, deposito, onTransferir, onSaida, onHistorico }: EstoqueTableProps) {
    const [filters, setFilters] = useState({
        nome: "",
        marca: "",
        asin: ""
    });

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchNome = item.nome.toLowerCase().includes(filters.nome.toLowerCase());
            const matchMarca = (item.marca || "").toLowerCase().includes(filters.marca.toLowerCase());
            const matchAsin = (item.asin || "").toLowerCase().includes(filters.asin.toLowerCase());
            return matchNome && matchMarca && matchAsin;
        });
    }, [items, filters]);

    if (isLoading) return <div>Carregando...</div>;

    const totalQty = filteredItems.reduce((acc, item) => acc + item.quantidade, 0);
    const totalCMP = filteredItems.reduce((acc, item) => acc + item.valorTotal, 0);
    const totalFIFO = filteredItems.reduce((acc, item) => acc + item.valorTotalFIFO, 0);

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>ASIN</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Unit. (CMP)</TableHead>
                        <TableHead className="text-right">Total (CMP)</TableHead>
                        <TableHead className="text-right">Total (FIFO)</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                    <TableRow>
                        <TableHead className="p-2">
                            <Input
                                placeholder="Filtrar nome..."
                                value={filters.nome}
                                onChange={e => setFilters(p => ({ ...p, nome: e.target.value }))}
                                className="h-8 text-xs"
                            />
                        </TableHead>
                        <TableHead className="p-2">
                            <Input
                                placeholder="Filtrar marca..."
                                value={filters.marca}
                                onChange={e => setFilters(p => ({ ...p, marca: e.target.value }))}
                                className="h-8 text-xs"
                            />
                        </TableHead>
                        <TableHead className="p-2">
                            <Input
                                placeholder="Filtrar ASIN..."
                                value={filters.asin}
                                onChange={e => setFilters(p => ({ ...p, asin: e.target.value }))}
                                className="h-8 text-xs"
                            />
                        </TableHead>
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredItems.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">Nenhum item encontrado.</TableCell>
                        </TableRow>
                    ) : (
                        filteredItems.map((item) => (
                            <TableRow key={item.produto_id}>
                                <TableCell className="font-medium">{item.nome}</TableCell>
                                <TableCell>{item.marca || "-"}</TableCell>
                                <TableCell>{item.asin || "-"}</TableCell>
                                <TableCell className="text-right">{item.quantidade}</TableCell>
                                <TableCell className="text-right">{formatarMoeda(item.custoCMP)}</TableCell>
                                <TableCell className="text-right">{formatarMoeda(item.valorTotal)}</TableCell>
                                <TableCell className="text-right">{formatarMoeda(item.valorTotalFIFO)}</TableCell>
                                <TableCell className="text-right flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" title="Histórico" onClick={() => onHistorico(item)}>
                                        <History className="h-4 w-4" />
                                    </Button>
                                    {onTransferir && deposito === "prep_center" && (
                                        <>
                                            <Button size="sm" variant="outline" title="Transferir para Amazon" onClick={() => onTransferir(item, "amazon_fba")}>
                                                <ArrowRightLeft className="h-4 w-4 mr-1" /> AMZ
                                            </Button>
                                            <Button size="sm" variant="outline" title="Transferir para Full" onClick={() => onTransferir(item, "full_ml")}>
                                                <ArrowRightLeft className="h-4 w-4 mr-1" /> Full
                                            </Button>
                                        </>
                                    )}
                                    {onTransferir && (deposito === "amazon_fba" || deposito === "full_ml") && (
                                        <Button size="sm" variant="outline" title="Retornar para Prep" onClick={() => onTransferir(item, "prep_center")}>
                                            <ArrowRightLeft className="h-4 w-4" /> Returns
                                        </Button>
                                    )}
                                    <Button size="sm" variant="destructive" title="Saída" onClick={() => onSaida(item)}>
                                        <LogOut className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                {filteredItems.length > 0 && (
                    <TableBody className="border-t-2 border-primary/20 bg-muted/30">
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold text-right">TOTAIS:</TableCell>
                            <TableCell className="font-bold text-right">{totalQty}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="font-bold text-right">{formatarMoeda(totalCMP)}</TableCell>
                            <TableCell className="font-bold text-right">{formatarMoeda(totalFIFO)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                )}
            </Table>
        </div>
    );
}
