import { Sidebar } from "./Sidebar";
import Header from "./Header";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
    return (
        <div className="flex min-h-screen bg-background relative overflow-hidden font-sans antialiased selection:bg-primary/20 selection:text-primary">
            {/* Background Effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] opacity-40 mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/5 blur-[120px] opacity-40 mix-blend-screen" />
            </div>

            <Sidebar />
            <div className="flex-1 md:ml-64 relative z-10 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
