import { Moon, Sun, Search, Bell, MessageSquare, Sparkles, Command } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Header() {
    const { theme, setTheme } = useTheme();

    return (
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-xl px-8 transition-all">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Busca rápida..."
                        className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary/50 focus:bg-secondary transition-all rounded-xl"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span className="flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            <Command className="h-3 w-3 mr-1" /> K
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 ml-4">
                <div className="h-6 w-px bg-border/60 mx-1" />

                <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/50 relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-full hover:bg-secondary/50">
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
            </div>
        </header>
    );
}
