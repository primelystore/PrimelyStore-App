import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Megaphone,
    TrendingUp,
    AlertTriangle,
    Copy,
    Crosshair,
    Target,
    DollarSign,
    ClipboardCheck,
    Info,
    Bot,
    Loader2,
    CheckCircle2,
    XCircle,
    HelpCircle,
} from "lucide-react";
import { cn, formatCentsToBRL, parseBRLCentsFromInput } from "@/lib/utils";
import {
    calcAdsFinancials,
    buildOutputJSON,
    GOAL_LABELS,
    type AdsInput,
    type AdsGoal,
    type AdsResult,
} from "@/lib/ads/calcAdsFinancials";
import { computeCMP, money, fromMoney, type Deposito, type MovementNormalized, type TipoMov } from "@/lib/costing";
import { toast } from "sonner";

// ── Tipos ──────────────────────────────────────────────────────

interface ProdutoOption {
    id: string;
    nome: string;
    sku: string | null;
    asin: string | null;
}

interface AdsFormState {
    produtoId: string;
    asin: string;
    sellPriceCents: number;
    productCostCents: number;
    prepCostCents: number;
    feeCommissionCents: number;
    feeFulfillmentCents: number;
    feeStorageCents: number;
    feeOtherCents: number;
    taxPercent: number;
    dailyBudgetCents: number;
    goal: AdsGoal;
    cvrPercent: string;
}

type AiJobStatus = "IDLE" | "SUBMITTING" | "PENDING" | "OK" | "NEEDS_INPUT" | "API_ERROR";

interface AiJobState {
    jobId: string | null;
    publicToken: string | null;
    status: AiJobStatus;
    resultJson: Record<string, unknown> | null;
    renderMarkdown: string | null;
    errorMessage: string | null;
}

const initialFormState: AdsFormState = {
    produtoId: "",
    asin: "",
    sellPriceCents: 0,
    productCostCents: 0,
    prepCostCents: 0,
    feeCommissionCents: 0,
    feeFulfillmentCents: 0,
    feeStorageCents: 0,
    feeOtherCents: 0,
    taxPercent: 0,
    dailyBudgetCents: 5000,
    goal: "profit",
    cvrPercent: "",
};

const initialAiState: AiJobState = {
    jobId: null,
    publicToken: null,
    status: "IDLE",
    resultJson: null,
    renderMarkdown: null,
    errorMessage: null,
};

const LS_KEY = "primely-ads-ai-job";

// ── Componente principal ───────────────────────────────────────

