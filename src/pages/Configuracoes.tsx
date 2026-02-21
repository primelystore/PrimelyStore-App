import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Tag, Percent, Settings as SettingsIcon } from "lucide-react";

interface Categoria {
    id: string;
    nome: string;
}

interface TaxaSimples {
    id: string;
    nome: string;
    tipo: "percentual" | "fixo";
    valor: number;
}

function CategoriasTab() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [nome, setNome] = useState("");
    const [editId, setEditId] = useState<string | null>(null);

    const fetchCategorias = async () => {
        const { data } = await supabase.from("categorias_comissao").select("id, nome").order("nome");
        if (data) setCategorias(data);
    };

    useEffect(() => { fetchCategorias(); }, []);

    const salvar = async () => {
        if (!nome.trim()) return;
        if (editId) {
            await supabase.from("categorias_comissao").update({ nome }).eq("id", editId);
        } else {
            await supabase.from("categorias_comissao").insert({ nome });
        }
        toast.success(editId ? "Categoria atualizada!" : "Categoria criada!");
        setDialogOpen(false);
        setNome("");
        setEditId(null);
        fetchCategorias();
    };

    const excluir = async (id: string) => {
        await supabase.from("categorias_comissao").delete().eq("id", id);
        toast.success("Categoria excluída!");
        fetchCategorias();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => { setNome(""); setEditId(null); setDialogOpen(true); }}>
                    <Plus size={16} className="mr-2" /> Nova Categoria
                </Button>
            </div>
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome da Categoria</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categorias.length === 0 ? (
                            <TableRow><TableCell colSpan={2} className="h-24 text-center">Nenhuma categoria cadastrada.</TableCell></TableRow>
                        ) : categorias.map(cat => (
                            <TableRow key={cat.id}>
                                <TableCell className="font-medium">{cat.nome}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setNome(cat.nome); setEditId(cat.id); setDialogOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => excluir(cat.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Nome</Label>
                        <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Eletrônicos" className="mt-2" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={salvar} disabled={!nome.trim()}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TaxasSimplesTab() {
    const [taxas, setTaxas] = useState<TaxaSimples[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({ nome: "", tipo: "percentual" as "percentual" | "fixo", valor: "" });
    const [editId, setEditId] = useState<string | null>(null);

    const fetchTaxas = async () => {
        const { data } = await supabase.from("taxas_simples").select("*").order("nome");
        if (data) setTaxas(data);
    };

    useEffect(() => { fetchTaxas(); }, []);

    const salvar = async () => {
        const payload = { nome: form.nome, tipo: form.tipo, valor: parseFloat(form.valor) };
        if (editId) {
            await supabase.from("taxas_simples").update(payload).eq("id", editId);
        } else {
            await supabase.from("taxas_simples").insert(payload);
        }
        toast.success(editId ? "Taxa atualizada!" : "Taxa criada!");
        setDialogOpen(false);
        setForm({ nome: "", tipo: "percentual", valor: "" });
        setEditId(null);
        fetchTaxas();
    };

    const excluir = async (id: string) => {
        await supabase.from("taxas_simples").delete().eq("id", id);
        toast.success("Taxa excluída!");
        fetchTaxas();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => { setForm({ nome: "", tipo: "percentual", valor: "" }); setEditId(null); setDialogOpen(true); }}>
                    <Plus size={16} className="mr-2" /> Nova Taxa
                </Button>
            </div>
            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {taxas.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">Nenhuma taxa cadastrada.</TableCell></TableRow>
                        ) : taxas.map(t => (
                            <TableRow key={t.id}>
                                <TableCell className="font-medium">{t.nome}</TableCell>
                                <TableCell>{t.tipo === "percentual" ? "Percentual" : "Valor Fixo"}</TableCell>
                                <TableCell className="text-right">{t.tipo === "percentual" ? `${t.valor}%` : `R$ ${t.valor.toFixed(2)}`}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setForm({ nome: t.nome, tipo: t.tipo, valor: String(t.valor) }); setEditId(t.id); setDialogOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => excluir(t.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editId ? "Editar Taxa" : "Nova Taxa"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nome</Label>
                            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Tipo</Label>
                                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as "percentual" | "fixo" }))}>
                                    <option value="percentual">Percentual (%)</option>
                                    <option value="fixo">Valor Fixo (R$)</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Valor</Label>
                                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={salvar} disabled={!form.nome.trim() || !form.valor}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


function ImpostosTab() {
    const [impostoVenda, setImpostoVenda] = useState("");
    const [loading, setLoading] = useState(false);

    const carregar = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("app_config")
            .select("imposto_venda_pct")
            .eq("id", 1)
            .maybeSingle();

        if (error) {
            console.warn("Erro ao carregar app_config:", error);
            toast.error("Não foi possível carregar o imposto padrão (app_config).");
        } else {
            const valor = Number(data?.imposto_venda_pct ?? 0);
            setImpostoVenda(valor > 0 ? String(valor) : "");
        }
        setLoading(false);
    };

    useEffect(() => { carregar(); }, []);

    const salvar = async () => {
        const raw = (impostoVenda || "0").replace(",", ".");
        const pct = Number(raw);
        if (!Number.isFinite(pct) || pct < 0) {
            toast.error("Informe um imposto válido (0 ou maior).");
            return;
        }

        setLoading(true);
        const { error } = await supabase
            .from("app_config")
            .upsert({ id: 1, imposto_venda_pct: pct }, { onConflict: "id" });

        setLoading(false);

        if (error) {
            console.warn("Erro ao salvar app_config:", error);
            toast.error("Não foi possível salvar o imposto padrão.");
            return;
        }

        toast.success("Imposto padrão atualizado!");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Imposto sobre Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2 max-w-sm">
                    <Label>Imposto padrão (%)</Label>
                    <Input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 7,0"
                        value={impostoVenda}
                        onChange={(e) => setImpostoVenda(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                        Esse valor será usado como padrão na Calculadora (você pode alterar por produto quando precisar).
                    </p>
                </div>
                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={salvar} disabled={false}>
                        Salvar Alterações
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function AparenciaTab() {
    const [logoLight, setLogoLight] = useState(localStorage.getItem("primely-logo-light") || localStorage.getItem("primely-logo") || "");
    const [logoDark, setLogoDark] = useState(localStorage.getItem("primely-logo-dark") || localStorage.getItem("primely-logo") || "");
    const [loading, setLoading] = useState(false);

    const salvar = () => {
        setLoading(true);
        if (logoLight) localStorage.setItem("primely-logo-light", logoLight);
        else localStorage.removeItem("primely-logo-light");

        if (logoDark) localStorage.setItem("primely-logo-dark", logoDark);
        else localStorage.removeItem("primely-logo-dark");

        // Clean up legacy key
        localStorage.removeItem("primely-logo");

        window.dispatchEvent(new Event("logo-change"));
        setLoading(false);
        toast.success("Logos atualizadas com sucesso!");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Personalização da Marca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Logo Modo Claro</Label>
                            <Input
                                placeholder="https://..."
                                value={logoLight}
                                onChange={(e) => setLogoLight(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Exibida em fundo claro.</p>
                        </div>
                        {logoLight && (
                            <div className="p-4 border rounded-lg bg-white flex flex-col items-center gap-2">
                                <span className="text-[10px] font-medium text-slate-500">Preview (Fundo Branco)</span>
                                <img src={logoLight} alt="Preview Light" className="h-10 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Logo Modo Escuro</Label>
                            <Input
                                placeholder="https://..."
                                value={logoDark}
                                onChange={(e) => setLogoDark(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">Exibida em fundo escuro.</p>
                        </div>
                        {logoDark && (
                            <div className="p-4 border rounded-lg bg-slate-950 flex flex-col items-center gap-2">
                                <span className="text-[10px] font-medium text-slate-400">Preview (Fundo Escuro)</span>
                                <img src={logoDark} alt="Preview Dark" className="h-10 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button onClick={salvar} disabled={loading}>Salvar Alterações</Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function Configuracoes() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Configurações" description="Gerencie categorias, taxas e parâmetros do sistema." />

            <Tabs defaultValue="categorias" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="categorias" className="flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Categorias
                    </TabsTrigger>
                    <TabsTrigger value="taxas" className="flex items-center gap-2">
                        <Percent className="h-4 w-4" /> Taxas Simples
                    </TabsTrigger>
                    <TabsTrigger value="impostos" className="flex items-center gap-2">
                        <Percent className="h-4 w-4" /> Impostos
                    </TabsTrigger>
                    <TabsTrigger value="aparencia" className="flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" /> Aparência
                    </TabsTrigger>
                    <TabsTrigger value="avancado" className="flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" /> Avançado
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="categorias" className="mt-6">
                    <CategoriasTab />
                </TabsContent>
                <TabsContent value="taxas" className="mt-6">
                    <TaxasSimplesTab />
                </TabsContent>
                <TabsContent value="impostos" className="mt-6">
                    <ImpostosTab />
                </TabsContent>
                <TabsContent value="aparencia" className="mt-6">
                    <AparenciaTab />
                </TabsContent>
                <TabsContent value="avancado" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Taxas Avançadas FBA</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Configurações avançadas de tarifas de logística, armazenamento e comissões por categoria estão gerenciadas
                                diretamente nas tabelas do Supabase (fba_configs_tarifa, fba_niveis_preco_tarifa, fba_faixas_peso_tarifa, regras_tarifas_armazenamento, regras_comissao_venda).
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
