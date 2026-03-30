import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AdminLayout from "@/layouts/AdminLayout";
import DashboardPage from "@/pages/DashboardPage";
import KitnetsPage from "@/pages/KitnetsPage";
import EnergyPage from "@/pages/EnergyPage";
import ManagerKitnetsPage from "@/pages/ManagerKitnetsPage";
import FinancialBillingPage from "@/pages/FinancialBillingPage";
import CommissionsPage from "@/pages/CommissionsPage";
import RevenuesPage from "@/pages/RevenuesPage";
import ExpensesPage from "@/pages/ExpensesPage";
import BanksPage from "@/pages/BanksPage";
import UsersPage from "@/pages/UsersPage";
import ConstructionsPage from "@/pages/ConstructionsPage";
import PartnerProjectsPage from "@/pages/PartnerProjectsPage";
import WeddingPage from "@/pages/WeddingPage";
import GoalsPage from "@/pages/GoalsPage";
import AssetsPage from "@/pages/AssetsPage";
import ProjectionsPage from "@/pages/ProjectionsPage";
import KitnetsReportPage from "@/pages/KitnetsReportPage";
import TaxesPage from "@/pages/TaxesPage";
import WiselyPage from "@/pages/WiselyPage";
import ReconciliationPage from "@/pages/ReconciliationPage";
import PatternsPage from "@/pages/PatternsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (!session) navigate("/login", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) navigate("/login", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080C' }}>
        <div className="skeleton-shimmer w-16 h-16 rounded-2xl" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Admin routes */}
          <Route element={<AuthGuard><AdminLayout /></AuthGuard>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/wisely" element={<WiselyPage />} />
            <Route path="/revenues" element={<RevenuesPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/banks" element={<BanksPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/patterns" element={<PatternsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/kitnets" element={<KitnetsPage />} />
            <Route path="/energy" element={<EnergyPage />} />
            <Route path="/constructions" element={<ConstructionsPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/investments" element={<Navigate to="/assets?tab=investimentos" replace />} />
            <Route path="/consortiums" element={<Navigate to="/assets?tab=consorcios" replace />} />
            <Route path="/wedding" element={<WeddingPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/taxes" element={<TaxesPage />} />
            <Route path="/projections" element={<ProjectionsPage />} />
            <Route path="/reports/kitnets" element={<KitnetsReportPage />} />
            <Route path="/reports/commissions" element={<CommissionsPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>

          {/* Manager routes */}
          <Route path="/manager/kitnets" element={<ManagerKitnetsPage />} />
          <Route path="/financial/billing" element={<FinancialBillingPage />} />

          {/* Partner routes */}
          <Route path="/partner/projects" element={<PartnerProjectsPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>{title}</h1>
        <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>Módulo em desenvolvimento</p>
      </div>
    </div>
  );
}

export default App;