export default function AmazonAds() {
    const [form, setForm] = useState<AdsFormState>(initialFormState);
    const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
    const custoAutoRef = useRef(true);
    const [aiJob, setAiJob] = useState<AiJobState>(initialAiState);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Carregar produtos + imposto + job pendente do localStorage ──

    useEffect(() => {
        supabase
            .from("produtos")
            .select("id, nome, sku, asin")
            .order("nome")
            .then(({ data }) => {
                if (data) setProdutos(data as ProdutoOption[]);
            });

        (async () => {
            const { data } = await supabase
                .from("app_config")
                .select("imposto_venda_pct")
                .eq("id", 1)
                .maybeSingle();
            const imposto = Number(data?.imposto_venda_pct ?? 0);
            if (imposto > 0) setForm(prev => ({ ...prev, taxPercent: imposto }));
        })();

        // Recuperar job pendente do localStorage
        try {
            const saved = localStorage.getItem(LS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.jobId && parsed?.publicToken) {
                    setAiJob({
                        ...initialAiState,
                        jobId: parsed.jobId,
                        publicToken: parsed.publicToken,
                        status: "PENDING",
                    });
                }
            }
        } catch { /* ignore */ }
    }, []);

    // ── Helpers de mudança do form ──────────────────────────────

    const setCents = (field: keyof AdsFormState, raw: string) => {
        const cents = parseBRLCentsFromInput(raw);
        if (field === "productCostCents") custoAutoRef.current = false;
        setForm(prev => ({ ...prev, [field]: cents }));
    };

    const setNumber = (field: keyof AdsFormState, raw: string) => {
        const n = raw === "" ? 0 : Number(raw);
        setForm(prev => ({ ...prev, [field]: n }));
    };

    // ── CMP do estoque amazon_fba ──────────────────────────────

    async function preencherCMP(produtoId: string) {
        const deposito: Deposito = "amazon_fba";
        const { data, error } = await supabase
            .from("estoque_movimentacoes")
            .select("id, produto_id, tipo, deposito_origem, deposito_destino, quantidade, preco_unitario, data_movimentacao, created_at")
            .eq("produto_id", produtoId)
            .order("data_movimentacao", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) { console.warn("Erro ao buscar CMP:", error); return; }

        const moves = (data || []) as Array<{
            id: string; produto_id: string; tipo: TipoMov;
            deposito_origem: Deposito | null; deposito_destino: Deposito | null;
            quantidade: number; preco_unitario: number;
            data_movimentacao: string; created_at: string;
        }>;

        const normalized: MovementNormalized[] = moves.map(m => ({
            id: m.id, produtoId: m.produto_id, tipo: m.tipo,
            origem: m.deposito_origem, destino: m.deposito_destino,
            quantidade: m.quantidade,
            custoInformadoUnit: m.tipo === "entrada" ? money(m.preco_unitario) : undefined,
            precoUnitarioRelatorio: money(m.preco_unitario),
            dataMov: m.data_movimentacao, createdAt: m.created_at,
            occurredAt: new Date(m.data_movimentacao),
            sortKey: `${m.data_movimentacao}|${m.created_at}|${m.id}`,
        }));

        const cmp = computeCMP(normalized);
        const pState = cmp.stock.get(produtoId);
        const unit = pState?.positions[deposito]?.custoMedio ?? 0n;
        const unitBRL = fromMoney(unit);
        setForm(prev => ({ ...prev, productCostCents: Math.round((unitBRL || 0) * 100) }));
    }

    const handleProdutoChange = async (produtoId: string) => {
        custoAutoRef.current = true;
        const prod = produtos.find(p => p.id === produtoId);
        setForm(prev => ({ ...prev, produtoId, asin: prod?.asin ?? "" }));
        await preencherCMP(produtoId);
    };

    // ── Cálculo determinístico ─────────────────────────────────

    const adsInput = useMemo((): AdsInput => {
        const cvrRaw = form.cvrPercent.trim();
        const cvr = cvrRaw ? Number(cvrRaw) / 100 : null;
        return {
            asin_or_sku: form.asin || "N/A",
            sell_price: form.sellPriceCents / 100,
            product_cost: form.productCostCents / 100,
            prep_cost: form.prepCostCents / 100,
            inbound_shipping_cost: 0, extra_packaging_cost: 0,
            fees: {
                commission: form.feeCommissionCents / 100,
                fulfillment: form.feeFulfillmentCents / 100,
                storage: form.feeStorageCents / 100,
                other: form.feeOtherCents / 100,
            },
            tax: { mode: "percent", value: form.taxPercent },
            daily_budget: form.dailyBudgetCents / 100,
            goal: form.goal,
            cvr_estimate: cvr && cvr > 0 ? cvr : null,
        };
    }, [form]);

    const result: AdsResult = useMemo(() => calcAdsFinancials(adsInput), [adsInput]);
    const outputJSON = useMemo(() => buildOutputJSON(adsInput, result), [adsInput, result]);

    // ── Copiar JSON ────────────────────────────────────────────

    const handleCopyJSON = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(outputJSON, null, 2));
            toast.success("JSON copiado para a área de transferência!");
        } catch { toast.error("Falha ao copiar."); }
    };

    // ── IA: Polling ────────────────────────────────────────────

    const pollStatus = useCallback(async (jobId: string, publicToken: string) => {
        try {
            const res = await supabase.functions.invoke("ads-ai-status", {
                body: { job_id: jobId, public_token: publicToken },
            });

            if (res.error) {
                console.error("Polling error:", res.error);
                return;
            }

            const data = res.data;
            if (!data) return;

            if (data.status && data.status !== "PENDING") {
                // Job concluído — parar polling
                setAiJob(prev => ({
                    ...prev,
                    status: data.status as AiJobStatus,
                    resultJson: data.result_json ?? null,
                    renderMarkdown: data.render_markdown ?? null,
                    errorMessage: data.error_message ?? null,
                }));
                localStorage.removeItem(LS_KEY);
            }
        } catch (err) {
            console.error("Polling exception:", err);
        }
    }, []);

    // Iniciar/parar polling quando status muda
    useEffect(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        if (aiJob.status === "PENDING" && aiJob.jobId && aiJob.publicToken) {
            // Poll imediatamente e depois a cada 3s
            pollStatus(aiJob.jobId, aiJob.publicToken);
            pollingRef.current = setInterval(() => {
                pollStatus(aiJob.jobId!, aiJob.publicToken!);
            }, 3000);
        }

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [aiJob.status, aiJob.jobId, aiJob.publicToken, pollStatus]);

    // ── IA: Submit ─────────────────────────────────────────────

    const handleSubmitAI = async () => {
        if (aiJob.status === "SUBMITTING" || aiJob.status === "PENDING") return;

        setAiJob({ ...initialAiState, status: "SUBMITTING" });

        try {
            const res = await supabase.functions.invoke("ads-ai-submit", {
                body: { payload: outputJSON },
            });

            if (res.error) {
                let detail = "";
                try {
                    if ((res.error as any).context) detail = await (res.error as any).context.text();
                } catch { /* ignore */ }
                throw new Error(detail || res.error.message || "Erro desconhecido");
            }

            const { job_id, public_token } = res.data;

            if (!job_id || !public_token) throw new Error("Resposta inválida do submit");

            // Salvar no localStorage para recuperar em refresh
            localStorage.setItem(LS_KEY, JSON.stringify({ jobId: job_id, publicToken: public_token }));

            setAiJob({
                ...initialAiState,
                jobId: job_id,
                publicToken: public_token,
                status: "PENDING",
            });

            toast.success("Job enviado! Aguardando resposta da IA...");
        } catch (err: any) {
            console.error("Submit AI error:", err);
            setAiJob({ ...initialAiState, status: "API_ERROR", errorMessage: err?.message ?? "Erro ao enviar" });
            toast.error("Falha ao enviar para IA: " + (err?.message ?? ""));
        }
    };

    const handleResetAI = () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        localStorage.removeItem(LS_KEY);
        setAiJob(initialAiState);
    };

    // ── Helpers de exibição ────────────────────────────────────

    const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const hasAlert = result.financials.contribution_profit <= 0;
    const needsCvr = result.status === "NEEDS_INPUT";
    const showBids = result.bids != null;

    // ── Render ─────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Amazon Ads"
                description="Planeje campanhas Sponsored Products com cálculos de ACoS, CPC e bids."
            />

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ─── CARD ENTRADAS ─── */}
                <Card className="lg:row-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Megaphone className="h-4 w-4" /> Entradas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Produto */}
                        <div className="space-y-2">
                            <Label>Produto</Label>
                            <Select value={form.produtoId} onValueChange={handleProdutoChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um produto cadastrado..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {produtos.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.nome}{p.sku ? ` — ${p.sku}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Custo preenchido via CMP do depósito <span className="font-medium">amazon_fba</span> (se houver).
                            </p>
                        </div>

                        {/* ASIN */}
                        <div className="space-y-2">
                            <Label>ASIN / SKU</Label>
                            <Input
                                value={form.asin}
                                onChange={e => setForm(prev => ({ ...prev, asin: e.target.value.toUpperCase() }))}
                                placeholder="B0XXXXXXXX"
                                maxLength={20}
                            />
                        </div>

                        <Separator />

                        {/* Preço + Custo */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Preço de Venda (R$)</Label>
                                <Input
                                    value={form.sellPriceCents ? formatCentsToBRL(form.sellPriceCents) : ""}
                                    onChange={e => setCents("sellPriceCents", e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo do Produto (R$)</Label>
                                <Input
                                    value={form.productCostCents ? formatCentsToBRL(form.productCostCents) : ""}
                                    onChange={e => setCents("productCostCents", e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Prep + Imposto */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prep Center (R$)</Label>
                                <Input
                                    value={form.prepCostCents ? formatCentsToBRL(form.prepCostCents) : ""}
                                    onChange={e => setCents("prepCostCents", e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Imposto (%)</Label>
                                <Input
                                    type="number" step="0.1"
                                    value={form.taxPercent || ""}
                                    onChange={e => setNumber("taxPercent", e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Fees */}
                        <div>
                            <p className="text-sm font-medium mb-3">Fees por unidade (R$)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Comissão</Label>
                                    <Input value={form.feeCommissionCents ? formatCentsToBRL(form.feeCommissionCents) : ""} onChange={e => setCents("feeCommissionCents", e.target.value)} placeholder="0,00" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Fulfillment / FBA</Label>
                                    <Input value={form.feeFulfillmentCents ? formatCentsToBRL(form.feeFulfillmentCents) : ""} onChange={e => setCents("feeFulfillmentCents", e.target.value)} placeholder="0,00" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Armazenamento</Label>
                                    <Input value={form.feeStorageCents ? formatCentsToBRL(form.feeStorageCents) : ""} onChange={e => setCents("feeStorageCents", e.target.value)} placeholder="0,00" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Outros</Label>
                                    <Input value={form.feeOtherCents ? formatCentsToBRL(form.feeOtherCents) : ""} onChange={e => setCents("feeOtherCents", e.target.value)} placeholder="0,00" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Orçamento + CVR */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Orçamento Diário (R$)</Label>
                                <Input value={form.dailyBudgetCents ? formatCentsToBRL(form.dailyBudgetCents) : ""} onChange={e => setCents("dailyBudgetCents", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label>CVR Estimada (%)</Label>
                                <Input type="number" step="0.1" min="0" max="100" value={form.cvrPercent} onChange={e => setForm(prev => ({ ...prev, cvrPercent: e.target.value }))} placeholder="Ex: 8" />
                                <p className="text-[11px] text-muted-foreground">Opcional. Se vazio, max CPC e bids não serão calculados.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Objetivo</Label>
                            <Select value={form.goal} onValueChange={(v: string) => setForm(prev => ({ ...prev, goal: v as AdsGoal }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(GOAL_LABELS) as AdsGoal[]).map(g => (
                                        <SelectItem key={g} value={g}>
                                            {GOAL_LABELS[g]} ({Math.round(({ profit: 0.70, defend: 0.80, test: 0.85, rank: 0.95, launch: 1.10, clearance: 1.00 })[g] * 100)}% do BE ACoS)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* ─── CARD RESULTADOS ─── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4" /> Resultados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Alertas */}
                        {hasAlert && (
                            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span><strong>Lucro de contribuição ≤ 0.</strong> Não é recomendado rodar Ads até ajustar preço, custos ou fees.</span>
                            </div>
                        )}
                        {needsCvr && !hasAlert && (
                            <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                                <span><strong>NEEDS_INPUT:</strong> Preencha a CVR estimada para calcular Max CPC e bids sugeridos.</span>
                            </div>
                        )}

                        {/* Métricas */}
                        <div className="grid grid-cols-2 gap-4">
                            <MetricCard label="Lucro de Contribuição" value={fmtBRL(result.financials.contribution_profit)} icon={<DollarSign className="h-4 w-4" />} variant={result.financials.contribution_profit > 0 ? "positive" : "negative"} />
                            <MetricCard label="Break-even ACoS" value={fmtPct(result.financials.break_even_acos)} icon={<Crosshair className="h-4 w-4" />} variant={result.financials.break_even_acos > 0 ? "neutral" : "negative"} />
                            <MetricCard label="Target ACoS Recomendado" value={fmtPct(result.financials.recommended_target_acos)} icon={<Target className="h-4 w-4" />} variant="neutral" />
                            {showBids && result.financials.max_cpc != null && (
                                <MetricCard label="Max CPC" value={fmtBRL(result.financials.max_cpc)} icon={<TrendingUp className="h-4 w-4" />} variant="positive" />
                            )}
                        </div>

                        {/* Tabela de Bids */}
                        {showBids && result.bids && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium mb-3">Bids Sugeridos (R$)</p>
                                    <div className="rounded-lg border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50">
                                                    <th className="text-left px-3 py-2 font-medium">Campanha</th>
                                                    <th className="text-right px-3 py-2 font-medium">Bid</th>
                                                    <th className="text-right px-3 py-2 font-medium">Mult.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {([
                                                    { label: "Auto (Harvest)", key: "auto" as const, mult: "75%" },
                                                    { label: "Broad", key: "broad" as const, mult: "70%" },
                                                    { label: "Phrase", key: "phrase" as const, mult: "80%" },
                                                    { label: "Exact", key: "exact" as const, mult: "90%" },
                                                    { label: "Product Targeting", key: "product" as const, mult: "80%" },
                                                ]).map(row => (
                                                    <tr key={row.key} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                                                        <td className="px-3 py-2">{row.label}</td>
                                                        <td className="px-3 py-2 text-right font-mono font-medium">{fmtBRL(result.bids![row.key])}</td>
                                                        <td className="px-3 py-2 text-right text-muted-foreground">{row.mult}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Detalhes */}
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>Custo variável total: {fmtBRL(result.financials.total_variable_cost)}</p>
                            <p>Objetivo: {GOAL_LABELS[form.goal]}</p>
                            {result.financials.assumptions.map((a, i) => <p key={i} className="italic">{a}</p>)}
                        </div>

                        {/* Botões: Copiar JSON + Enviar para IA */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={handleCopyJSON} className="w-full gap-2" variant="outline">
                                <Copy className="h-4 w-4" /> Copiar JSON
                            </Button>
                            <Button
                                onClick={handleSubmitAI}
                                className="w-full gap-2"
                                disabled={aiJob.status === "SUBMITTING" || aiJob.status === "PENDING" || form.sellPriceCents <= 0}
                            >
                                {aiJob.status === "SUBMITTING" || aiJob.status === "PENDING"
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Bot className="h-4 w-4" />
                                }
                                {aiJob.status === "SUBMITTING" ? "Enviando..." :
                                    aiJob.status === "PENDING" ? "Aguardando IA..." : "Enviar para IA"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* ─── CARD RESPOSTA IA ─── */}
                {aiJob.status !== "IDLE" && (
                    <Card className={cn(
                        "transition-all",
                        aiJob.status === "OK" && "border-emerald-500/30",
                        aiJob.status === "API_ERROR" && "border-destructive/30",
                        aiJob.status === "NEEDS_INPUT" && "border-yellow-500/30",
                    )}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base">
                                <span className="flex items-center gap-2">
                                    <Bot className="h-4 w-4" /> Resposta IA
                                </span>
                                {aiJob.status !== "PENDING" && aiJob.status !== "SUBMITTING" && (
                                    <Button variant="ghost" size="sm" onClick={handleResetAI} className="text-xs">
                                        Limpar
                                    </Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* SUBMITTING / PENDING */}
                            {(aiJob.status === "SUBMITTING" || aiJob.status === "PENDING") && (
                                <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm font-medium">
                                        {aiJob.status === "SUBMITTING" ? "Enviando dados..." : "Processando com IA..."}
                                    </p>
                                    <p className="text-xs">Isso pode levar alguns segundos.</p>
                                </div>
                            )}

                            {/* OK */}
                            {aiJob.status === "OK" && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-emerald-500">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="font-medium">Análise concluída!</span>
                                    </div>

                                    {aiJob.renderMarkdown && (
                                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-muted/30 p-4 text-sm">
                                            {aiJob.renderMarkdown}
                                        </div>
                                    )}

                                    {aiJob.resultJson && !aiJob.renderMarkdown && (
                                        <pre className="rounded-lg bg-muted/30 p-4 text-xs overflow-auto max-h-96 font-mono">
                                            {JSON.stringify(aiJob.resultJson, null, 2)}
                                        </pre>
                                    )}

                                    {aiJob.resultJson && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={async () => {
                                                await navigator.clipboard.writeText(JSON.stringify(aiJob.resultJson, null, 2));
                                                toast.success("JSON da IA copiado!");
                                            }}
                                        >
                                            <Copy className="h-3 w-3" /> Copiar JSON da IA
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* NEEDS_INPUT */}
                            {aiJob.status === "NEEDS_INPUT" && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                                        <HelpCircle className="h-5 w-5" />
                                        <span className="font-medium">A IA precisa de mais informações</span>
                                    </div>

                                    {aiJob.renderMarkdown && (
                                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-yellow-500/5 p-4 text-sm">
                                            {aiJob.renderMarkdown}
                                        </div>
                                    )}

                                    {aiJob.resultJson && (
                                        <pre className="rounded-lg bg-muted/30 p-4 text-xs overflow-auto max-h-96 font-mono">
                                            {JSON.stringify(aiJob.resultJson, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}

                            {/* API_ERROR */}
                            {aiJob.status === "API_ERROR" && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-destructive">
                                        <XCircle className="h-5 w-5" />
                                        <span className="font-medium">Erro ao processar</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {aiJob.errorMessage || "Ocorreu um erro inesperado. Tente novamente."}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ─── CARD CHECKLIST / OTIMIZAÇÃO ─── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ClipboardCheck className="h-4 w-4" /> Checklist & Otimização
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div>
                            <p className="text-sm font-medium mb-2">📋 Checklist de Lançamento</p>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                                <li>Listing otimizado: título, imagens, bullet points e atributos</li>
                                <li>Estoque suficiente (evitar pausa por falta de estoque)</li>
                                <li>Preço compatível com o mercado</li>
                                <li>Objetivo definido: <strong>{GOAL_LABELS[form.goal]}</strong></li>
                                <li>Target ACoS: <strong>{fmtPct(result.financials.recommended_target_acos)}</strong></li>
                            </ul>
                        </div>
                        <Separator />
                        <div>
                            <p className="text-sm font-medium mb-2">🔧 Otimização D+3</p>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                                <li>Negativar termos obviamente irrelevantes</li>
                                <li>Reduzir bids em targets que drenam budget rápido</li>
                                <li>Verificar se Manual não está brigando com Auto</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-2">🔧 Otimização D+7</p>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                                <li>Harvest: termos com venda → mover para Phrase/Exact</li>
                                <li>Pausar targets com gasto alto e 0 vendas (12-20 cliques)</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-2">🔧 Otimização D+14</p>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                                <li>Separar campeões em campanhas próprias</li>
                                <li>Expandir Product Targeting (concorrentes específicos)</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-2">🔧 Otimização D+30</p>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                                <li>Refinar negativas por intenção</li>
                                <li>Avaliar TACoS (total ACoS incluindo vendas orgânicas)</li>
                                <li>Ajustar bids conforme performance real</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ── MetricCard ─────────────────────────────────────────────────

function MetricCard({ label, value, icon, variant }: {
    label: string; value: string; icon: React.ReactNode;
    variant: "positive" | "negative" | "neutral";
}) {
    return (
        <div className={cn(
            "rounded-lg border p-3 transition-all",
            variant === "positive" && "bg-emerald-500/5 border-emerald-500/20",
            variant === "negative" && "bg-destructive/5 border-destructive/20",
            variant === "neutral" && "bg-muted/30 border-border",
        )}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className={cn(
                    variant === "positive" && "text-emerald-500",
                    variant === "negative" && "text-destructive",
                    variant === "neutral" && "text-muted-foreground",
                )}>{icon}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={cn(
                "text-lg font-bold tracking-tight",
                variant === "positive" && "text-emerald-500",
                variant === "negative" && "text-destructive",
            )}>{value}</p>
        </div>
    );
}
