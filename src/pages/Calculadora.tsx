import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, TrendingDown, DollarSign, Package, Percent } from "lucide-react";
import { formatarMoeda, formatarPorcentagem } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CalculadoraInputs {
    preco: number;
    peso: number;
    comprimento: number;
    largura: number;
    altura: number;
    categoria: string;
    custoAquisicao: number;
    impostos: number;
    custoLogistica: number;
}

interface ResultadoCalculo {
    tarifaArmazenamento: number;
    tarifaLogistica: number;
    tarifaVenda: number;
    impostos: number;
    custoPorUnidade: number;
    lucroLiquido: number;
    margem: number;
    roi: number;
}

interface Categoria {
    id: string;
    nome: string;
}

const inputInicial: CalculadoraInputs = {
    preco: 0, peso: 0, comprimento: 0, largura: 0, altura: 0,
    categoria: "", custoAquisicao: 0, impostos: 0, custoLogistica: 0,
};

const resultadoInicial: ResultadoCalculo = {
    tarifaArmazenamento: 0, tarifaLogistica: 0, tarifaVenda: 0, impostos: 0,
    custoPorUnidade: 0, lucroLiquido: 0, margem: 0, roi: 0,
};

export default function Calculadora() {
    const [modo, setModo] = useState<"fba" | "fbm">("fba");
    const [inputs, setInputs] = useState<CalculadoraInputs>(inputInicial);
    const [resultado, setResultado] = useState<ResultadoCalculo>(resultadoInicial);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [calculando, setCalculando] = useState(false);

    useEffect(() => {
        supabase.from("categorias_comissao").select("id, nome").order("nome").then(({ data }) => {
            if (data) setCategorias(data);
        });
    }, []);

    const handleChange = (field: keyof CalculadoraInputs, value: string) => {
        setInputs(prev => ({ ...prev, [field]: value === "" ? 0 : Number(value) }));
    };

    const handleCategoriaChange = (value: string) => {
        setInputs(prev => ({ ...prev, categoria: value }));
    };

    const calcular = async () => {
        setCalculando(true);
        try {
            if (modo === "fba") {
                await calcularFBA();
            } else {
                await calcularFBM();
            }
        } catch (err) {
            console.error("Erro no cálculo:", err);
        } finally {
            setCalculando(false);
        }
    };

    const calcularFBA = async () => {
        // Buscar configs
        const { data: configsTarifa } = await supabase.from("fba_configs_tarifa").select("*").single();

        // Peso dimensional
        const pesoDimensional = configsTarifa
            ? (inputs.comprimento * inputs.largura * inputs.altura) / configsTarifa.divisor_peso_dimensional * 1000
            : 0;
        const pesoBase = Math.max(inputs.peso, pesoDimensional);
        const pesoFinal = pesoBase + (configsTarifa?.peso_embalagem_padrao_gramas || 0);

        // Buscar nível de preço
        const { data: nivelPreco } = await supabase
            .from("fba_niveis_preco_tarifa")
            .select("*")
            .lte("preco_min_brl", inputs.preco)
            .gte("preco_max_brl", inputs.preco)
            .single();

        let tarifaLogistica = 0;
        const pesoMaxFaixas = configsTarifa?.peso_max_faixas_tarifa_gramas || 10000;

        if (pesoFinal <= pesoMaxFaixas && nivelPreco) {
            const { data: faixaPeso } = await supabase
                .from("fba_faixas_peso_tarifa")
                .select("*")
                .eq("id_nivel_preco", nivelPreco.id)
                .gt("peso_min_gramas_exclusivo", inputs.peso)
                .lte("peso_max_gramas_inclusivo", inputs.peso)
                .single();
            if (faixaPeso) tarifaLogistica = faixaPeso.taxa_brl;
        } else if (nivelPreco) {
            const { data: tarifaBase10kg } = await supabase
                .from("fba_faixas_peso_tarifa")
                .select("*")
                .eq("id_nivel_preco", nivelPreco.id)
                .eq("peso_max_gramas_inclusivo", 10000)
                .single();
            if (tarifaBase10kg) {
                const pesoExcedente = pesoFinal - pesoMaxFaixas;
                const kgsAdicionais = Math.ceil(pesoExcedente / 1000);
                tarifaLogistica = tarifaBase10kg.taxa_brl + kgsAdicionais * (nivelPreco.taxa_kg_adicional_brl || 0);
            }
        }

        // Armazenamento
        const volumeCm3 = inputs.comprimento * inputs.largura * inputs.altura;
        const volumeM3 = volumeCm3 / 1000000;
        const { data: regraArm } = await supabase
            .from("regras_tarifas_armazenamento")
            .select("*")
            .eq("tipo_cobranca", "MENSAL")
            .gte("volume_unitario_min_cm3", volumeCm3)
            .lte("volume_unitario_max_cm3", volumeCm3)
            .single();
        const tarifaArmazenamento = regraArm ? volumeM3 * regraArm.taxa_mensal_m3 : 0;

        // Comissão
        const { data: regraComissao } = await supabase
            .from("regras_comissao_venda")
            .select("*")
            .eq("id_categoria", inputs.categoria)
            .single();

        let comissaoBruta = 0;
        if (regraComissao) {
            if (regraComissao.tipo_regra === "PADRAO") {
                comissaoBruta = inputs.preco * regraComissao.percentual_padrao;
            } else {
                if (inputs.preco <= regraComissao.limite_preco_nivel1_brl) {
                    comissaoBruta = inputs.preco * regraComissao.percentual_ate_limite_nivel1;
                } else {
                    comissaoBruta = (regraComissao.limite_preco_nivel1_brl * regraComissao.percentual_sobre_limite_nivel1) +
                        ((inputs.preco - regraComissao.limite_preco_nivel1_brl) * regraComissao.percentual_acima_limite_nivel1);
                }
            }
        }
        const tarifaVenda = regraComissao ? Math.max(comissaoBruta, regraComissao.comissao_minima_brl) : comissaoBruta;

        // Calcular
        const valorImpostos = (inputs.impostos / 100) * inputs.preco;
        const custoPorUnidade = tarifaArmazenamento + tarifaLogistica + tarifaVenda + valorImpostos + inputs.custoAquisicao;
        const lucroLiquido = inputs.preco - custoPorUnidade;
        const margem = inputs.preco > 0 ? (lucroLiquido / inputs.preco) * 100 : 0;
        const roi = inputs.custoAquisicao > 0 ? (lucroLiquido / inputs.custoAquisicao) * 100 : 0;

        setResultado({ tarifaArmazenamento, tarifaLogistica, tarifaVenda, impostos: valorImpostos, custoPorUnidade, lucroLiquido, margem, roi });
    };

    const calcularFBM = async () => {
        // Comissão
        const { data: regraComissao } = await supabase
            .from("regras_comissao_venda")
            .select("*")
            .eq("id_categoria", inputs.categoria)
            .single();

        let comissaoBruta = 0;
        if (regraComissao) {
            if (regraComissao.tipo_regra === "PADRAO") {
                comissaoBruta = inputs.preco * regraComissao.percentual_padrao;
            } else {
                if (inputs.preco <= regraComissao.limite_preco_nivel1_brl) {
                    comissaoBruta = inputs.preco * regraComissao.percentual_ate_limite_nivel1;
                } else {
                    comissaoBruta = (regraComissao.limite_preco_nivel1_brl * regraComissao.percentual_sobre_limite_nivel1) +
                        ((inputs.preco - regraComissao.limite_preco_nivel1_brl) * regraComissao.percentual_acima_limite_nivel1);
                }
            }
        }
        const tarifaVenda = regraComissao ? Math.max(comissaoBruta, regraComissao.comissao_minima_brl) : comissaoBruta;

        const valorImpostos = (inputs.impostos / 100) * inputs.preco;
        const custoPorUnidade = tarifaVenda + valorImpostos + inputs.custoAquisicao + inputs.custoLogistica;
        const lucroLiquido = inputs.preco - custoPorUnidade;
        const margem = inputs.preco > 0 ? (lucroLiquido / inputs.preco) * 100 : 0;
        const roi = inputs.custoAquisicao > 0 ? (lucroLiquido / inputs.custoAquisicao) * 100 : 0;

        setResultado({
            tarifaArmazenamento: 0,
            tarifaLogistica: inputs.custoLogistica,
            tarifaVenda,
            impostos: valorImpostos,
            custoPorUnidade,
            lucroLiquido,
            margem,
            roi,
        });
    };

    const limpar = () => {
        setInputs(inputInicial);
        setResultado(resultadoInicial);
    };

    return (
        <div className="space-y-6">
            <SectionHeader title="Calculadora de Lucratividade" description="Calcule a lucratividade dos seus produtos na Amazon (FBA e FBM)." />

            <Tabs value={modo} onValueChange={(v) => { setModo(v as "fba" | "fbm"); setResultado(resultadoInicial); }}>
                <TabsList>
                    <TabsTrigger value="fba">FBA</TabsTrigger>
                    <TabsTrigger value="fbm">FBM</TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Inputs */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" /> Dados do Produto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Preço de Venda (R$)</Label>
                                <Input type="number" step="0.01" value={inputs.preco || ""} onChange={e => handleChange("preco", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo de Aquisição (R$)</Label>
                                <Input type="number" step="0.01" value={inputs.custoAquisicao || ""} onChange={e => handleChange("custoAquisicao", e.target.value)} placeholder="0,00" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <Select value={inputs.categoria} onValueChange={handleCategoriaChange}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {categorias.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Impostos (%)</Label>
                                <Input type="number" step="0.1" value={inputs.impostos || ""} onChange={e => handleChange("impostos", e.target.value)} placeholder="0" />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Peso (gramas)</Label>
                                <Input type="number" value={inputs.peso || ""} onChange={e => handleChange("peso", e.target.value)} placeholder="0" />
                            </div>
                            {modo === "fbm" && (
                                <div className="space-y-2">
                                    <Label>Custo Logística (R$)</Label>
                                    <Input type="number" step="0.01" value={inputs.custoLogistica || ""} onChange={e => handleChange("custoLogistica", e.target.value)} placeholder="0,00" />
                                </div>
                            )}
                        </div>

                        {modo === "fba" && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Comp. (cm)</Label>
                                    <Input type="number" step="0.1" value={inputs.comprimento || ""} onChange={e => handleChange("comprimento", e.target.value)} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Larg. (cm)</Label>
                                    <Input type="number" step="0.1" value={inputs.largura || ""} onChange={e => handleChange("largura", e.target.value)} placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Alt. (cm)</Label>
                                    <Input type="number" step="0.1" value={inputs.altura || ""} onChange={e => handleChange("altura", e.target.value)} placeholder="0" />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button onClick={calcular} disabled={calculando} className="flex-1">
                                {calculando ? "Calculando..." : "Calcular"}
                            </Button>
                            <Button variant="outline" onClick={limpar}>Limpar</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Results */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Resultado</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className={cn(
                            "rounded-xl p-4 text-center",
                            resultado.lucroLiquido > 0 ? "bg-emerald-500/10" : resultado.lucroLiquido < 0 ? "bg-red-500/10" : "bg-muted"
                        )}>
                            <p className="text-xs text-muted-foreground mb-1">Lucro Líquido</p>
                            <p className={cn(
                                "text-3xl font-bold",
                                resultado.lucroLiquido > 0 ? "text-emerald-600 dark:text-emerald-400" : resultado.lucroLiquido < 0 ? "text-red-600 dark:text-red-400" : ""
                            )}>
                                {formatarMoeda(resultado.lucroLiquido)}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                                <Percent className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Margem</p>
                                <p className="text-lg font-bold">{formatarPorcentagem(resultado.margem)}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">ROI</p>
                                <p className="text-lg font-bold">{formatarPorcentagem(resultado.roi)}</p>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detalhamento</p>
                            {[
                                { label: "Preço de Venda", value: inputs.preco, icon: DollarSign },
                                { label: "Comissão Amazon", value: -resultado.tarifaVenda, icon: Package },
                                ...(modo === "fba" ? [
                                    { label: "Tarifa Logística", value: -resultado.tarifaLogistica, icon: Package },
                                    { label: "Armazenamento", value: -resultado.tarifaArmazenamento, icon: Package },
                                ] : [
                                    { label: "Custo Logística", value: -resultado.tarifaLogistica, icon: Package },
                                ]),
                                { label: "Impostos", value: -resultado.impostos, icon: TrendingDown },
                                { label: "Custo Aquisição", value: -inputs.custoAquisicao, icon: TrendingDown },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <span className="text-sm">{item.label}</span>
                                    <span className={cn("text-sm font-medium", item.value < 0 ? "text-red-500" : "text-emerald-500")}>
                                        {formatarMoeda(Math.abs(item.value))}
                                    </span>
                                </div>
                            ))}
                            <Separator />
                            <div className="flex items-center justify-between py-1">
                                <span className="text-sm font-bold">Custo Total</span>
                                <span className="text-sm font-bold text-red-500">{formatarMoeda(resultado.custoPorUnidade)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
