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

interface PrepCenterFormData {
    nome: string;
    cidade: string;
    estado: string;
    contato_pessoa: string;
    contato_email: string;
}

const formInicial: PrepCenterFormData = { nome: "", cidade: "", estado: "", contato_pessoa: "", contato_email: "" };

export default function PrepCenterForm() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { id } = useParams();
    const isEditing = !!id;
    const [form, setForm] = useState<PrepCenterFormData>(formInicial);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (isEditing) {
            supabase.from("prep_centers").select("*").eq("id", id).single().then(({ data }) => {
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

    const handleChange = (field: keyof PrepCenterFormData, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) {
            toast.error("Nome do Prep Center é obrigatório.");
            return;
        }
        setSalvando(true);
        try {
            if (isEditing) {
                const { error } = await supabase.from("prep_centers").update(form).eq("id", id);
                if (error) throw error;
                toast.success("Prep Center atualizado com sucesso!");
            } else {
                const { error } = await supabase.from("prep_centers").insert(form);
                if (error) throw error;
                toast.success("Prep Center cadastrado com sucesso!");
            }
            queryClient.invalidateQueries({ queryKey: ["prep-centers"] });
            navigate("/prep-centers");
        } catch {
            toast.error("Erro ao salvar Prep Center.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="space-y-6">
            <SectionHeader
                title={isEditing ? "Editar Prep Center" : "Novo Prep Center"}
                description={isEditing ? "Atualize as informações do Prep Center." : "Preencha os dados para cadastrar um novo Prep Center."}
                action={
                    <Button variant="outline" size="sm" onClick={() => navigate("/prep-centers")}>
                        <ArrowLeft size={16} className="mr-2" /> Voltar
                    </Button>
                }
            />

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome do Prep Center *</Label>
                                <Input id="nome" value={form.nome} onChange={e => handleChange("nome", e.target.value)} placeholder="Ex: Prep Center SP" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contato_pessoa">Pessoa de Contato</Label>
                                <Input id="contato_pessoa" value={form.contato_pessoa} onChange={e => handleChange("contato_pessoa", e.target.value)} placeholder="Ex: Maria Santos" />
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="cidade">Cidade</Label>
                                <Input id="cidade" value={form.cidade} onChange={e => handleChange("cidade", e.target.value)} placeholder="Ex: Barueri" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="estado">Estado</Label>
                                <Input id="estado" value={form.estado} onChange={e => handleChange("estado", e.target.value)} placeholder="Ex: SP" maxLength={2} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contato_email">E-mail</Label>
                                <Input id="contato_email" type="email" value={form.contato_email} onChange={e => handleChange("contato_email", e.target.value)} placeholder="Ex: contato@prepcenter.com" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button type="submit" disabled={salvando} className="min-w-[120px]">
                                {salvando ? "Salvando..." : "Salvar"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => navigate("/prep-centers")}>Cancelar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
