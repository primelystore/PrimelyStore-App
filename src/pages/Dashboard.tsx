import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, TrendingUp, Info, ArrowUpRight, BookOpen, Crown } from "lucide-react";
import { formatarMoeda } from "@/lib/utils";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, Cell } from "recharts";

interface KpiData {
    total_produtos: number;
    valor_estoque: number;
}

async function fetchDashboardKpis(): Promise<KpiData> {
    const { data } = await supabase.rpc("get_dashboard_kpis");
    // Fallback if RPC fails or returns empty
    if (!data || data.length === 0) {
        const { count } = await supabase.from("produtos").select("*", { count: "exact", head: true });
        return { total_produtos: count || 0, valor_estoque: 0 };
    }
    return data[0];
}

const mockChartData = [
    { name: 'dom.', value: 20 },
    { name: 'seg.', value: 45 },
    { name: 'ter.', value: 30 },
    { name: 'qua.', value: 25 },
    { name: 'qui.', value: 10 },
    { name: 'sex.', value: 55 },
    { name: 'sáb.', value: 35 },
    { name: 'dom.', value: 48 },
];

export default function Dashboard() {
    const { data: kpis, isLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: fetchDashboardKpis });

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Bem vindo Cleiton Fachiano! 👋</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
                        Todas as Contas
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* ── Gamification Card (Left) ── */}
                <Card className="md:col-span-4 lg:col-span-3 bg-secondary/20 border-border/50 relative overflow-hidden flex flex-col h-full min-h-[400px]">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                    <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-8">
                            <div className="h-8 w-8 rounded-lg bg-background/50 border border-border/50 flex items-center justify-center font-bold text-sm">0</div>
                            <div className="text-[10px] font-medium uppercase tracking-wider bg-background/50 px-2 py-1 rounded border border-border/50 text-muted-foreground">
                                Nível 0 - Initiation
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="relative">
                                <div className="h-24 w-24 rounded-full border-4 border-primary/20 flex items-center justify-center relative z-10 bg-background">
                                    <Crown className="h-10 w-10 text-primary fill-primary/20" />
                                </div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-primary/50 border-l-transparent border-b-transparent rotate-45" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Iniciante</h3>
                                <p className="text-xs text-muted-foreground mt-2 italic px-4">"Todo grande caminho começa com o primeiro passo."</p>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium text-muted-foreground">Em progresso</span>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="bg-background/50 p-3 rounded-lg border border-border/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center font-bold text-sm">1</div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold">Determinado</p>
                                            <p className="text-[10px] text-muted-foreground">Atual R$ {formatarMoeda(kpis?.valor_estoque || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-0.5">
                                        <p className="text-sm font-bold text-primary">16%</p>
                                        <p className="text-[10px] text-muted-foreground">Meta: R$ 100K</p>
                                    </div>
                                </div>
                            </div>

                            <div className="opacity-50">
                                <div className="bg-background/30 p-3 rounded-lg border border-border/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-secondary/50 flex items-center justify-center font-bold text-sm">2</div>
                                        <span className="text-sm font-medium">Estratégico</span>
                                    </div>
                                    <span className="text-xs">3%</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Main Metrics Grid (Right) ── */}
                <div className="md:col-span-8 lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Top Stats */}
                    <Card className="bg-secondary/20 border-border/50 hover:bg-secondary/30 transition-colors group">
                        <CardContent className="p-6 space-y-4">
                            <div className="h-10 w-10 rounded-xl bg-background/50 border border-border/50 flex items-center justify-center">
                                <ShoppingBag className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-medium text-muted-foreground">Total de Vendas</h3>
                                    <Info className="h-4 w-4 text-muted-foreground/50 hover:text-primary transition-colors cursor-help" />
                                </div>
                                <div className="text-3xl font-bold tracking-tight group-hover:text-primary transition-colors">
                                    {isLoading ? <Skeleton className="h-8 w-24" /> : (kpis?.total_produtos || 452)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Total de produtos vendidos</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-secondary/20 border-border/50 hover:bg-secondary/30 transition-colors group">
                        <CardContent className="p-6 space-y-4">
                            <div className="h-10 w-10 rounded-xl bg-background/50 border border-border/50 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-medium text-muted-foreground">Receita Total</h3>
                                    <Info className="h-4 w-4 text-muted-foreground/50 hover:text-primary transition-colors cursor-help" />
                                </div>
                                <div className="text-3xl font-bold tracking-tight group-hover:text-primary transition-colors">
                                    {isLoading ? <Skeleton className="h-8 w-32" /> : formatarMoeda(kpis?.valor_estoque || 16177.54)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Receita total</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Chart Card (Span 1) */}
                    <Card className="bg-secondary/20 border-border/50 hover:bg-secondary/30 transition-colors relative">
                        <CardContent className="p-6 flex flex-col h-full">
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold flex items-baseline gap-2">
                                    0 <span className="text-sm font-normal text-muted-foreground">produtos<br />vendidos</span>
                                </h3>
                                <p className="text-xs font-bold text-primary mt-2 uppercase tracking-wider">Hoje</p>
                            </div>

                            {/* Floating Tooltip Mock */}
                            <div className="absolute top-6 right-6 bg-background/90 backdrop-blur border border-border p-3 rounded-xl shadow-xl z-10 max-w-[200px]">
                                <div className="text-[10px] text-muted-foreground mb-1">1 de fevereiro de 2026</div>
                                <div className="flex justify-between gap-4 text-xs mb-1">
                                    <span className="text-muted-foreground">Faturamento</span>
                                    <span className="font-bold">R$ 48,80</span>
                                </div>
                                <div className="flex justify-between gap-4 text-xs">
                                    <span className="text-muted-foreground">Produtos vendidos</span>
                                    <span className="font-bold">1</span>
                                </div>
                            </div>

                            <div className="flex-1 min-h-[140px] mt-auto">
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-xs font-medium text-muted-foreground">Média</span>
                                    <span className="text-sm font-bold text-white">63,90</span>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={mockChartData}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<></>} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {mockChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === mockChartData.length - 1 ? 'hsl(var(--primary))' : 'hsl(217, 33%, 35%)'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Amazon Accounts */}
                    <Card className="bg-secondary/20 border-border/50 hover:bg-secondary/30 transition-colors group">
                        <CardContent className="p-6 h-full flex flex-col justify-center space-y-4">
                            <div className="h-10 w-10 rounded-xl bg-background/50 border border-border/50 flex items-center justify-center">
                                {/* Amazon Logo SVG Mock */}
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white"><path d="M11.5 11c-.5 0-1.1-.1-1.6-.2-.4-.1-.9-.3-1.3-.5l-.3.5c-.1.2-.2.4-.3.6l-.1.1c.3.2.7.4 1 .6.4.2.8.3 1.2.4.4.1.9.1 1.3.1.5 0 1-.1 1.4-.2.4-.1.8-.3 1.1-.6v-2c-.3.3-.8.6-1.3.8-.4.2-.7.3-1.1.4zm2.1-1.2c-.3.3-.7.5-1.2.6-.4.2-1 .2-1.5.2-.5 0-1-.1-1.5-.2-.4-.2-.8-.4-1.1-.7.2-.6.5-1.2.9-1.6.4-.3.9-.5 1.4-.5.6 0 1.1.2 1.5.5.4.3.5.8.5 1.3zm1.6-4.5c-.3-.1-.6-.2-.9-.3-.3-.1-.7-.1-1-.1-.7 0-1.4.1-1.9.4-.6.2-1.1.6-1.5 1l.6.9c.3-.3.7-.6 1.1-.8.4-.2.9-.3 1.4-.3.5 0 1.1.1 1.6.4v.9c-2.3.1-4 .8-4.8 2.1-.4.6-.6 1.3-.6 2.1 0 .9.3 1.7.9 2.3.6.6 1.4 1 2.3 1 .6 0 1.2-.2 1.7-.5.5-.3.9-.7 1.2-1.1h.1v1h1.7v-5.6c0-1.4-.3-2.5-1-3.2-.6-.8-1.5-1.1-2.6-1.1zM17.4 20c-1.5 1.1-3.6 1.5-5.9 1.1-1.8-.3-3.2-1-4.2-2l.9-1.2c.9.8 2.3 1.5 3.7 1.7 1.8.3 3.3 0 4.5-.8l1 1.2z" /></svg>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="font-medium text-muted-foreground">Contas Ativas</h3>
                                    <Info className="h-4 w-4 text-muted-foreground/50 hover:text-primary transition-colors cursor-help" />
                                </div>
                                <div className="text-3xl font-bold tracking-tight">1</div>
                                <p className="text-xs text-muted-foreground mt-1">Total</p>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
