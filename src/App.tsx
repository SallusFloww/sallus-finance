import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppProvider } from "./contexts/AppContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import Auth from "./pages/Auth";

import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Import from "./pages/Import";
import Reports from "./pages/Reports";
import Audit from "./pages/Audit";
import Settings from "./pages/Settings";
import Trends from "./pages/Trends";
import TrendsHistory from "./pages/TrendsHistory";
import FinancialHealthScore from "./pages/FinancialHealthScore";
import DRE from "./pages/DRE";
import Receivables from "./pages/Receivables";
import ProductionReport from "./pages/ProductionReport";
import Production from "./pages/Production";
import SuggestedBilling from "./pages/SuggestedBilling";
import Billing from "./pages/Billing";
import BillingReport from "./pages/BillingReport";
import AgingReport from "./pages/AgingReport";
import ExecutiveReport from "./pages/ExecutiveReport";

import MonthlyReport from "./pages/MonthlyReport";
import BI from "./pages/BI";
import Users from "./pages/Users";
import AdminDiagnostics from "./pages/AdminDiagnostics";
import Financial from "./pages/Financial";
import Conciliation from "./pages/Conciliation";
import QA from "./pages/QA";
import NotFound from "./pages/NotFound";
import InviteRedirect from "./pages/InviteRedirect";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/i/:token" element={<InviteRedirect />} />
      
      {/* Protected Routes (requires authentication) */}
      
      <Route path="/" element={<ProtectedRoute requiredPermission="VIEW_DASHBOARD"><Dashboard /></ProtectedRoute>} />
      <Route path="/trends" element={<ProtectedRoute requiredPermission="VIEW_TRENDS"><Trends /></ProtectedRoute>} />
      <Route path="/trends-history" element={<ProtectedRoute requiredPermission="VIEW_TRENDS"><TrendsHistory /></ProtectedRoute>} />
      <Route path="/score" element={<ProtectedRoute requiredPermission="VIEW_SCORE"><FinancialHealthScore /></ProtectedRoute>} />
      <Route path="/dre" element={<ProtectedRoute requiredPermission="VIEW_DRE"><DRE /></ProtectedRoute>} />
      
      {/* Protected Routes with specific permissions */}
      <Route path="/transactions" element={<ProtectedRoute requiredPermission="VIEW_TRANSACTIONS"><Transactions /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute requiredPermission="CREATE_TRANSACTIONS"><Import /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute requiredPermission="VIEW_REPORTS"><Reports /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute requiredPermission="VIEW_AUDIT"><Audit /></ProtectedRoute>} />
      <Route path="/receivables" element={<ProtectedRoute requiredPermission="VIEW_RECEIVABLES"><Receivables /></ProtectedRoute>} />
      <Route path="/production" element={<ProtectedRoute requiredPermission="VIEW_PRODUCTION"><Production /></ProtectedRoute>} />
      <Route path="/production-report" element={<ProtectedRoute requiredPermission="VIEW_REPORTS"><ProductionReport /></ProtectedRoute>} />
      <Route path="/suggested-billing" element={<ProtectedRoute requiredPermission="VIEW_BILLING"><SuggestedBilling /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute requiredPermission="VIEW_BILLING"><Billing /></ProtectedRoute>} />
      <Route path="/billing-report" element={<ProtectedRoute requiredPermission="VIEW_REPORTS"><BillingReport /></ProtectedRoute>} />
      <Route path="/aging-report" element={<ProtectedRoute requiredPermission="VIEW_RECEIVABLES"><AgingReport /></ProtectedRoute>} />
      <Route path="/executive-report" element={<ProtectedRoute requiredPermission="VIEW_REPORTS"><ExecutiveReport /></ProtectedRoute>} />
      <Route path="/monthly-report" element={<ProtectedRoute requiredPermission="VIEW_REPORTS"><MonthlyReport /></ProtectedRoute>} />
      <Route path="/bi" element={<ProtectedRoute requiredPermission="VIEW_BI"><BI /></ProtectedRoute>} />
      <Route path="/conciliation" element={<ProtectedRoute requiredPermission="VIEW_RECEIVABLES"><Conciliation /></ProtectedRoute>} />
      {/* Redirect: /financial removed from menu, redirect to Caixa */}
      <Route path="/financial" element={<Navigate to="/" replace />} />
      
      {/* Admin Routes (requires Admin role) */}
      <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
      <Route path="/admin/diagnostics" element={<AdminRoute><AdminDiagnostics /></AdminRoute>} />
      <Route path="/qa" element={<AdminRoute><QA /></AdminRoute>} />
      
      {/* Catch all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
