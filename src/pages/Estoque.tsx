import { useState, useMemo } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda, formatarData, obterDataHoje } from "@/lib/utils";
import { Boxes, Package, Store, ArrowRightLeft, LogOut, History, Trash2, PackagePlus, ClipboardList, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// ── Shared Hooks ─────────────────────────────────────────────
import { useEstoqueData, type EstoqueProduto, type Movimentacao } from "@/hooks/useEstoque";
import { useEstoqueMutations } from "@/hooks/useEstoqueMutations";

// ── Components ───────────────────────────────────────────────
import { GlobalStockSummary } from "@/components/estoque/GlobalStockSummary";
import { EstoqueTable } from "@/components/estoque/EstoqueTable";
import { MovimentacoesTab } from "@/components/estoque/MovimentacoesTab";

// ── Types & Constants ────────────────────────────────────────
import { type Deposito, type TipoMov } from "@/lib/costing";

const DEPOSITO_LABELS: Record<Deposito, string> = {
    prep_center: "Prep Center",
    amazon_fba: "Amazon (FBA)",
    full_ml: "Full (ML)",
};

const TIPO_LABELS: Record<TipoMov, string> = {
    entrada: "Entrada",
    saida: "Saída",
    transferencia: "Transferência",
};

export default function Estoque() {
    // ── Global Data & Mutations ──────────────────────────────
    const { estoqueGlobal, movimentacoes, produtos, isLoading } = useEstoqueData();
    const {
        transferMutation,
        saidaMutation,
        deleteMutation,
        editMutation,
        kitMutation
    } = useEstoqueMutations();

    // ── Helper Accessors ─────────────────────────────────────
    const prepItems = estoqueGlobal.prep_center;
    const amazonItems = estoqueGlobal.amazon_fba;
    const fullMlItems = estoqueGlobal.full_ml;

    // ── Local UI State (Modals) ──────────────────────────────

    // Transfer
    const [transferModal, setTransferModal] = useState<{
        open: boolean;
        item: EstoqueProduto | null;
        origem: Deposito;
        destino: Deposito;
    }>({ open: false, item: null, origem: "prep_center", destino: "amazon_fba" });
    const [transferForm, setTransferForm] = useState({ quantidade: "", data: obterDataHoje() });

    // Exit
    const [saidaModal, setSaidaModal] = useState<{
        open: boolean;
        item: EstoqueProduto | null;
        deposito: Deposito;
    }>({ open: false, item: null, deposito: "prep_center" });
    const [saidaForm, setSaidaForm] = useState({ quantidade: "", data: obterDataHoje(), observacao: "" });

    // History
    const [historicoModal, setHistoricoModal] = useState<{
        open: boolean;
        item: EstoqueProduto | null;
        deposito: Deposito;
    }>({ open: false, item: null, deposito: "prep_center" });
    const [movParaExcluir, setMovParaExcluir] = useState<string | null>(null);

    // Edit
    const [editModal, setEditModal] = useState<{
        open: boolean;
        movimentacao: Movimentacao | null;
    }>({ open: false, movimentacao: null });
    const [editForm, setEditForm] = useState({
        quantidade: "",
        preco_unitario: "",
        data_movimentacao: "",
        observacao: "",
    });

    // Kit Creation
    const [kitModal, setKitModal] = useState(false);
    const [kitNome, setKitNome] = useState("");
    const [kitComponentes, setKitComponentes] = useState<Record<string, number>>({});
    const [kitQuantidade, setKitQuantidade] = useState("");

    // ── Memoized Logic ───────────────────────────────────────

    // History Logic
    const movimentacoesHistorico = useMemo(() => {
        if (!historicoModal.item) return [];
        return movimentacoes.filter(m =>
            m.produto_id === historicoModal.item!.produto_id &&
            (m.deposito_destino === historicoModal.deposito || m.deposito_origem === historicoModal.deposito)
        ).sort((a, b) => {
            const dateDiff = new Date(b.data_movimentacao).getTime() - new Date(a.data_movimentacao).getTime();
            if (dateDiff !== 0) return dateDiff;
            // Dentro da mesma data, ordenar pelo número na observação (decrescente)
            const numA = parseInt(a.observacao || "0") || 0;
            const numB = parseInt(b.observacao || "0") || 0;
            return numB - numA;
        });
    }, [movimentacoes, historicoModal]);

    // Kit Logic
    const kitMaxPossivel = useMemo(() => {
        const selecionados = Object.entries(kitComponentes).filter(([, qtd]) => qtd > 0);
        if (selecionados.length === 0) return 0;
        return Math.min(
            ...selecionados.map(([prodId, qtdPorKit]) => {
                const item = prepItems.find(i => i.produto_id === prodId);
                return item ? Math.floor(item.quantidade / qtdPorKit) : 0;
            })
        );
    }, [kitComponentes, prepItems]);

    const kitCustoUnitario = useMemo(() => {
        return Object.entries(kitComponentes)
            .filter(([, qtd]) => qtd > 0)
            .reduce((total, [prodId, qtdPorKit]) => {
                const item = prepItems.find(i => i.produto_id === prodId);
                const cmp = item ? item.custoCMP : 0;
                return total + cmp * qtdPorKit;
            }, 0);
    }, [kitComponentes, prepItems]); // Dependencies updated to prepItems (which comes from estoqueGlobal)

    // ── Handlers ─────────────────────────────────────────────

    // Open Modals
    const handleTransferir = (item: EstoqueProduto, origem: Deposito, destino: Deposito) => {
        setTransferModal({ open: true, item, origem, destino });
        setTransferForm({ quantidade: "", data: obterDataHoje() });
    };

    const handleSaida = (item: EstoqueProduto, deposito: Deposito) => {
        setSaidaModal({ open: true, item, deposito });
        setSaidaForm({ quantidade: "", data: obterDataHoje(), observacao: "" });
    };

    const handleHistorico = (item: EstoqueProduto, deposito: Deposito) => {
        setHistoricoModal({ open: true, item, deposito });
    };

    const openKitModal = () => {
        setKitModal(true);
        setKitNome("");
        setKitComponentes({});
        setKitQuantidade("");
    };

    const handleEdit = (mov: Movimentacao) => {
        setEditModal({ open: true, movimentacao: mov });
        setEditForm({
            quantidade: mov.quantidade.toString(),
            preco_unitario: mov.preco_unitario.toString(),
            data_movimentacao: mov.data_movimentacao,
            observacao: mov.observacao || "",
        });
    };

    // Submits
    const submitTransfer = () => {
        const qty = parseInt(transferForm.quantidade);
        if (!qty || qty <= 0) { toast.error("Quantidade inválida."); return; }
        if (!transferForm.data) { toast.error("Data obrigatória."); return; }

        transferMutation.mutate({
            produtoId: transferModal.item!.produto_id,
            origem: transferModal.origem,
            destino: transferModal.destino,
            quantidade: qty,
            precoUnitario: transferModal.item?.custoCMP || 0,
            data: transferForm.data,
        }, {
            onSuccess: () => setTransferModal(p => ({ ...p, open: false }))
        });
    };

    const submitSaida = () => {
        const qty = parseInt(saidaForm.quantidade);
        if (!qty || qty <= 0) { toast.error("Quantidade inválida."); return; }
        if (!saidaForm.data) { toast.error("Data obrigatória."); return; }

        saidaMutation.mutate({
            produtoId: saidaModal.item!.produto_id,
            deposito: saidaModal.deposito,
            quantidade: qty,
            precoUnitario: saidaModal.item?.custoCMP || 0,
            data: saidaForm.data,
            observacao: saidaForm.observacao,
        }, {
            onSuccess: () => setSaidaModal(p => ({ ...p, open: false }))
        });
    };

    const submitKit = () => {
        if (!kitNome.trim()) { toast.error("Nome obrigatório."); return; }
        const componentes = Object.entries(kitComponentes)
            .filter(([, qtd]) => qtd > 0)
            .map(([prodId, qtdPorKit]) => ({ produtoId: prodId, qtdPorKit }));

        if (componentes.length < 2) { toast.error("Mínimo 2 componentes."); return; }
        const numKits = parseInt(kitQuantidade);
        if (!numKits || numKits <= 0) { toast.error("Quantidade inválida."); return; }
        // Removida a trava de numKits > kitMaxPossivel. Agora avisamos se passar do limite, mas permitimos criar.
        if (numKits > kitMaxPossivel && kitMaxPossivel > 0) {
            toast.warning(`Atenção: Criando mais kits do que o estoque disponível. Os componentes ficarão negativos.`);
        }

        kitMutation.mutate({
            nome: kitNome,
            componentes,
            numKits,
            custoUnitario: kitCustoUnitario,
            prepItems // Pass all prep items to calculate component costs inside mutation if needed, or we rely on logic there
        }, {
            onSuccess: () => setKitModal(false)
        });
    };

    const submitEdit = () => {
        if (!editModal.movimentacao) return;
        const qty = parseInt(editForm.quantidade);
        const preco = parseFloat(editForm.preco_unitario);

        if (!qty || qty <= 0) { toast.error("Quantidade inválida."); return; }
        if (isNaN(preco) || preco < 0) { toast.error("Preço inválido."); return; }
        if (!editForm.data_movimentacao) { toast.error("Data obrigatória."); return; }

        editMutation.mutate({
            id: editModal.movimentacao.id,
            quantidade: qty,
            preco_unitario: preco,
            data_movimentacao: editForm.data_movimentacao,
            observacao: editForm.observacao,
        }, {
            onSuccess: () => setEditModal({ open: false, movimentacao: null })
        });
    };

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <SectionHeader
                title="Controle de Estoque"
                description="Gerencie o estoque nos depósitos Prep Center, Amazon FBA e Full Mercado Livre."
            />

            {/* ── Global Summary ── */}
            <GlobalStockSummary result={estoqueGlobal} />

            <Tabs defaultValue="prep-center" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="prep-center" className="flex items-center gap-2">
                        <Boxes className="h-4 w-4" /> Prep Center
                        {prepItems.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{prepItems.reduce((s, i) => s + i.quantidade, 0)}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="amazon" className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Amazon (FBA)
                        {amazonItems.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{amazonItems.reduce((s, i) => s + i.quantidade, 0)}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="full-ml" className="flex items-center gap-2">
                        <Store className="h-4 w-4" /> Full (ML)
                        {fullMlItems.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{fullMlItems.reduce((s, i) => s + i.quantidade, 0)}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> Movimentações
                        <Badge variant="secondary" className="ml-1 text-xs">{movimentacoes.length}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="prep-center" className="mt-6">
                    <div className="flex justify-end mb-4">
                        <Button onClick={openKitModal} className="gap-2">
                            <PackagePlus className="h-4 w-4" /> Criar Kit
                        </Button>
                    </div>
                    <EstoqueTable
                        items={prepItems}
                        isLoading={isLoading}
                        deposito="prep_center"
                        onTransferir={(item: EstoqueProduto, destino: Deposito) => handleTransferir(item, "prep_center", destino)}
                        onSaida={(item: EstoqueProduto) => handleSaida(item, "prep_center")}
                        onHistorico={(item: EstoqueProduto) => handleHistorico(item, "prep_center")}
                    />
                </TabsContent>
                <TabsContent value="amazon" className="mt-6">
                    <EstoqueTable
                        items={amazonItems}
                        isLoading={isLoading}
                        deposito="amazon_fba"
                        onTransferir={(item: EstoqueProduto, destino: Deposito) => handleTransferir(item, "amazon_fba", destino)}
                        onSaida={(item: EstoqueProduto) => handleSaida(item, "amazon_fba")}
                        onHistorico={(item: EstoqueProduto) => handleHistorico(item, "amazon_fba")}
                    />
                </TabsContent>
                <TabsContent value="full-ml" className="mt-6">
                    <EstoqueTable
                        items={fullMlItems}
                        isLoading={isLoading}
                        deposito="full_ml"
                        onTransferir={(item: EstoqueProduto, destino: Deposito) => handleTransferir(item, "full_ml", destino)}
                        onSaida={(item: EstoqueProduto) => handleSaida(item, "full_ml")}
                        onHistorico={(item: EstoqueProduto) => handleHistorico(item, "full_ml")}
                    />
                </TabsContent>

                {/* ── Movimentações Tab ── */}
                <TabsContent value="movimentacoes" className="mt-6">
                    <MovimentacoesTab
                        movimentacoes={movimentacoes}
                        produtos={produtos}
                        onEdit={handleEdit}
                        onDelete={setMovParaExcluir}
                    />
                </TabsContent>
            </Tabs>

            {/* ── Dialogs ── */}
            {/* Transfer Dialog */}
            <Dialog open={transferModal.open} onOpenChange={(open) => { if (!open) setTransferModal(p => ({ ...p, open: false })); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            <ArrowRightLeft className="inline h-5 w-5 mr-2" />
                            Transferir para {DEPOSITO_LABELS[transferModal.destino]}
                        </DialogTitle>
                        <DialogDescription>
                            Transferir <span className="font-semibold">{transferModal.item?.nome}</span> do Prep Center.
                            <br />Disponível: <span className="font-semibold">{transferModal.item?.quantidade}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="t-qty">Quantidade *</Label>
                            <Input id="t-qty" type="number" min="1" value={transferForm.quantidade}
                                onChange={(e) => setTransferForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex: 5" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="t-data">Data *</Label>
                            <Input id="t-data" type="date" value={transferForm.data}
                                onChange={(e) => setTransferForm(p => ({ ...p, data: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferModal(p => ({ ...p, open: false }))}>Cancelar</Button>
                        <Button disabled={transferMutation.isPending} onClick={submitTransfer}>
                            {transferMutation.isPending ? "Transferindo..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Exit Dialog */}
            <Dialog open={saidaModal.open} onOpenChange={(open) => { if (!open) setSaidaModal(p => ({ ...p, open: false })); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            <LogOut className="inline h-5 w-5 mr-2" />
                            Registrar Saída
                        </DialogTitle>
                        <DialogDescription>
                            Saída de <span className="font-semibold">{saidaModal.item?.nome}</span>.
                            <br />Disponível: <span className="font-semibold">{saidaModal.item?.quantidade}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="s-qty">Quantidade *</Label>
                            <Input id="s-qty" type="number" min="1" value={saidaForm.quantidade}
                                onChange={(e) => setSaidaForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex: 3" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="s-data">Data *</Label>
                            <Input id="s-data" type="date" value={saidaForm.data}
                                onChange={(e) => setSaidaForm(p => ({ ...p, data: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="s-obs">Observação</Label>
                            <Input id="s-obs" value={saidaForm.observacao}
                                onChange={(e) => setSaidaForm(p => ({ ...p, observacao: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaidaModal(p => ({ ...p, open: false }))}>Cancelar</Button>
                        <Button variant="destructive" disabled={saidaMutation.isPending} onClick={submitSaida}>
                            {saidaMutation.isPending ? "Registrando..." : "Confirmar Saída"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historicoModal.open} onOpenChange={(open) => { if (!open) setHistoricoModal(p => ({ ...p, open: false })); }}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            <History className="inline h-5 w-5 mr-2" />
                            Histórico de Movimentações
                        </DialogTitle>
                        <DialogDescription>
                            Movimentações de <span className="font-semibold">{historicoModal.item?.nome}</span> no {DEPOSITO_LABELS[historicoModal.deposito]}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-80 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Origem</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead>Obs.</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movimentacoesHistorico.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-16 text-center">Nenhuma movimentação.</TableCell></TableRow>
                                ) : movimentacoesHistorico.map(mov => (
                                    <TableRow key={mov.id}>
                                        <TableCell className="text-sm">{formatarData(mov.data_movimentacao)}</TableCell>
                                        <TableCell>
                                            <Badge variant={mov.tipo === "entrada" ? "default" : mov.tipo === "saida" ? "destructive" : "secondary"} className="text-xs">
                                                {TIPO_LABELS[mov.tipo]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{mov.deposito_origem ? DEPOSITO_LABELS[mov.deposito_origem as Deposito] : "—"}</TableCell>
                                        <TableCell className="text-sm">{DEPOSITO_LABELS[mov.deposito_destino as Deposito]}</TableCell>
                                        <TableCell className="text-right text-sm">{mov.quantidade}</TableCell>
                                        <TableCell className="text-right text-sm">{formatarMoeda(mov.preco_unitario)}</TableCell>
                                        <TableCell className="text-sm max-w-[150px] truncate" title={mov.observacao || ""}>
                                            {mov.observacao || "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => setMovParaExcluir(mov.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                    setHistoricoModal(p => ({ ...p, open: false }));
                                                    handleEdit(mov);
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoricoModal(p => ({ ...p, open: false }))}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!movParaExcluir} onOpenChange={(open) => { if (!open) setMovParaExcluir(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita e os saldos serão recalculados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                                if (movParaExcluir) deleteMutation.mutate(movParaExcluir, {
                                    onSuccess: () => setMovParaExcluir(null)
                                });
                            }}
                        >
                            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Kit Creation Dialog */}
            <Dialog open={kitModal} onOpenChange={(open) => { if (!open) setKitModal(false); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            <PackagePlus className="inline h-5 w-5 mr-2" />
                            Criar Kit
                        </DialogTitle>
                        <DialogDescription>
                            Selecione os produtos do Prep Center.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
                        <div className="space-y-2">
                            <Label htmlFor="kit-nome">Nome do Kit *</Label>
                            <Input id="kit-nome" value={kitNome} onChange={(e) => setKitNome(e.target.value)}
                                placeholder='Ex: Kit Verão' />
                        </div>

                        <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                            <Label>Selecione os Produtos *</Label>
                            <div className="flex-1 max-h-72 overflow-y-auto rounded-md border">
                                <div className="p-3 space-y-2">
                                    {(prepItems || []).map(item => {
                                        if (!item) return null;
                                        const isSelected = (kitComponentes[item.produto_id] || 0) > 0;
                                        return (
                                            <div key={item.produto_id} className={`flex items-center gap-3 p-2 rounded-md transition-colors ${isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'}`}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked: boolean) => {
                                                        setKitComponentes(prev => {
                                                            const next = { ...prev };
                                                            if (checked) { next[item.produto_id] = 1; }
                                                            else { delete next[item.produto_id]; }
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{item.nome}</p>
                                                    <p className="text-xs text-muted-foreground">Disp: {item.quantidade} • CMP: {formatarMoeda(item.custoCMP)}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs whitespace-nowrap">Qtd:</Label>
                                                        <Input
                                                            type="number" min="1" max={item.quantidade}
                                                            className="w-16 h-8 text-sm"
                                                            value={kitComponentes[item.produto_id] || ""}
                                                            onChange={(e) => {
                                                                const v = parseInt(e.target.value) || 0;
                                                                setKitComponentes(prev => ({ ...prev, [item.produto_id]: v }));
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="kit-qty">Quantidade de Kits *</Label>
                                <Input id="kit-qty" type="number" min="1"
                                    value={kitQuantidade} onChange={(e) => setKitQuantidade(e.target.value)}
                                    placeholder={kitMaxPossivel > 0 ? `Máx S/ Faltar: ${kitMaxPossivel}` : "Qtd"} />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo Estimado</Label>
                                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50">
                                    <span className="text-sm font-medium">{formatarMoeda(kitCustoUnitario)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setKitModal(false)}>Cancelar</Button>
                        <Button disabled={kitMutation.isPending} onClick={submitKit}>
                            {kitMutation.isPending ? "Criando..." : "Criar Kit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editModal.open} onOpenChange={(open) => { if (!open) setEditModal({ open: false, movimentacao: null }); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            <Pencil className="inline h-5 w-5 mr-2" />
                            Editar Movimentação
                        </DialogTitle>
                        <DialogDescription>
                            O estoque será recalculado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-qty">Quantidade *</Label>
                                <Input id="edit-qty" type="number" min="1"
                                    value={editForm.quantidade}
                                    onChange={(e) => setEditForm(p => ({ ...p, quantidade: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-preco">Preço Unit. *</Label>
                                <Input id="edit-preco" type="number" step="0.01" min="0"
                                    value={editForm.preco_unitario}
                                    onChange={(e) => setEditForm(p => ({ ...p, preco_unitario: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-data">Data *</Label>
                            <Input id="edit-data" type="date"
                                value={editForm.data_movimentacao}
                                onChange={(e) => setEditForm(p => ({ ...p, data_movimentacao: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-obs">Observação</Label>
                            <Input id="edit-obs"
                                value={editForm.observacao}
                                onChange={(e) => setEditForm(p => ({ ...p, observacao: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditModal({ open: false, movimentacao: null })}>Cancelar</Button>
                        <Button disabled={editMutation.isPending} onClick={submitEdit}>
                            {editMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
