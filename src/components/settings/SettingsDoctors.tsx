import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { Pencil, Plus, Save, X, Search, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type DoctorRow = {
  id: string;
  company_id: string;
  name: string;
  specialty_id?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function SettingsDoctors() {
  const { profile } = useAuth();
  const companyId = (profile as any)?.company_id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [search, setSearch] = useState("");

  // Novo cadastro
  const [newName, setNewName] = useState("");

  // Edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchDoctors = async () => {
    try {
      setLoading(true);

      // ⚠️ Aqui respeita seu schema real
      const { data, error } = await supabase
        .from("doctors")
        .select("id, company_id, name, specialty_id, active, created_at, updated_at")
        .order("active", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;

      setDoctors((data as DoctorRow[]) ?? []);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar médicos(as).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const total = doctors.length;
    const ativos = doctors.filter((d) => d.active).length;
    const inativos = total - ativos;
    return { total, ativos, inativos };
  }, [doctors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => (d.name || "").toLowerCase().includes(q));
  }, [doctors, search]);

  const startEdit = (d: DoctorRow) => {
    setEditingId(d.id);
    setEditName(d.name ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const clean = editName.trim();
    if (!clean) {
      toast.error("O nome do médico(a) é obrigatório.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from("doctors").update({ name: clean }).eq("id", editingId);

      if (error) throw error;

      toast.success("Médico(a) atualizado.");
      cancelEdit();
      fetchDoctors();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar edição.");
    } finally {
      setLoading(false);
    }
  };

  const addDoctor = async () => {
    if (!companyId) {
      toast.error("Company ID não encontrado. Confirme login/empresa atual.");
      return;
    }

    const clean = newName.trim();
    if (!clean) {
      toast.error("Digite o nome do médico(a).");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from("doctors").insert({
        company_id: companyId,
        name: clean,
        active: true,
      });

      if (error) throw error;

      toast.success("Médico(a) cadastrado.");
      setNewName("");
      fetchDoctors();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao cadastrar médico(a).");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    try {
      const { error } = await supabase.from("doctors").update({ active: next }).eq("id", id);
      if (error) throw error;

      setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, active: next } : d)));
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao alterar status.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-muted-foreground" />
                Médicos(as)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cadastro dinâmico (opcional) usado no formulário de Produção.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{totals.ativos} ativos</Badge>
              <Badge variant="outline">{totals.inativos} inativos</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Busca */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar médico(a)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xl"
            />
          </div>

          {/* Adicionar */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <h4 className="font-medium">Adicionar novo</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label>Nome do médico(a) *</Label>
                <Input
                  placeholder="Ex.: Dra. Isabela / Dr. Bruno"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addDoctor} disabled={loading} className="gap-2 w-full md:w-auto">
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Dica: não deletamos médicos. Se sair do time, só desative ✅
            </p>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum médico(a) encontrado.
              </div>
            ) : (
              filtered.map((d) => {
                const isEditing = editingId === d.id;

                return (
                  <div
                    key={d.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between",
                      !d.active && "opacity-80",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-foreground truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">Status: {d.active ? "Ativo" : "Inativo"}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {!isEditing ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{d.active ? "Ativo" : "Inativo"}</span>
                            <Switch checked={d.active} onCheckedChange={(v) => toggleActive(d.id, v)} />
                          </div>

                          <Button variant="outline" size="sm" onClick={() => startEdit(d)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" onClick={saveEdit} disabled={loading} className="gap-2">
                            <Save className="h-4 w-4" />
                            Salvar
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-2">
                            <X className="h-4 w-4" />
                            Cancelar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div className="text-xs text-muted-foreground">
              Total: {totals.total} ({totals.ativos} ativos)
            </div>
          </div>

          {!companyId && (
            <div className="text-xs text-muted-foreground">
              ⚠️ Company ID não encontrado no perfil — confirme se você está logado e na empresa correta.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
