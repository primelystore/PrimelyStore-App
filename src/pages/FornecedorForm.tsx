import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface FornecedorFormData {
    nome: string;
    cidade: string;
    estado: string;
    contato_pessoa: string;
    contato_email: string;
}

const formInicial: FornecedorFormData = { nome: "", cidade: "", estado: "", contato_pessoa: "", contato_email: "" };

export default function FornecedorForm() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams();
    const isEditing = !!id;
    const [form, setForm] = useState<FornecedorFormData>(formInicial);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (isEditing) {
            supabase.from("fornecedores").select("*").eq("id", id).single().then(({ data }) => {
                if (data) {
                    setForm({
                        nome: data.nome || "",
                        cidade: data.cidade || "",
                        estado: data.estado || "",
                        contato_pessoa: data.contato_pessoa || "",
                        contato_email: data.contato_email || "",
                    });
                }
            });
        }
    }, [id, isEditing]);

    const handleChange = (field: keyof FornecedorFormData, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) {
            toast.error("Nome do fornecedor é obrigatório.");
            return;
        }
        setSalvando(true);
        try {
            if (isEditing) {
                const { error } = await supabase.from("fornecedores").update(form).eq("id", id);
                if (error) throw error;
                toast.success("Fornecedor atualizado com sucesso!");
            } else {
                const { error } = await supabase.from("fornecedores").insert(form);
                if (error) throw error;
                toast.success("Fornecedor cadastrado com sucesso!");
            }
            queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
            navigate("/fornecedores");
        } catch {
            toast.error("Erro ao salvar fornecedor.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="space-y-6">
            <SectionHeader
                title={isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}
                description={isEditing ? "Atualize as informações do fornecedor." : "Preencha os dados para cadastrar um novo fornecedor."}
                action={
                    <Button variant="outline" size="sm" onClick={() => navigate("/fornecedores")}>
                        <ArrowLeft size={16} className="mr-2" /> Voltar
                    </Button>
                }
            />

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome do Fornecedor *</Label>
                                <Input id="nome" value={form.nome} onChange={e => handleChange("nome", e.target.value)} placeholder="Ex: Distribuidora ABC" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contato_pessoa">Pessoa de Contato</Label>
                                <Input id="contato_pessoa" value={form.contato_pessoa} onChange={e => handleChange("contato_pessoa", e.target.value)} placeholder="Ex: João Silva" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="cidade">Cidade</Label>
                                <Input id="cidade" value={form.cidade} onChange={e => handleChange("cidade", e.target.value)} placeholder="Ex: São Paulo" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="estado">Estado</Label>
                                <Input id="estado" value={form.estado} onChange={e => handleChange("estado", e.target.value)} placeholder="Ex: SP" maxLength={2} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contato_email">E-mail</Label>
                                <Input id="contato_email" type="email" value={form.contato_email} onChange={e => handleChange("contato_email", e.target.value)} placeholder="Ex: contato@fornecedor.com" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={salvando} className="min-w-[120px]">
                                {salvando ? "Salvando..." : "Salvar"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => navigate("/fornecedores")}>Cancelar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
