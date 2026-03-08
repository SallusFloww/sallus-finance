import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { GlobalRealtimeProvider } from "@/contexts/GlobalRealtimeProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Import = lazy(() => import("./pages/Import"));
const Reports = lazy(() => import("./pages/Reports"));
const Audit = lazy(() => import("./pages/Audit"));
const Settings = lazy(() => import("./pages/Settings"));
const Trends = lazy(() => import("./pages/Trends"));
const TrendsHistory = lazy(() => import("./pages/TrendsHistory"));
const FinancialHealthScore = lazy(() => import("./pages/FinancialHealthScore"));
const DRE = lazy(() => import("./pages/DRE"));
const Receivables = lazy(() => import("./pages/Receivables"));
const ProductionReport = lazy(() => import("./pages/ProductionReport"));
const Production = lazy(() => import("./pages/Production"));
const SuggestedBilling = lazy(() => import("./pages/SuggestedBilling"));
const Billing = lazy(() => import("./pages/Billing"));
const BillingReport = lazy(() => import("./pages/BillingReport"));
const AgingReport = lazy(() => import("./pages/AgingReport"));
const ExecutiveReport = lazy(() => import("./pages/ExecutiveReport"));
const MonthlyReport = lazy(() => import("./pages/MonthlyReport"));
const BI = lazy(() => import("./pages/BI"));
const BIV2 = lazy(() => import("./pages/BIV2"));
const Users = lazy(() => import("./pages/Users"));
const AdminDiagnostics = lazy(() => import("./pages/AdminDiagnostics"));
const AdminCleanup = lazy(() => import("./pages/AdminCleanup"));
const Conciliation = lazy(() => import("./pages/Conciliation"));
const QA = lazy(() => import("./pages/QA"));
const SystemOperations = lazy(() => import("./pages/SystemOperations"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InviteRedirect = lazy(() => import("./pages/InviteRedirect"));

const queryClient = new QueryClient();

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ErrorBoundary>
        <Routes>
          {/* Public Routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/i/:token" element={<InviteRedirect />} />

          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute requiredPermission="VIEW_DASHBOARD"><Dashboard /></ProtectedRoute>} />
          <Route path="/trends" element={<ProtectedRoute requiredPermission="VIEW_TRENDS"><Trends /></ProtectedRoute>} />
          <Route path="/trends-history" element={<ProtectedRoute requiredPermission="VIEW_TRENDS"><TrendsHistory /></ProtectedRoute>} />
          <Route path="/score" element={<ProtectedRoute requiredPermission="VIEW_SCORE"><FinancialHealthScore /></ProtectedRoute>} />
          <Route path="/dre" element={<ProtectedRoute requiredPermission="VIEW_DRE"><DRE /></ProtectedRoute>} />
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
          <Route path="/bi-v2" element={<ProtectedRoute requiredPermission="VIEW_BI"><BIV2 /></ProtectedRoute>} />
          <Route path="/conciliation" element={<ProtectedRoute requiredPermission="VIEW_RECEIVABLES"><Conciliation /></ProtectedRoute>} />

          {/* Redirect */}
          <Route path="/financial" element={<Navigate to="/" replace />} />

          {/* Admin Routes */}
          <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/admin/diagnostics" element={<AdminRoute><AdminDiagnostics /></AdminRoute>} />
          <Route path="/admin/cleanup" element={<AdminRoute><AdminCleanup /></AdminRoute>} />
          <Route path="/qa" element={<AdminRoute><QA /></AdminRoute>} />
          <Route path="/admin/operations" element={<AdminRoute><SystemOperations /></AdminRoute>} />

          {/* Catch all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GlobalRealtimeProvider>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </GlobalRealtimeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
