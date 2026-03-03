import { useState, useMemo, useRef, useEffect } from "react";
import { obterDataHoje } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { recalculateCosts } from "@/lib/costing/service";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpAZ, ArrowDownAZ, Columns3, X, Filter, PackagePlus, History } from "lucide-react";
import { formatarMoeda, formatarPorcentagem } from "@/lib/utils";

interface Produto {
    id: string;
    nome: string;
    categoria: string;
    marca: string;
    asin: string;
    sku: string;
    gtin: string;
    gtin_tributavel: string;
    ncm: string;
    codigo_cest: string;
    origem_mercadoria: string;
    situacao_operacao: string;
    largura_cm: number | null;
    altura_cm: number | null;
    comprimento_cm: number | null;
    peso_gramas: number | null;
    ult_preco?: number;
    ult_margem?: number;
    ult_bep?: number;
    ult_roas?: number;
    ult_calc_data?: string;
}

// Definição de colunas
type ColunaKey = keyof Omit<Produto, "id">;

interface ColunaDef {
    key: ColunaKey;
    label: string;
    defaultVisible: boolean;
    hideOnSmall?: boolean;
    tipo?: "texto" | "numero" | "codigo" | "moeda" | "porcentagem" | "data";
}

const COLUNAS: ColunaDef[] = [
    { key: "nome", label: "Nome", defaultVisible: true },
    { key: "asin", label: "ASIN", defaultVisible: true, tipo: "codigo" },
    { key: "categoria", label: "Categoria", defaultVisible: true, hideOnSmall: true },
    { key: "marca", label: "Marca", defaultVisible: true, hideOnSmall: true },
    { key: "sku", label: "SKU", defaultVisible: true, tipo: "codigo" },
    { key: "gtin", label: "GTIN", defaultVisible: false, tipo: "codigo" },
    { key: "gtin_tributavel", label: "GTIN/EAN Tributável", defaultVisible: false, tipo: "codigo" },
    { key: "ncm", label: "NCM", defaultVisible: false, tipo: "codigo" },
    { key: "codigo_cest", label: "Código CEST", defaultVisible: false, tipo: "codigo" },
    { key: "origem_mercadoria", label: "Origem Mercadoria", defaultVisible: false },
    { key: "situacao_operacao", label: "Situação da Operação", defaultVisible: false },
    { key: "largura_cm", label: "Largura (cm)", defaultVisible: false, tipo: "numero" },
    { key: "altura_cm", label: "Altura (cm)", defaultVisible: false, tipo: "numero" },
    { key: "comprimento_cm", label: "Comprimento (cm)", defaultVisible: false, tipo: "numero" },
    { key: "peso_gramas", label: "Peso (g)", defaultVisible: false, tipo: "numero" },
    { key: "ult_preco", label: "Últ. Preço", defaultVisible: true, tipo: "moeda" },
    { key: "ult_margem", label: "Últ. Margem", defaultVisible: true, tipo: "porcentagem" },
    { key: "ult_bep", label: "Últ. BEP", defaultVisible: false, tipo: "moeda" },
    { key: "ult_roas", label: "Últ. ROAS", defaultVisible: false, tipo: "numero" },
    { key: "ult_calc_data", label: "Data Cálc.", defaultVisible: true, tipo: "data", hideOnSmall: true },
];

const PAGE_SIZE = 10;

