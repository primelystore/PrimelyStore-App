import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda } from "@/lib/utils";
import type { EstoqueGlobalResult } from "@/hooks/useEstoque";

interface GlobalStockSummaryProps {
    result: EstoqueGlobalResult;
}

export function GlobalStockSummary({ result }: GlobalStockSummaryProps) {
    const totalQtd =
        result.prep_center.reduce((acc, i) => acc + i.quantidade, 0) +
        result.amazon_fba.reduce((acc, i) => acc + i.quantidade, 0) +
        result.full_ml.reduce((acc, i) => acc + i.quantidade, 0);

    const totalCMP =
        result.prep_center.reduce((acc, i) => acc + i.valorTotal, 0) +
        result.amazon_fba.reduce((acc, i) => acc + i.valorTotal, 0) +
        result.full_ml.reduce((acc, i) => acc + i.valorTotal, 0);

    const totalFIFO =
        result.prep_center.reduce((acc, i) => acc + i.valorTotalFIFO, 0) +
        result.amazon_fba.reduce((acc, i) => acc + i.valorTotalFIFO, 0) +
        result.full_ml.reduce((acc, i) => acc + i.valorTotalFIFO, 0);

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Estoque Total (Global)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalQtd} unidades</div>
                    <p className="text-xs text-muted-foreground">+0% desde o mês passado (placeholder)</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total (CMP)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatarMoeda(totalCMP)}</div>
                    <p className="text-xs text-muted-foreground">Custo Médio Ponderado</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total (FIFO)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatarMoeda(totalFIFO)}</div>
                    <p className="text-xs text-muted-foreground">First-In, First-Out</p>
                </CardContent>
            </Card>
        </div>
    );
}
