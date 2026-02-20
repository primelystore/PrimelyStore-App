import { useState, useEffect } from "react";
import {
    Home,
    Package,
    ShoppingBag,
    Users,
    Warehouse,
    Calculator,
    Rocket,
    Boxes,
    DollarSign,
    Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

function SidebarLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                    "hover:text-primary hover:bg-primary/5",
                    isActive
                        ? "text-primary bg-primary/10 shadow-[0_0_20px_-5px_var(--color-primary)] ring-1 ring-primary/20"
                        : "text-muted-foreground"
                )
            }
        >
            {({ isActive }) => (
                <>
                    <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive && "fill-current")} />
                    <span className="relative z-10">{label}</span>
                    {isActive && <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-50" />}
                </>
            )}
        </NavLink>
    );
}

export function Sidebar() {
    const { theme } = useTheme();
    const [logoLight, setLogoLight] = useState<string | null>(localStorage.getItem("primely-logo-light") || localStorage.getItem("primely-logo"));
    const [logoDark, setLogoDark] = useState<string | null>(localStorage.getItem("primely-logo-dark") || localStorage.getItem("primely-logo"));

    useEffect(() => {
        const handleLogoChange = () => {
            setLogoLight(localStorage.getItem("primely-logo-light"));
            setLogoDark(localStorage.getItem("primely-logo-dark"));
        };

        window.addEventListener("logo-change", handleLogoChange);
        return () => window.removeEventListener("logo-change", handleLogoChange);
    }, []);

    const currentLogo = theme === "dark" ? (logoDark || logoLight) : (logoLight || logoDark);

    return (
        <div className="fixed inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
            <div className="flex h-20 items-center px-6">
                <div className="flex items-center gap-3">
                    {currentLogo ? (
                        <img src={currentLogo} alt="Logo" className="h-10 w-auto object-contain max-w-[150px]" />
                    ) : (
                        <>
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                                <Rocket className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold text-xl tracking-wide text-foreground">RADAR</h1>
                                <p className="text-[10px] text-muted-foreground tracking-widest uppercase">v0.1.7.0</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto py-6 px-4 space-y-1">
                <nav className="grid gap-1">
                    <SidebarLink to="/dashboard" icon={Home} label="Dashboard" />

                    <div className="pt-2 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Gestão
                    </div>
                    <SidebarLink to="/mineracao" icon={Rocket} label="Mineração" />
                    <SidebarLink to="/produtos" icon={ShoppingBag} label="Produtos" />
                    <SidebarLink to="/estoque" icon={Boxes} label="Estoque" />
                    <SidebarLink to="/financeiro" icon={DollarSign} label="Financeiro" />

                    <div className="pt-4 pb-1 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Recursos
                    </div>
                    <SidebarLink to="/fornecedores" icon={Users} label="Fornecedores" />
                    <SidebarLink to="/prep-centers" icon={Warehouse} label="Prep Centers" />
                    <SidebarLink to="/calculadora" icon={Calculator} label="Calculadora" />
                    <SidebarLink to="/configuracoes" icon={Settings} label="Configurações" />
                </nav>
            </div>

        </div>
    );
}