async function fetchProdutos() {
    const { data, error } = await supabase
        .from("produtos")
        .select(`
            id, nome, categoria, marca, asin, sku, gtin, gtin_tributavel, ncm, codigo_cest, origem_mercadoria, situacao_operacao, largura_cm, altura_cm, comprimento_cm, peso_gramas,
            produto_calculos (
                preco_venda,
                margem_pct,
                bep_preco,
                roas_ideal,
                created_at
            )
        `)
        .order("created_at", { foreignTable: "produto_calculos", ascending: false })
        .limit(1, { foreignTable: "produto_calculos" })
        .order("nome", { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((p: any) => ({
        ...p,
        ult_preco: p.produto_calculos?.[0]?.preco_venda,
        ult_margem: p.produto_calculos?.[0]?.margem_pct,
        ult_bep: p.produto_calculos?.[0]?.bep_preco,
        ult_roas: p.produto_calculos?.[0]?.roas_ideal,
        ult_calc_data: p.produto_calculos?.[0]?.created_at,
    })) as Produto[];
}

// Popover simples para seleção de colunas
function ColunasPopover({
    colunas,
    visibilidade,
    onToggle,
}: {
    colunas: ColunaDef[];
    visibilidade: Record<ColunaKey, boolean>;
    onToggle: (key: ColunaKey) => void;
}) {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickFora(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
        }
        if (aberto) document.addEventListener("mousedown", handleClickFora);
        return () => document.removeEventListener("mousedown", handleClickFora);
    }, [aberto]);

    return (
        <div className="relative" ref={ref}>
            <Button variant="outline" size="sm" onClick={() => setAberto(!aberto)}>
                <Columns3 className="h-4 w-4 mr-2" /> Colunas
            </Button>
            {aberto && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Colunas Visíveis</p>
                    {colunas.map((col) => (
                        <button
                            key={col.key}
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => onToggle(col.key)}
                        >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${visibilidade[col.key] ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                {visibilidade[col.key] && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                )}
                            </span>
                            {col.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Header de coluna com sort e filtro
function ColunaHeader({
    label,
    colKey,
    sortConfig,
    onSort,
    filtro,
    onFiltro,
}: {
    label: string;
    colKey: ColunaKey;
    sortConfig: { key: ColunaKey; dir: "asc" | "desc" } | null;
    onSort: (key: ColunaKey) => void;
    filtro: string;
    onFiltro: (key: ColunaKey, value: string) => void;
}) {
    const [filtroAberto, setFiltroAberto] = useState(false);
    const isActive = sortConfig?.key === colKey;
    const isAsc = isActive && sortConfig?.dir === "asc";

    return (
        <TableHead className="px-3">
            <div className="space-y-1">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold hover:text-foreground transition-colors group"
                        onClick={() => onSort(colKey)}
                    >
                        {label}
                        {isActive ? (
                            isAsc ? <ArrowUpAZ className="h-3.5 w-3.5 text-primary" /> : <ArrowDownAZ className="h-3.5 w-3.5 text-primary" />
                        ) : (
                            <ArrowUpAZ className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
                        )}
                    </button>
                    <button
                        type="button"
                        className={`ml-auto p-0.5 rounded hover:bg-accent transition-colors ${filtro ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                        onClick={() => setFiltroAberto(!filtroAberto)}
                    >
                        <Filter className="h-3 w-3" />
                    </button>
                </div>
                {filtroAberto && (
                    <div className="flex items-center gap-1">
                        <Input
                            value={filtro}
                            onChange={(e) => onFiltro(colKey, e.target.value)}
                            placeholder={`Filtrar ${label.toLowerCase()}...`}
                            className="h-6 text-xs px-2"
                            autoFocus
                        />
                        {filtro && (
                            <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { onFiltro(colKey, ""); setFiltroAberto(false); }}>
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </TableHead>
    );
}

// Modal de Histórico de Cálculos
function HistoricoCalculosModal({
    produto,
    open,
    onOpenChange
}: {
    produto: Produto | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ["historico_calculos", produto?.id],
        queryFn: async () => {
            if (!produto?.id) return [];
            const { data, error } = await supabase
                .from("produto_calculos")
                .select("*")
                .eq("produto_id", produto.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (error) throw error;
            return data;
        },
        enabled: !!produto?.id && open,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Histórico de Precificação</DialogTitle>
                    <DialogDescription>
                        Últimos 20 cálculos do produto <span className="font-semibold">{produto?.nome}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <p className="text-center text-muted-foreground text-sm">Carregando...</p>
                    ) : data?.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm">Nenhum cálculo registrado para este produto.</p>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-xs">Data</TableHead>
                                        <TableHead className="text-xs">Fonte</TableHead>
                                        <TableHead className="text-right text-xs">Preço</TableHead>
                                        <TableHead className="text-right text-xs">Impostos</TableHead>
                                        <TableHead className="text-right text-xs">Margem</TableHead>
                                        <TableHead className="text-right text-xs">Lucro Líq.</TableHead>
                                        <TableHead className="text-right text-xs">ROI</TableHead>
                                        <TableHead className="text-right text-xs">BEP / ROAS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                                            <TableCell className="text-xs">
                                                <Badge variant="outline" className="text-[10px] uppercase">{c.fonte_taxas}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-semibold">{formatarMoeda(c.preco_venda)}</TableCell>
                                            <TableCell className="text-right text-xs">{c.imposto_pct}%</TableCell>
                                            <TableCell className="text-right text-xs">{formatarPorcentagem(c.margem_pct)}</TableCell>
                                            <TableCell className="text-right text-xs font-medium text-emerald-600">{formatarMoeda(c.lucro_liquido)}</TableCell>
                                            <TableCell className="text-right text-xs">{formatarPorcentagem(c.roi_pct)}</TableCell>
                                            <TableCell className="text-right text-xs">
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{formatarMoeda(c.bep_preco)}</span>
                                                    {c.roas_ideal > 0 && <span className="text-muted-foreground text-[10px]">{c.roas_ideal.toFixed(2)}x</span>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Produtos() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(1);
    const [itemParaExcluir, setItemParaExcluir] = useState<Produto | null>(null);

    const [estoqueModal, setEstoqueModal] = useState<{ open: boolean; produto: Produto | null }>({
        open: false, produto: null,
    });
    const [estoqueForm, setEstoqueForm] = useState({ quantidade: "", preco_unitario: "", data_compra: obterDataHoje() });

    // Estado para modal de histórico de cálculos
    const [historicoModal, setHistoricoModal] = useState<{ open: boolean; produto: Produto | null }>({ open: false, produto: null });

    // Visibilidade de colunas — mescla defaults com salvos para suportar novas colunas
    const [colVisibilidade, setColVisibilidade] = useState<Record<ColunaKey, boolean>>(() => {
        const isSmallScreen = window.innerWidth < 1200;
        const defaults = Object.fromEntries(COLUNAS.map(c => [
            c.key,
            isSmallScreen && c.hideOnSmall ? false : c.defaultVisible
        ])) as Record<ColunaKey, boolean>;

        try {
            const saved = localStorage.getItem("produtos_col_vis");
            if (saved) return { ...defaults, ...JSON.parse(saved) };
        } catch { /* ignora JSON inválido */ }
        return defaults;
    });

    // Ordenação
    const [sortConfig, setSortConfig] = useState<{ key: ColunaKey; dir: "asc" | "desc" } | null>(null);

    // Filtros por coluna
    const [filtros, setFiltros] = useState<Partial<Record<ColunaKey, string>>>({});

    const { data: produtos = [], isLoading, isError } = useQuery<Produto[]>({
        queryKey: ["produtos"],
        queryFn: fetchProdutos,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("produtos").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Produto excluído com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["produtos"] });
        },
        onError: () => toast.error("Erro ao excluir produto."),
        onSettled: () => setItemParaExcluir(null),
    });

    const entradaEstoqueMutation = useMutation({
        mutationFn: async ({ produtoId, quantidade, precoUnitario, dataCompra }: { produtoId: string; quantidade: number; precoUnitario: number; dataCompra: string }) => {
            const { error } = await supabase.from("estoque_movimentacoes").insert({
                produto_id: produtoId,
                tipo: "entrada",
                deposito_destino: "prep_center",
                quantidade,
                preco_unitario: precoUnitario,
                data_movimentacao: dataCompra,
            });
            if (error) throw error;
        },
        onSuccess: async (_, variables) => {
            try {
                await recalculateCosts([variables.produtoId]);
            } catch (e) {
                console.error("Erro ao recalcular custos:", e);
            }
            toast.success("Entrada de estoque registrada no Prep Center e custos recalculados!");
            setEstoqueModal({ open: false, produto: null });
            setEstoqueForm({ quantidade: "", preco_unitario: "", data_compra: obterDataHoje() });
            // Invalidar queries de estoque para sincronização com a página Estoque
            queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
            queryClient.invalidateQueries({ queryKey: ["produtos-estoque"] });
        },
        onError: () => toast.error("Erro ao registrar entrada de estoque."),
    });

    const toggleColuna = (key: ColunaKey) => {
        setColVisibilidade(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem("produtos_col_vis", JSON.stringify(next));
            return next;
        });
    };

    const handleSort = (key: ColunaKey) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return prev.dir === "asc" ? { key, dir: "desc" } : null;
            }
            return { key, dir: "asc" };
        });
        setPagina(1);
    };

    const handleFiltro = (key: ColunaKey, value: string) => {
        setFiltros(prev => ({ ...prev, [key]: value }));
        setPagina(1);
    };

    const colunasVisiveis = useMemo(() => COLUNAS.filter(c => colVisibilidade[c.key]), [colVisibilidade]);
    const filtrosAtivos = useMemo(() =>
        Object.entries(filtros).filter(([, v]) => v && v.trim() !== "").length,
        [filtros]);

    // Pipeline: busca global → filtros por coluna → ordenação → paginação
    const produtosProcessados = useMemo(() => {
        let resultado = [...produtos];

        // Busca global
        if (busca) {
            const b = busca.toLowerCase();
            resultado = resultado.filter(p =>
                colunasVisiveis.some(col => String(p[col.key] ?? "").toLowerCase().includes(b))
            );
        }

        // Filtros por coluna
        for (const [key, val] of Object.entries(filtros)) {
            if (val && val.trim()) {
                const v = val.toLowerCase();
                resultado = resultado.filter(p => String(p[key as ColunaKey] ?? "").toLowerCase().includes(v));
            }
        }

        // Ordenação
        if (sortConfig) {
            const { key, dir } = sortConfig;
            resultado.sort((a, b) => {
                const valA = String(a[key] ?? "").toLowerCase();
                const valB = String(b[key] ?? "").toLowerCase();
                if (valA < valB) return dir === "asc" ? -1 : 1;
                if (valA > valB) return dir === "asc" ? 1 : -1;
                return 0;
            });
        }

        return resultado;
    }, [produtos, busca, filtros, sortConfig, colunasVisiveis]);

    const totalPaginas = Math.ceil(produtosProcessados.length / PAGE_SIZE);
    const produtosPaginados = useMemo(() =>
        produtosProcessados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE),
        [produtosProcessados, pagina]);

    const totalColSpan = colunasVisiveis.length + 1; // +1 para coluna de ações

    const limparFiltros = () => {
        setFiltros({});
        setBusca("");
        setSortConfig(null);
        setPagina(1);
    };

    const renderCelula = (produto: Produto, col: ColunaDef) => {
        const val = produto[col.key];
        if (val == null || val === "") return <span className="text-sm text-muted-foreground/50">—</span>;

        if (col.key === "nome") return <div className="max-w-[150px] sm:max-w-[250px] lg:max-w-[400px] truncate" title={val as string}><span className="text-sm font-medium">{val as string}</span></div>;
        if (col.tipo === "moeda") return <span className="text-sm whitespace-nowrap">{formatarMoeda(val as number)}</span>;
        if (col.tipo === "porcentagem") return <span className="text-sm">{formatarPorcentagem(val as number)}</span>;
        if (col.tipo === "data") return <span className="text-sm whitespace-nowrap">{new Date(val as string).toLocaleDateString()}</span>;
        if (col.tipo === "numero") return <span className="text-sm">{String(val).replace(".", ",")}</span>;

        return <div className="max-w-[150px] truncate" title={String(val)}><span className="text-sm">{String(val)}</span></div>;
    };

    return (
        <>
            <AlertDialog>
                <div className="space-y-6">
                    <SectionHeader
                        title="Produtos"
                        description="Gerencie seu catálogo de produtos."
                        action={
                            <Button size="sm" onClick={() => navigate("/produtos/cadastro")}>
                                <Plus size={16} className="mr-2" /> Novo Produto
                            </Button>
                        }
                    />

                    <div className="space-y-4">
                        {/* Barra de ferramentas */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar em todas as colunas..."
                                    value={busca}
                                    onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
                                    className="pl-10"
                                />
                            </div>
                            <ColunasPopover colunas={COLUNAS} visibilidade={colVisibilidade} onToggle={toggleColuna} />
                        </div>

                        {/* Indicadores de filtros ativos */}
                        {(filtrosAtivos > 0 || sortConfig) && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {sortConfig && (
                                    <Badge variant="secondary" className="gap-1 text-xs">
                                        Ordem: {COLUNAS.find(c => c.key === sortConfig.key)?.label} {sortConfig.dir === "asc" ? "A→Z" : "Z→A"}
                                        <button type="button" onClick={() => setSortConfig(null)}><X className="h-3 w-3" /></button>
                                    </Badge>
                                )}
                                {Object.entries(filtros).filter(([, v]) => v?.trim()).map(([key, val]) => (
                                    <Badge key={key} variant="secondary" className="gap-1 text-xs">
                                        {COLUNAS.find(c => c.key === key)?.label}: "{val}"
                                        <button type="button" onClick={() => handleFiltro(key as ColunaKey, "")}><X className="h-3 w-3" /></button>
                                    </Badge>
                                ))}
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={limparFiltros}>
                                    Limpar tudo
                                </Button>
                            </div>
                        )}

                        {/* Tabela */}
                        <div className="rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {colunasVisiveis.map(col => (
                                            <ColunaHeader
                                                key={col.key}
                                                label={col.label}
                                                colKey={col.key}
                                                sortConfig={sortConfig}
                                                onSort={handleSort}
                                                filtro={filtros[col.key] || ""}
                                                onFiltro={handleFiltro}
                                            />
                                        ))}
                                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={totalColSpan} className="h-24 text-center">Carregando...</TableCell></TableRow>
                                    ) : isError ? (
                                        <TableRow><TableCell colSpan={totalColSpan} className="h-24 text-center text-red-500">Erro ao carregar dados.</TableCell></TableRow>
                                    ) : produtosPaginados.length === 0 ? (
                                        <TableRow><TableCell colSpan={totalColSpan} className="h-24 text-center">Nenhum produto encontrado.</TableCell></TableRow>
                                    ) : (
                                        produtosPaginados.map((produto) => (
                                            <TableRow key={produto.id}>
                                                {colunasVisiveis.map(col => (
                                                    <TableCell key={col.key}>{renderCelula(produto, col)}</TableCell>
                                                ))}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" title="Adicionar ao Estoque" onClick={() => {
                                                            setEstoqueModal({ open: true, produto });
                                                            setEstoqueForm({ quantidade: "", preco_unitario: "", data_compra: obterDataHoje() });
                                                        }}>
                                                            <PackagePlus className="h-4 w-4 text-emerald-500" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" title="Histórico de Cálculos" onClick={() => setHistoricoModal({ open: true, produto })}>
                                                            <History className="h-4 w-4 text-primary" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" title="Editar" onClick={() => navigate(`/produtos/editar/${produto.id}`)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItemParaExcluir(produto)}>
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

                        {/* Paginação */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {produtosProcessados.length} {produtosProcessados.length === 1 ? "produto" : "produtos"}
                                {produtosProcessados.length !== produtos.length && ` (de ${produtos.length} total)`}
                            </p>
                            {totalPaginas > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium">{pagina} / {totalPaginas}</span>
                                    <Button variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O produto <span className="font-bold">{itemParaExcluir?.nome}</span> será excluído permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemParaExcluir(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(itemParaExcluir!.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <HistoricoCalculosModal
                open={historicoModal.open}
                produto={historicoModal.produto}
                onOpenChange={(open) => { if (!open) setHistoricoModal({ open: false, produto: null }); }}
            />

            {/* Modal de Entrada de Estoque */}
            <Dialog open={estoqueModal.open} onOpenChange={(open) => { if (!open) setEstoqueModal({ open: false, produto: null }); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>📦 Entrada de Estoque</DialogTitle>
                        <DialogDescription>
                            Registrar entrada de <span className="font-semibold">{estoqueModal.produto?.nome}</span> no Prep Center.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="est-qty">Quantidade Comprada *</Label>
                            <Input id="est-qty" type="number" min="1" value={estoqueForm.quantidade} onChange={(e) => setEstoqueForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex: 10" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="est-preco">Preço Unitário Pago (R$) *</Label>
                            <Input id="est-preco" type="number" step="0.01" min="0" value={estoqueForm.preco_unitario} onChange={(e) => setEstoqueForm(p => ({ ...p, preco_unitario: e.target.value }))} placeholder="Ex: 25.00" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="est-data">Data de Compra *</Label>
                            <Input id="est-data" type="date" value={estoqueForm.data_compra} onChange={(e) => setEstoqueForm(p => ({ ...p, data_compra: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEstoqueModal({ open: false, produto: null })}>Cancelar</Button>
                        <Button
                            disabled={entradaEstoqueMutation.isPending}
                            onClick={() => {
                                const qty = parseInt(estoqueForm.quantidade);
                                const preco = parseFloat(estoqueForm.preco_unitario);
                                if (!qty || qty <= 0) { toast.error("Quantidade deve ser maior que zero."); return; }
                                if (isNaN(preco) || preco < 0) { toast.error("Preço unitário inválido."); return; }
                                if (!estoqueForm.data_compra) { toast.error("Data de compra é obrigatória."); return; }
                                entradaEstoqueMutation.mutate({ produtoId: estoqueModal.produto!.id, quantidade: qty, precoUnitario: preco, dataCompra: estoqueForm.data_compra });
                            }}
                        >
                            {entradaEstoqueMutation.isPending ? "Salvando..." : "Registrar Entrada"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
