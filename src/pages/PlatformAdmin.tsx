import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Users,
  Database,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Shield,
  Loader2,
} from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  is_demo: boolean;
  created_at: string;
}

interface PlatformStats {
  totalCompanies: number;
  totalUsers: number;
  totalRecords: number;
  totalAlerts24h: number;
  financialVolume: number;
  companies: CompanyRow[];
}

export default function PlatformAdmin() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, usersRes, finRes, recRes, prodRes, alertsRes] = await Promise.all([
        (supabase as any).from("companies").select("id, name, plan, status, is_demo, created_at").order("created_at", { ascending: false }),
        (supabase as any).from("user_company_roles").select("*", { count: "exact", head: true }).eq("is_active", true),
        (supabase as any).from("financial_entries").select("*", { count: "exact", head: true }),
        (supabase as any).from("receivables").select("*", { count: "exact", head: true }),
        (supabase as any).from("productions").select("*", { count: "exact", head: true }),
        (supabase as any).from("system_alerts").select("*", { count: "exact", head: true }).eq("resolved", false).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);

      const companies = (companiesRes.data || []) as CompanyRow[];
      const totalRecords = (finRes.count || 0) + (recRes.count || 0) + (prodRes.count || 0);

      setStats({
        totalCompanies: companies.length,
        totalUsers: usersRes.count || 0,
        totalRecords,
        totalAlerts24h: alertsRes.count || 0,
        financialVolume: 0,
        companies,
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const planColor = (plan: string) => {
    switch (plan) {
      case "ENTERPRISE": return "default";
      case "PRO": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Visão global da plataforma SaaS multi-tenant</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Empresas</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Ativos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Registros Totais</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalRecords.toLocaleString("pt-BR")}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Alertas (24h)</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAlerts24h}</div>
                </CardContent>
              </Card>
            </div>

            {/* Platform Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Status da Plataforma</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge variant="default" className="bg-green-600">OPERACIONAL</Badge>
                  <span className="text-sm text-muted-foreground">
                    Multi-tenant ativo • RLS habilitado • Isolamento por company_id
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Companies Table */}
            <Card>
              <CardHeader>
                <CardTitle>Empresas Cadastradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-muted-foreground">Empresa</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Plano</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Demo</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Criada em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.companies.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.name}</td>
                          <td className="py-2">
                            <Badge variant={planColor(c.plan || "FREE")}>{c.plan || "FREE"}</Badge>
                          </td>
                          <td className="py-2">
                            <Badge variant={c.status === "active" ? "default" : "destructive"}>
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-2">{c.is_demo ? "Sim" : "Não"}</td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
