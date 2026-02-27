import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, TrendingUp, TrendingDown, DollarSign, Package, Percent } from "lucide-react";
import { cn, formatarMoeda, formatarPorcentagem, formatCentsToBRL, parseBRLCentsFromInput } from "@/lib/utils";
import { computeCMP, money, fromMoney, type Deposito, type MovementNormalized, type TipoMov } from "@/lib/costing";
import { toast } from "sonner";

interface ProdutoOption {
    id: string;
    nome: string;
    sku: string | null;
    asin: string | null;
    peso_gramas: number | null;
    comprimento_cm: number | null;
    largura_cm: number | null;
    altura_cm: number | null;
}

interface CalculadoraInputs {
    produtoId: string;
    precoCents: number;

    peso: number;
    comprimento: number;
    largura: number;
    altura: number;

    categoria: string;
    custoAquisicaoCents: number;
    impostos: number; // %
    custoPrepCenterCents: number;

    taxaComissaoManualCents: number;
    tarifaLogisticaManualCents: number;
    tarifaArmazenamentoManualCents: number;
    envioAmazonManualCents: number;
    outrasTaxasAmazonManualCents: number;
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
    produtoId: "",
    precoCents: 0,
    peso: 0,
    comprimento: 0,
    largura: 0,
    altura: 0,
    categoria: "",
    custoAquisicaoCents: 0,
    impostos: 0,
    custoPrepCenterCents: 0,
    taxaComissaoManualCents: 0,
    tarifaLogisticaManualCents: 0,
    tarifaArmazenamentoManualCents: 0,
    envioAmazonManualCents: 0,
    outrasTaxasAmazonManualCents: 0,
};

const resultadoInicial: ResultadoCalculo = {
    tarifaArmazenamento: 0,
    tarifaLogistica: 0,
    tarifaVenda: 0,
    impostos: 0,
    custoPorUnidade: 0,
    lucroLiquido: 0,
    margem: 0,
    roi: 0,
};

function depositoPadraoPorModo(modo: "fba" | "fbm"): Deposito {
    // Premissa prática:
    // - FBA: custo baseado no estoque "amazon_fba" (pois é de onde sai a venda)
    // - FBM: custo baseado no estoque no Prep Center
    return modo === "fba" ? "amazon_fba" : "prep_center";
}

