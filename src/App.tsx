import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Produtos from "@/pages/Produtos";
import ProdutoForm from "@/pages/ProdutoForm";
import Fornecedores from "@/pages/Fornecedores";
import FornecedorForm from "@/pages/FornecedorForm";
import PrepCenters from "@/pages/PrepCenters";
import PrepCenterForm from "@/pages/PrepCenterForm";
import Mineracao from "@/pages/Mineracao";
import Estoque from "@/pages/Estoque";
import Financeiro from "@/pages/Financeiro";
import Calculadora from "@/pages/Calculadora";
import Configuracoes from "@/pages/Configuracoes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="primely-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mineracao" element={<Mineracao />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/produtos/cadastro" element={<ProdutoForm />} />
              <Route path="/produtos/editar/:id" element={<ProdutoForm />} />
              <Route path="/fornecedores" element={<Fornecedores />} />
              <Route path="/fornecedores/cadastro" element={<FornecedorForm />} />
              <Route path="/fornecedores/editar/:id" element={<FornecedorForm />} />
              <Route path="/prep-centers" element={<PrepCenters />} />
              <Route path="/prep-centers/cadastro" element={<PrepCenterForm />} />
              <Route path="/prep-centers/editar/:id" element={<PrepCenterForm />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/calculadora" element={<Calculadora />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
