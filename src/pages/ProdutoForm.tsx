import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface ProdutoFormData {
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
    largura_cm: string;
    altura_cm: string;
    comprimento_cm: string;
    peso_gramas: string;
}

interface FornecedorVinculo {
    fornecedor_id: string;
    codigo_produto_fornecedor: string;
    preco: string;
}

interface Fornecedor {
    id: string;
    nome: string;
}

const formInicial: ProdutoFormData = {
    nome: "", categoria: "", marca: "", asin: "", sku: "",
    gtin: "", gtin_tributavel: "", ncm: "", codigo_cest: "",
    origem_mercadoria: "", situacao_operacao: "",
    largura_cm: "", altura_cm: "", comprimento_cm: "", peso_gramas: "",
};

const vinculoInicial: FornecedorVinculo = { fornecedor_id: "", codigo_produto_fornecedor: "", preco: "" };

export default function ProdutoForm() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams();
    const isEditing = !!id;
    const [form, setForm] = useState<ProdutoFormData>(formInicial);
    const [fornecedorVinculos, setFornecedorVinculos] = useState<FornecedorVinculo[]>([]);
    const [salvando, setSalvando] = useState(false);

    // Buscar lista de fornecedores disponíveis
    const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
        queryKey: ["fornecedores-lista"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fornecedores").select("id, nome").order("nome");
            if (error) throw error;
            return data || [];
        },
    });

    // Carregar dados do produto em edição
    useEffect(() => {
        if (!isEditing) return;
        (async () => {
            const { data: produto } = await supabase.from("produtos").select("*").eq("id", id).single();
            if (produto) {
                setForm({
                    nome: produto.nome || "",
                    categoria: produto.categoria || "",
                    marca: produto.marca || "",
                    asin: produto.asin || "",
                    sku: produto.sku || "",
                    gtin: produto.gtin || "",
                    gtin_tributavel: produto.gtin_tributavel || "",
                    ncm: produto.ncm || "",
                    codigo_cest: produto.codigo_cest || "",
                    origem_mercadoria: produto.origem_mercadoria || "",
                    situacao_operacao: produto.situacao_operacao || "",
                    largura_cm: produto.largura_cm ? String(produto.largura_cm) : "",
                    altura_cm: produto.altura_cm ? String(produto.altura_cm) : "",
                    comprimento_cm: produto.comprimento_cm ? String(produto.comprimento_cm) : "",
                    peso_gramas: produto.peso_gramas ? String(produto.peso_gramas) : "",
                });
            }
            // Carregar vínculos com fornecedores
            const { data: vinculos } = await supabase
                .from("produto_fornecedores")
                .select("fornecedor_id, codigo_produto_fornecedor, preco")
                .eq("produto_id", id);
            if (vinculos && vinculos.length > 0) {
                setFornecedorVinculos(vinculos.map(v => ({
                    fornecedor_id: v.fornecedor_id,
                    codigo_produto_fornecedor: v.codigo_produto_fornecedor || "",
                    preco: v.preco ? String(v.preco) : "",
                })));
            }
        })();
    }, [id, isEditing]);

    const handleChange = (field: keyof ProdutoFormData, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // Fornecedores
    const addFornecedor = () => setFornecedorVinculos(prev => [...prev, { ...vinculoInicial }]);

    const removeFornecedor = (index: number) => {
        setFornecedorVinculos(prev => prev.filter((_, i) => i !== index));
    };

    const updateFornecedor = (index: number, field: keyof FornecedorVinculo, value: string) => {
        setFornecedorVinculos(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) {
            toast.error("Nome do produto é obrigatório.");
            return;
        }

        // Validar fornecedores duplicados
        const fornecedorIds = fornecedorVinculos
            .map(v => v.fornecedor_id)
            .filter(id => id !== "");
        if (new Set(fornecedorIds).size !== fornecedorIds.length) {
            toast.error("Um fornecedor não pode ser adicionado mais de uma vez.");
            return;
        }

        setSalvando(true);
        const payload = {
            nome: form.nome,
            categoria: form.categoria || null,
            marca: form.marca || null,
            asin: form.asin || null,
            sku: form.sku || null,
            gtin: form.gtin || null,
            gtin_tributavel: form.gtin_tributavel || null,
            ncm: form.ncm || null,
            codigo_cest: form.codigo_cest || null,
            origem_mercadoria: form.origem_mercadoria || null,
            situacao_operacao: form.situacao_operacao || null,
            largura_cm: form.largura_cm ? parseFloat(form.largura_cm) : null,
            altura_cm: form.altura_cm ? parseFloat(form.altura_cm) : null,
            comprimento_cm: form.comprimento_cm ? parseFloat(form.comprimento_cm) : null,
            peso_gramas: form.peso_gramas ? parseFloat(form.peso_gramas) : null,
        };

        try {
            let produtoId = id;

            if (isEditing) {
                const { error } = await supabase.from("produtos").update(payload).eq("id", id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from("produtos").insert(payload).select("id").single();
                if (error) throw error;
                produtoId = data.id;
            }

            // Salvar vínculos com fornecedores
            // Remover todos os vínculos existentes e recriar
            await supabase.from("produto_fornecedores").delete().eq("produto_id", produtoId!);

            const vinculosValidos = fornecedorVinculos.filter(v => v.fornecedor_id);
            if (vinculosValidos.length > 0) {
                const { error: vincError } = await supabase.from("produto_fornecedores").insert(
                    vinculosValidos.map(v => ({
                        produto_id: produtoId,
                        fornecedor_id: v.fornecedor_id,
                        codigo_produto_fornecedor: v.codigo_produto_fornecedor || null,
                        preco: v.preco ? parseFloat(v.preco) : 0,
                    }))
                );
                if (vincError) throw vincError;
            }

            toast.success(isEditing ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["produtos"] });
            navigate("/produtos");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar produto.");
        } finally {
            setSalvando(false);
        }
    };

    // Fornecedores já vinculados (para desabilitar no select)
    const fornecedoresUsados = new Set(fornecedorVinculos.map(v => v.fornecedor_id).filter(Boolean));

    return (
        <div className="space-y-6">
            <SectionHeader
                title={isEditing ? "Editar Produto" : "Novo Produto"}
                description={isEditing ? "Atualize as informações do produto." : "Preencha os dados para cadastrar um novo produto."}
                action={
                    <Button variant="outline" size="sm" onClick={() => navigate("/produtos")}>
                        <ArrowLeft size={16} className="mr-2" /> Voltar
                    </Button>
                }
            />

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Informações Básicas */}
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <h3 className="text-base font-semibold">Informações Básicas</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome do Produto *</Label>
                                <Input id="nome" value={form.nome} onChange={e => handleChange("nome", e.target.value)} placeholder="Ex: Fone de Ouvido Bluetooth" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="asin">ASIN</Label>
                                <Input id="asin" value={form.asin} onChange={e => handleChange("asin", e.target.value)} placeholder="Ex: B0XXXXXXXX" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="categoria">Categoria</Label>
                                <Input id="categoria" value={form.categoria} onChange={e => handleChange("categoria", e.target.value)} placeholder="Ex: Eletrônicos" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="marca">Marca</Label>
                                <Input id="marca" value={form.marca} onChange={e => handleChange("marca", e.target.value)} placeholder="Ex: Samsung" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku">Código SKU</Label>
                                <Input id="sku" value={form.sku} onChange={e => handleChange("sku", e.target.value)} placeholder="Ex: SKU-001" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Medidas e Peso */}
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <h3 className="text-base font-semibold">Medidas e Peso</h3>
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="largura_cm">Largura (cm)</Label>
                                <Input id="largura_cm" type="number" step="0.01" value={form.largura_cm} onChange={e => handleChange("largura_cm", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="altura_cm">Altura (cm)</Label>
                                <Input id="altura_cm" type="number" step="0.01" value={form.altura_cm} onChange={e => handleChange("altura_cm", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="comprimento_cm">Comprimento (cm)</Label>
                                <Input id="comprimento_cm" type="number" step="0.01" value={form.comprimento_cm} onChange={e => handleChange("comprimento_cm", e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="peso_gramas">Peso (g)</Label>
                                <Input id="peso_gramas" type="number" step="0.01" value={form.peso_gramas} onChange={e => handleChange("peso_gramas", e.target.value)} placeholder="0,00" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Códigos Fiscais */}
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <h3 className="text-base font-semibold">Códigos Fiscais</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="gtin">GTIN</Label>
                                <Input id="gtin" value={form.gtin} onChange={e => handleChange("gtin", e.target.value)} placeholder="Ex: 7891234567890" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gtin_tributavel">GTIN/EAN Tributável</Label>
                                <Input id="gtin_tributavel" value={form.gtin_tributavel} onChange={e => handleChange("gtin_tributavel", e.target.value)} placeholder="Ex: 7891234567890" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="ncm">NCM</Label>
                                <Input id="ncm" value={form.ncm} onChange={e => handleChange("ncm", e.target.value)} placeholder="Ex: 8518.30.00" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="codigo_cest">Código CEST</Label>
                                <Input id="codigo_cest" value={form.codigo_cest} onChange={e => handleChange("codigo_cest", e.target.value)} placeholder="Ex: 21.063.00" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="origem_mercadoria">Origem da Mercadoria</Label>
                                <Input id="origem_mercadoria" value={form.origem_mercadoria} onChange={e => handleChange("origem_mercadoria", e.target.value)} placeholder="Ex: 0 - Nacional" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="situacao_operacao">Situação da Operação</Label>
                                <Input id="situacao_operacao" value={form.situacao_operacao} onChange={e => handleChange("situacao_operacao", e.target.value)} placeholder="Ex: 102 - Tributação SN sem permissão de crédito" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Fornecedores e Preços */}
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold">Fornecedores e Preços</h3>
                            <Button type="button" variant="outline" size="sm" onClick={addFornecedor}>
                                <Plus size={16} className="mr-2" /> Adicionar Fornecedor
                            </Button>
                        </div>

                        {fornecedorVinculos.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                Nenhum fornecedor vinculado. Clique em "Adicionar Fornecedor" para vincular.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {fornecedorVinculos.map((vinculo, index) => (
                                    <div key={index}>
                                        {index > 0 && <Separator className="mb-4" />}
                                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] items-end">
                                            <div className="space-y-2">
                                                <Label>Fornecedor {index + 1}</Label>
                                                <Select
                                                    value={vinculo.fornecedor_id}
                                                    onValueChange={v => updateFornecedor(index, "fornecedor_id", v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione um fornecedor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {fornecedores.map(f => (
                                                            <SelectItem
                                                                key={f.id}
                                                                value={f.id}
                                                                disabled={fornecedoresUsados.has(f.id) && vinculo.fornecedor_id !== f.id}
                                                            >
                                                                {f.nome}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Cód. Produto no Fornecedor</Label>
                                                <Input
                                                    value={vinculo.codigo_produto_fornecedor}
                                                    onChange={e => updateFornecedor(index, "codigo_produto_fornecedor", e.target.value)}
                                                    placeholder="Ex: REF-12345"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Preço (R$)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={vinculo.preco}
                                                    onChange={e => updateFornecedor(index, "preco", e.target.value)}
                                                    placeholder="0,00"
                                                    className="w-[130px]"
                                                />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeFornecedor(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Botões de ação */}
                <div className="flex gap-3">
                    <Button type="submit" disabled={salvando} className="min-w-[120px]">
                        {salvando ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate("/produtos")}>Cancelar</Button>
                </div>
            </form>
        </div>
    );
}