export default function Calculadora() {
    const [modo, setModo] = useState<"fba" | "fbm">("fba");
    const [fonteTaxas, setFonteTaxas] = useState<"tabela" | "manual" | "amazon">("tabela");
    const usarCalculoAutomatico = fonteTaxas === "tabela";
    const [inputs, setInputs] = useState<CalculadoraInputs>(inputInicial);
    const [resultado, setResultado] = useState<ResultadoCalculo>(resultadoInicial);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
    const [projetos, setProjetos] = useState<ProdutoOption[]>([]); // dummy se por acaso tiver (não tem)
    const [calculando, setCalculando] = useState(false);
    const [buscandoAmazon, setBuscandoAmazon] = useState(false);
    const [sourceAmazon, setSourceAmazon] = useState<"LIVE" | "CACHE" | null>(null);
    const [asinManual, setAsinManual] = useState<string>("");
    const [salvarHistorico, setSalvarHistorico] = useState(true);

    // Para não sobrescrever custo manual sem querer
    const custoAquisicaoAutoRef = useRef(true);

    useEffect(() => {
        supabase.from("categorias_comissao").select("id, nome").order("nome").then(({ data }) => {
            if (data) setCategorias(data);
        });

        // Produtos para o select
        supabase
            .from("produtos")
            .select("id, nome, sku, asin, peso_gramas, comprimento_cm, largura_cm, altura_cm")
            .order("nome")
            .then(({ data }) => {
                if (data) setProdutos(data as ProdutoOption[]);
            });
        // Imposto padrão (salvo no Supabase em app_config)
        (async () => {
            const { data, error } = await supabase
                .from("app_config")
                .select("imposto_venda_pct")
                .eq("id", 1)
                .maybeSingle();

            if (error) {
                console.warn("Erro ao carregar app_config:", error);
                return;
            }

            const impostoPadrao = Number(data?.imposto_venda_pct ?? 0);
            if (impostoPadrao > 0) {
                setInputs(prev => ({ ...prev, impostos: impostoPadrao }));
            }
        })();
    }, []);

    // Se o usuário alternar FBA/FBM e o custo foi auto-preenchido, recalcula CMP do depósito correspondente
    useEffect(() => {
        if (!inputs.produtoId) return;
        if (!custoAquisicaoAutoRef.current) return;

        preencherCMPDoEstoque(inputs.produtoId, depositoPadraoPorModo(modo)).catch(console.error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modo]);

    const handleChange = (field: keyof CalculadoraInputs, value: string) => {
        const n = value === "" ? 0 : Number(value);
        if (field === "custoAquisicaoCents") {
            custoAquisicaoAutoRef.current = false;
        }
        setInputs(prev => ({ ...prev, [field]: n }));
    };

    const handleChangeCents = (field: keyof CalculadoraInputs, value: string) => {
        const cents = parseBRLCentsFromInput(value);
        if (field === "custoAquisicaoCents") {
            custoAquisicaoAutoRef.current = false;
        }
        setInputs(prev => ({ ...prev, [field]: cents }));
    };

    const buscarTaxasAmazon = async () => {
        const prod = produtos.find(p => p.id === inputs.produtoId);
        const sku = (prod?.sku || "").trim();
        // Prioriza o ASIN digitado; se estiver vazio, usa o ASIN do cadastro (se houver).
        const asin = ((asinManual || prod?.asin || "") as string).trim().toUpperCase();

        const price = Number((inputs.precoCents / 100).toFixed(2));
        if ((!sku && asin.length !== 10) || !Number.isFinite(price) || price <= 0) {
            alert("Informe um SKU (no cadastro do produto) ou digite um ASIN válido (10 caracteres) e preencha o Preço antes de buscar na Amazon.");
            return;
        }

        setBuscandoAmazon(true);
        try {
            // IMPORTANT: price deve ser número (ponto), nunca string com vírgula.
            const body: any = {
                price,
                fulfillment: modo === "fba" ? "FBA" : "FBM",
            };

            // Compatibilidade: algumas versões da Edge Function esperam "identifier".
            // Enviamos ambos (identifier + sku/asin) para garantir.
            if (asin.length === 10) {
                body.identifier = asin;
                body.idType = "ASIN";
                body.asin = asin;
            } else {
                body.identifier = sku;
                body.idType = "SKU";
                body.sku = sku;
            }

            const res = await supabase.functions.invoke("amazon-fees", { body });

            if (res.error) {
                // Mostra o detalhe real do erro da Edge Function (status + body)
                let detail = "";
                try {
                    // @ts-ignore - context existe em erros de Functions
                    if (res.error.context) detail = await res.error.context.text();
                } catch {
                    /* ignore */
                }
                throw new Error(detail ? `${res.error.message} | ${detail}` : (res.error.message || "Erro desconhecido"));
            }

            const { referralFee, fulfillmentFee, otherFeesTotal, source } = res.data || {};

            setInputs(prev => ({
                ...prev,
                taxaComissaoManualCents: Math.round((referralFee || 0) * 100),
                // Para FBA, o fulfillmentFee normalmente representa pick&pack / fulfillment
                tarifaLogisticaManualCents: modo === "fba" ? Math.round((fulfillmentFee || 0) * 100) : prev.tarifaLogisticaManualCents,
                outrasTaxasAmazonManualCents: Math.round((otherFeesTotal || 0) * 100),
            }));
            setSourceAmazon(source || "LIVE");

        } catch (err: any) {
            console.error("Erro na busca da Amazon:", err);
            alert("Não foi possível buscar as taxas da Amazon. A calculadora continuará no modo Manual.\nDetalhes: " + (err?.message || err));
            if (fonteTaxas === "amazon") {
                setFonteTaxas("manual");
            }
            setSourceAmazon(null);
        } finally {
            setBuscandoAmazon(false);
        }
    };

    const handleCategoriaChange = (value: string) => {
        setInputs(prev => ({ ...prev, categoria: value }));
    };

    const handleProdutoChange = async (produtoId: string) => {
        setInputs(prev => ({ ...prev, produtoId }));
        setAsinManual("");
        custoAquisicaoAutoRef.current = true;

        const prod = produtos.find(p => p.id === produtoId);
        if (prod) {
            setAsinManual(prod.asin ?? "");
            setInputs(prev => ({
                ...prev,
                produtoId,
                // Se não existir no cadastro, fica "0" e o input aparece em branco (porque usamos value || "")
                peso: prod.peso_gramas ?? 0,
                comprimento: prod.comprimento_cm ?? 0,
                largura: prod.largura_cm ?? 0,
                altura: prod.altura_cm ?? 0,
            }));
        }

        await preencherCMPDoEstoque(produtoId, depositoPadraoPorModo(modo));
    };

    async function preencherCMPDoEstoque(produtoId: string, deposito: Deposito) {
        const { data, error } = await supabase
            .from("estoque_movimentacoes")
            .select("id, produto_id, tipo, deposito_origem, deposito_destino, quantidade, preco_unitario, data_movimentacao, created_at")
            .eq("produto_id", produtoId)
            .order("data_movimentacao", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) throw error;

        const moves = (data || []) as Array<{
            id: string;
            produto_id: string;
            tipo: TipoMov;
            deposito_origem: Deposito | null;
            deposito_destino: Deposito | null;
            quantidade: number;
            preco_unitario: number;
            data_movimentacao: string;
            created_at: string;
        }>;

        const normalized: MovementNormalized[] = moves.map(m => ({
            id: m.id,
            produtoId: m.produto_id,
            tipo: m.tipo,
            origem: m.deposito_origem,
            destino: m.deposito_destino,
            quantidade: m.quantidade,
            custoInformadoUnit: m.tipo === "entrada" ? money(m.preco_unitario) : undefined,
            precoUnitarioRelatorio: money(m.preco_unitario),
            dataMov: m.data_movimentacao,
            createdAt: m.created_at,
            occurredAt: new Date(m.data_movimentacao),
            sortKey: `${m.data_movimentacao}|${m.created_at}|${m.id}`,
        }));

        const cmp = computeCMP(normalized);
        const pState = cmp.stock.get(produtoId);

        const unit = pState?.positions[deposito]?.custoMedio ?? 0n;
        const unitBRL = fromMoney(unit);

        // Se não tem estoque, CMP vira 0 => input fica em branco e você preenche manualmente.
        setInputs(prev => ({ ...prev, custoAquisicaoCents: Math.round((unitBRL || 0) * 100) }));
    }

    const executarCalculos = async () => {
        setCalculando(true);
        try {
            let resObj: ResultadoCalculo;

            if (modo === "fba") {
                if (usarCalculoAutomatico) resObj = await calcularFBAAutomatico();
                else resObj = calcularFBAManual();
            } else {
                if (usarCalculoAutomatico) resObj = await calcularFBMAutomatico();
                else resObj = calcularFBMManual();
            }

            setResultado(resObj);
        } catch (err) {
            console.error("Erro no cálculo Oculto:", err);
        } finally {
            setCalculando(false);
        }
    };

    const salvarCalculoNoHistorico = async () => {
        if (!salvarHistorico || !inputs.produtoId || inputs.precoCents <= 0) return;

        try {
            const aliquota = (inputs.impostos || 0) / 100;
            const custoFixo = Math.max(0, resultado.custoPorUnidade - resultado.impostos);
            const calcBep = aliquota < 1 && custoFixo > 0 ? custoFixo / (1 - aliquota) : 0;
            const precoReal = inputs.precoCents / 100;
            const calcRoas = resultado.lucroLiquido > 0 ? precoReal / resultado.lucroLiquido : 0;

            let tipoFonte = fonteTaxas.toUpperCase();
            if (fonteTaxas === "amazon") {
                tipoFonte = sourceAmazon === "CACHE" ? "AMAZON_CACHE" : "AMAZON_LIVE";
            }

            const { error } = await supabase.from("produto_calculos").insert({
                produto_id: inputs.produtoId,
                preco_venda: precoReal,
                imposto_pct: inputs.impostos,
                margem_pct: resultado.margem,
                bep_preco: calcBep,
                roas_ideal: calcRoas,
                lucro_liquido: resultado.lucroLiquido,
                roi_pct: resultado.roi,
                fonte_taxas: tipoFonte
            });

            if (error) {
                console.error("Erro ao salvar histórico:", error);
                toast.error("Houve um erro ao registrar o cálculo.");
            } else {
                toast.success("Cálculo salvo no histórico!");
            }
        } catch (err) {
            console.error("Erro ao salvar:", err);
            toast.error("Ocorreu um erro ao salvar o cálculo.");
        }
    };

    // Recálculo Automático Debounced
    useEffect(() => {
        const handler = setTimeout(() => {
            if (inputs.precoCents > 0) {
                executarCalculos();
            } else {
                setResultado(resultadoInicial);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [
        inputs.produtoId, inputs.precoCents, inputs.custoAquisicaoCents, inputs.custoPrepCenterCents,
        inputs.taxaComissaoManualCents, inputs.tarifaLogisticaManualCents, inputs.tarifaArmazenamentoManualCents,
        inputs.envioAmazonManualCents, inputs.outrasTaxasAmazonManualCents, inputs.impostos, inputs.categoria,
        inputs.peso, inputs.comprimento, inputs.largura, inputs.altura, modo, usarCalculoAutomatico
    ]);

    // Dummy calcular that was clicked
    const calcular = async () => {
        await salvarCalculoNoHistorico();
    };

    // ── FBA AUTOMÁTICO (tabelas) ───────────────────────────────
    const calcularFBAAutomatico = async (): Promise<ResultadoCalculo> => {
        const p_preco = inputs.precoCents / 100;
        const p_custoAquisicao = inputs.custoAquisicaoCents / 100;
        const p_custoPrepCenter = inputs.custoPrepCenterCents / 100;
        const { data: configsTarifa } = await supabase.from("fba_configs_tarifa").select("*").single();

        // Peso dimensional
        const pesoDimensional = configsTarifa
            ? (inputs.comprimento * inputs.largura * inputs.altura) / configsTarifa.divisor_peso_dimensional * 1000
            : 0;
        const pesoBase = Math.max(inputs.peso, pesoDimensional);
        const pesoFinal = pesoBase + (configsTarifa?.peso_embalagem_padrao_gramas || 0);

        // Nível de preço
        const { data: nivelPreco } = await supabase
            .from("fba_niveis_preco_tarifa")
            .select("*")
            .lte("preco_min_brl", p_preco)
            .gte("preco_max_brl", p_preco)
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

        // Comissão (categoria)
        const { data: regraComissao } = await supabase
            .from("regras_comissao_venda")
            .select("*")
            .eq("id_categoria", inputs.categoria)
            .single();

        let comissaoBruta = 0;
        if (regraComissao) {
            if (regraComissao.tipo_regra === "PADRAO") {
                comissaoBruta = p_preco * regraComissao.percentual_padrao;
            } else {
                if (p_preco <= regraComissao.limite_preco_nivel1_brl) {
                    comissaoBruta = p_preco * regraComissao.percentual_ate_limite_nivel1;
                } else {
                    comissaoBruta =
                        (regraComissao.limite_preco_nivel1_brl * regraComissao.percentual_sobre_limite_nivel1) +
                        ((p_preco - regraComissao.limite_preco_nivel1_brl) * regraComissao.percentual_acima_limite_nivel1);
                }
            }
        }
        const tarifaVenda = regraComissao ? Math.max(comissaoBruta, regraComissao.comissao_minima_brl) : comissaoBruta;

        // Calcular
        const valorImpostos = (inputs.impostos / 100) * p_preco;
        const custoPorUnidade =
            tarifaArmazenamento +
            tarifaLogistica +
            tarifaVenda +
            valorImpostos +
            p_custoAquisicao +
            p_custoPrepCenter;

        const lucroLiquido = p_preco - custoPorUnidade;
        const margem = p_preco > 0 ? (lucroLiquido / p_preco) * 100 : 0;
        const roi = p_custoAquisicao > 0 ? (lucroLiquido / p_custoAquisicao) * 100 : 0;

        return {
            tarifaArmazenamento,
            tarifaLogistica,
            tarifaVenda,
            impostos: valorImpostos,
            custoPorUnidade,
            lucroLiquido,
            margem,
            roi,
        };
    };

    // ── FBA MANUAL ────────────────────────────────────────────
    const calcularFBAManual = (): ResultadoCalculo => {
        const p_preco = inputs.precoCents / 100;
        const p_custoAquisicao = inputs.custoAquisicaoCents / 100;
        const p_custoPrepCenter = inputs.custoPrepCenterCents / 100;
        const tarifaVenda = (inputs.taxaComissaoManualCents / 100);
        const tarifaLogistica = (inputs.tarifaLogisticaManualCents / 100);
        const tarifaArmazenamento = (inputs.tarifaArmazenamentoManualCents / 100) + (inputs.envioAmazonManualCents / 100);

        const valorImpostos = (inputs.impostos / 100) * p_preco;
        const custoPorUnidade =
            tarifaVenda +
            tarifaLogistica +
            tarifaArmazenamento +
            (inputs.outrasTaxasAmazonManualCents / 100) +
            valorImpostos +
            p_custoAquisicao +
            p_custoPrepCenter;

        const lucroLiquido = p_preco - custoPorUnidade;
        const margem = p_preco > 0 ? (lucroLiquido / p_preco) * 100 : 0;
        const roi = p_custoAquisicao > 0 ? (lucroLiquido / p_custoAquisicao) * 100 : 0;

        return {
            tarifaArmazenamento,
            tarifaLogistica,
            tarifaVenda,
            impostos: valorImpostos,
            custoPorUnidade,
            lucroLiquido,
            margem,
            roi,
        };
    };

    // ── FBM AUTOMÁTICO (somente comissão por categoria) ───────
    const calcularFBMAutomatico = async (): Promise<ResultadoCalculo> => {
        const p_preco = inputs.precoCents / 100;
        const p_custoAquisicao = inputs.custoAquisicaoCents / 100;
        const p_custoPrepCenter = inputs.custoPrepCenterCents / 100;
        const { data: regraComissao } = await supabase
            .from("regras_comissao_venda")
            .select("*")
            .eq("id_categoria", inputs.categoria)
            .single();

        let comissaoBruta = 0;
        if (regraComissao) {
            if (regraComissao.tipo_regra === "PADRAO") {
                comissaoBruta = p_preco * regraComissao.percentual_padrao;
            } else {
                if (p_preco <= regraComissao.limite_preco_nivel1_brl) {
                    comissaoBruta = p_preco * regraComissao.percentual_ate_limite_nivel1;
                } else {
                    comissaoBruta =
                        (regraComissao.limite_preco_nivel1_brl * regraComissao.percentual_sobre_limite_nivel1) +
                        ((p_preco - regraComissao.limite_preco_nivel1_brl) * regraComissao.percentual_acima_limite_nivel1);
                }
            }
        }
        const tarifaVenda = regraComissao ? Math.max(comissaoBruta, regraComissao.comissao_minima_brl) : comissaoBruta;

        const valorImpostos = (inputs.impostos / 100) * p_preco;
        const custoPorUnidade =
            tarifaVenda +
            (inputs.tarifaLogisticaManualCents / 100) +
            valorImpostos +
            p_custoAquisicao +
            p_custoPrepCenter;

        const lucroLiquido = p_preco - custoPorUnidade;
        const margem = p_preco > 0 ? (lucroLiquido / p_preco) * 100 : 0;
        const roi = p_custoAquisicao > 0 ? (lucroLiquido / p_custoAquisicao) * 100 : 0;

        return {
            tarifaArmazenamento: 0,
            tarifaLogistica: (inputs.tarifaLogisticaManualCents / 100),
            tarifaVenda,
            impostos: valorImpostos,
            custoPorUnidade,
            lucroLiquido,
            margem,
            roi,
        };
    };

    // ── FBM MANUAL ────────────────────────────────────────────
    const calcularFBMManual = (): ResultadoCalculo => {
        const p_preco = inputs.precoCents / 100;
        const p_custoAquisicao = inputs.custoAquisicaoCents / 100;
        const p_custoPrepCenter = inputs.custoPrepCenterCents / 100;
        const tarifaVenda = (inputs.taxaComissaoManualCents / 100);

        const valorImpostos = (inputs.impostos / 100) * p_preco;
        const custoPorUnidade =
            tarifaVenda +
            (inputs.tarifaLogisticaManualCents / 100) +
            (inputs.outrasTaxasAmazonManualCents / 100) +
            valorImpostos +
            p_custoAquisicao +
            p_custoPrepCenter;

        const lucroLiquido = p_preco - custoPorUnidade;
        const margem = p_preco > 0 ? (lucroLiquido / p_preco) * 100 : 0;
        const roi = p_custoAquisicao > 0 ? (lucroLiquido / p_custoAquisicao) * 100 : 0;

        return {
            tarifaArmazenamento: 0,
            tarifaLogistica: (inputs.tarifaLogisticaManualCents / 100),
            tarifaVenda,
            impostos: valorImpostos,
            custoPorUnidade,
            lucroLiquido,
            margem,
            roi,
        };
    };

    const limpar = () => {
        custoAquisicaoAutoRef.current = true;
        setInputs(inputInicial);
        setResultado(resultadoInicial);

        // Reaplica imposto padrão (app_config)
        (async () => {
            const { data, error } = await supabase
                .from("app_config")
                .select("imposto_venda_pct")
                .eq("id", 1)
                .maybeSingle();

            if (error) {
                console.warn("Erro ao carregar app_config:", error);
                return;
            }

            const impostoPadrao = Number(data?.imposto_venda_pct ?? 0);
            if (impostoPadrao > 0) {
                setInputs(prev => ({ ...prev, impostos: impostoPadrao }));
            }
        })();
    };

    // ── Métricas extras ───────────────────────────────────────
    const bepPreco = useMemo(() => {
        const aliquota = (inputs.impostos || 0) / 100;
        if (aliquota >= 1) return null;

        // custo fixo (sem impostos, que variam com preço)
        const custoFixo = Math.max(0, resultado.custoPorUnidade - resultado.impostos);
        if (custoFixo <= 0) return null;

        // Se usar automático, é uma estimativa (porque tarifas podem variar com o preço).
        return custoFixo / (1 - aliquota);
    }, [inputs.impostos, resultado.custoPorUnidade, resultado.impostos]);

    const roasIdeal = useMemo(() => {
        // ROAS mínimo (break-even): Vendas / Ads
        // Ads máximo (break-even) = lucroLiquido
        if (inputs.precoCents <= 0) return null;
        if (resultado.lucroLiquido <= 0) return null;
        return (inputs.precoCents / 100) / resultado.lucroLiquido;
    }, [inputs.precoCents, resultado.lucroLiquido]);

    const acosMax = useMemo(() => {
        if (inputs.precoCents <= 0) return null;
        if (resultado.lucroLiquido <= 0) return null;
        return (resultado.lucroLiquido / (inputs.precoCents / 100)) * 100;
    }, [inputs.precoCents, resultado.lucroLiquido]);

    const depositoCMP = depositoPadraoPorModo(modo);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Calculadora de Lucratividade"
                description="Calcule a lucratividade dos seus produtos na Amazon (FBA e FBM)."
            />

            <div className="flex items-center justify-between flex-wrap gap-3">
                <Tabs value={modo} onValueChange={(v) => { setModo(v as "fba" | "fbm"); setResultado(resultadoInicial); }}>
                    <TabsList>
                        <TabsTrigger value="fba">FBA</TabsTrigger>
                        <TabsTrigger value="fbm">FBM</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Label className="text-sm font-medium mr-1">Fonte das taxas:</Label>
                    <Select value={fonteTaxas} onValueChange={(v: any) => setFonteTaxas(v)}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-transparent">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="tabela">Tabela atual</SelectItem>
                            <SelectItem value="amazon">Amazon SP-API</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Inputs */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4" /> Dados do Produto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Produto</Label>
                            <Select value={inputs.produtoId} onValueChange={handleProdutoChange}>
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
                                CMP puxado do estoque: <span className="font-medium">{depositoCMP}</span> (se não houver estoque, o campo fica em branco).
                            </p>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label>ASIN (opcional)</Label>
                                    <Input
                                        type="text"
                                        value={asinManual}
                                        onChange={(e) => setAsinManual(e.target.value.toUpperCase())}
                                        maxLength={10}
                                        placeholder="B0XXXXXXXX"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Se preenchido (10 caracteres), a busca de taxas usará o ASIN; caso contrário, usa o SKU do cadastro.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">SKU (do cadastro)</Label>
                                    <Input
                                        value={produtos.find(p => p.id === inputs.produtoId)?.sku ?? ""}
                                        disabled
                                        placeholder="—"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Preço de Venda (R$)</Label>
                                <Input type="text" value={inputs.precoCents || inputs.precoCents === 0 ? formatCentsToBRL(inputs.precoCents) : ""} onChange={e => handleChangeCents("precoCents", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo de Aquisição (R$)</Label>
                                <Input type="text" value={inputs.custoAquisicaoCents || inputs.custoAquisicaoCents === 0 ? formatCentsToBRL(inputs.custoAquisicaoCents) : ""} onChange={e => handleChangeCents("custoAquisicaoCents", e.target.value)} placeholder="0,00" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Imposto sobre Venda (%)</Label>
                                <Input type="number" step="0.1" value={inputs.impostos || ""} onChange={e => handleChange("impostos", e.target.value)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label>Custo PrepCenter (R$)</Label>
                                <Input type="text" value={inputs.custoPrepCenterCents || inputs.custoPrepCenterCents === 0 ? formatCentsToBRL(inputs.custoPrepCenterCents) : ""} onChange={e => handleChangeCents("custoPrepCenterCents", e.target.value)} placeholder="0,00" />
                            </div>
                        </div>

                        {usarCalculoAutomatico && (
                            <div className="space-y-2">
                                <Label>Categoria (para comissão)</Label>
                                <Select value={inputs.categoria} onValueChange={handleCategoriaChange}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {categorias.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Peso (gramas)</Label>
                                <Input type="number" value={inputs.peso || ""} onChange={e => handleChange("peso", e.target.value)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label>{modo === "fba" ? "Tarifa Logística (R$)" : "Custo Logística (R$)"}</Label>
                                <Input type="text" value={inputs.tarifaLogisticaManualCents || inputs.tarifaLogisticaManualCents === 0 ? formatCentsToBRL(inputs.tarifaLogisticaManualCents) : ""} onChange={e => handleChangeCents("tarifaLogisticaManualCents", e.target.value)} placeholder="0,00" />
                                <p className="text-[11px] text-muted-foreground">
                                    {usarCalculoAutomatico && modo === "fba"
                                        ? "No automático FBA, este campo é ignorado (usa as tabelas)."
                                        : "Informe manualmente (ex.: envio, frete, fulfillment, etc.)."}
                                </p>
                            </div>
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

                        {!usarCalculoAutomatico && (
                            <div className="space-y-4">
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center">
                                        Tarifas ({fonteTaxas === "amazon" ? "Preenchido pela Amazon" : "Manual"})
                                        {fonteTaxas === "amazon" && sourceAmazon && (
                                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${sourceAmazon === "LIVE" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}>
                                                {sourceAmazon}
                                            </span>
                                        )}
                                    </p>
                                    {fonteTaxas === "amazon" && (
                                        <Button onClick={buscarTaxasAmazon} disabled={buscandoAmazon} size="sm" variant="secondary" className="h-7 text-xs">
                                            {buscandoAmazon ? "Buscando..." : "Buscar na Amazon"}
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Taxa de Comissão (R$)</Label>
                                        <Input type="text" value={inputs.taxaComissaoManualCents || inputs.taxaComissaoManualCents === 0 ? formatCentsToBRL(inputs.taxaComissaoManualCents) : ""} onChange={e => handleChangeCents("taxaComissaoManualCents", e.target.value)} placeholder="0,00" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Outras Taxas (R$)</Label>
                                        <Input type="text" value={inputs.outrasTaxasAmazonManualCents || inputs.outrasTaxasAmazonManualCents === 0 ? formatCentsToBRL(inputs.outrasTaxasAmazonManualCents) : ""} onChange={e => handleChangeCents("outrasTaxasAmazonManualCents", e.target.value)} placeholder="0,00" />
                                    </div>

                                    {modo === "fba" && (
                                        <div className="space-y-2">
                                            <Label>Armazenamento (R$)</Label>
                                            <Input type="text" value={inputs.tarifaArmazenamentoManualCents || inputs.tarifaArmazenamentoManualCents === 0 ? formatCentsToBRL(inputs.tarifaArmazenamentoManualCents) : ""} onChange={e => handleChangeCents("tarifaArmazenamentoManualCents", e.target.value)} placeholder="0,00" />
                                        </div>
                                    )}
                                </div>

                                {modo === "fba" && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Envio da Amazon (R$)</Label>
                                            <Input type="text" value={inputs.envioAmazonManualCents || inputs.envioAmazonManualCents === 0 ? formatCentsToBRL(inputs.envioAmazonManualCents) : ""} onChange={e => handleChangeCents("envioAmazonManualCents", e.target.value)} placeholder="0,00" />
                                            <p className="text-[11px] text-muted-foreground">Opcional (separado da logística, se você preferir).</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-muted-foreground">Categoria</Label>
                                            <Input value={inputs.categoria} disabled placeholder="No modo manual a categoria não é usada." />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-4">
                            <div className="flex items-center space-x-2 px-1">
                                <Checkbox
                                    id="salvarHistorico"
                                    checked={salvarHistorico}
                                    onCheckedChange={(checked) => setSalvarHistorico(checked as boolean)}
                                />
                                <Label htmlFor="salvarHistorico" className="text-sm font-medium leading-none cursor-pointer">
                                    Salvar este resultado no histórico do produto
                                </Label>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={calcular} disabled={calculando || !salvarHistorico} title={salvarHistorico ? '' : 'Ative "Salvar histórico" para gravar'} className="flex-1">
                                    {calculando ? "Calculando..." : "Salvar Cálculo no Histórico"}
                                </Button>
                                <Button variant="outline" onClick={limpar}>Limpar</Button>
                            </div>
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
                            <div className="rounded-lg border p-3 text-center">
                                <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">BEP (Preço)</p>
                                <p className="text-lg font-bold">
                                    {bepPreco ? formatarMoeda(bepPreco) : "—"}
                                </p>
                                {usarCalculoAutomatico && bepPreco && (
                                    <p className="text-[10px] text-muted-foreground mt-1">estimado</p>
                                )}
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">ROAS ideal</p>
                                <p className="text-lg font-bold">
                                    {roasIdeal ? `${roasIdeal.toFixed(2)}x` : "—"}
                                </p>
                                {acosMax && (
                                    <p className="text-[10px] text-muted-foreground mt-1">ACoS máx.: {formatarPorcentagem(acosMax)}</p>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Detalhamento</p>
                            {[
                                { label: "Preço de Venda", value: inputs.precoCents / 100, icon: DollarSign },
                                { label: "Taxa de Comissão", value: -resultado.tarifaVenda, icon: Package },
                                ...(modo === "fba"
                                    ? [
                                        { label: "Tarifa Logística", value: -resultado.tarifaLogistica, icon: Package },
                                        { label: "Armazenamento/Envio", value: -resultado.tarifaArmazenamento, icon: Package },
                                    ]
                                    : [
                                        { label: "Custo Logística", value: -resultado.tarifaLogistica, icon: Package },
                                    ]),
                                { label: "Impostos", value: -resultado.impostos, icon: TrendingDown },
                                { label: "Outras Taxas", value: -inputs.outrasTaxasAmazonManualCents / 100, icon: Package },
                                { label: "Custo Aquisição (CMP)", value: -inputs.custoAquisicaoCents / 100, icon: TrendingDown },
                                { label: "Custo PrepCenter", value: -inputs.custoPrepCenterCents / 100, icon: TrendingDown },
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