import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Plus, Save, X, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DoctorRow = {
  id: string;
  company_id: string;
  full_name: string;
  display_name: string | null;
  crm: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function SettingsDoctors() {
  const { profile } = useAuth();
  const companyId = (profile as any)?.company_id;

  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [search, setSearch] = useState("");

  // Novo cadastro
  const [newFullName, setNewFullName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCRM, setNewCRM] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");

  // Edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCRM, setEditCRM] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return doctors;
    return doctors.filter((d) => {
      const a = (d.full_name || "").toLowerCase();
      const b = (d.display_name || "").toLowerCase();
      const c = (d.crm || "").toLowerCase();
      const e = (d.specialty || "").toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s) || e.includes(s);
    });
  }, [doctors, search]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("doctors").select("*").order("full_name", { ascending: true });

      if (error) throw error;
      setDoctors((data as DoctorRow[]) || []);
    } catch (err: any) {
      toast.error("Erro ao carregar médicos(as).");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (d: DoctorRow) => {
    setEditingId(d.id);
    setEditFullName(d.full_name || "");
    setEditDisplayName(d.display_name || "");
    setEditCRM(d.crm || "");
    setEditSpecialty(d.specialty || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFullName("");
    setEditDisplayName("");
    setEditCRM("");
    setEditSpecialty("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editFullName.trim()) {
      toast.error("Nome completo é obrigatório.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("doctors")
        .update({
          full_name: editFullName.trim(),
          display_name: editDisplayName.trim() || null,
          crm: editCRM.trim() || null,
          specialty: editSpecialty.trim() || null,
        })
        .eq("id", editingId);

      if (error) throw error;

      toast.success("Médico(a) atualizado.");
      cancelEdit();
      fetchDoctors();
    } catch (err: any) {
      toast.error("Erro ao salvar edição.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addDoctor = async () => {
    if (!companyId) {
      toast.error("Company ID não encontrado no perfil.");
      return;
    }

    if (!newFullName.trim()) {
      toast.error("Nome completo é obrigatório.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from("doctors").insert({
        company_id: companyId,
        full_name: newFullName.trim(),
        display_name: newDisplayName.trim() || null,
        crm: newCRM.trim() || null,
        specialty: newSpecialty.trim() || null,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Médico(a) cadastrado.");
      setNewFullName("");
      setNewDisplayName("");
      setNewCRM("");
      setNewSpecialty("");
      fetchDoctors();
    } catch (err: any) {
      toast.error("Erro ao cadastrar médico(a).");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    try {
      const { error } = await supabase.from("doctors").update({ is_active: next }).eq("id", id);

      if (error) throw error;
      setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: next } : d)));
    } catch (err: any) {
      toast.error("Erro ao alterar status.");
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Médicos(as)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cadastro opcional para vincular Produções por profissional (e futuramente filtrar no BI).
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Busca */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CRM, especialidade..."
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

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Nome completo *</Label>
                <Input
                  placeholder="Ex.: Dra. Isabela Souza"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Nome curto (opcional)</Label>
                <Input
                  placeholder="Ex.: Dra. Isabela"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>CRM (opcional)</Label>
                <Input placeholder="Ex.: CRM-GO 12345" value={newCRM} onChange={(e) => setNewCRM(e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Especialidade (opcional)</Label>
                <Input
                  placeholder="Ex.: Oncologia"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={addDoctor} disabled={loading} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {filtered.map((d) => {
              const isEditing = editingId === d.id;

              return (
                <div
                  key={d.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                        <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
                        <Input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          placeholder="Nome curto"
                        />
                        <Input value={editCRM} onChange={(e) => setEditCRM(e.target.value)} placeholder="CRM" />
                        <Input
                          value={editSpecialty}
                          onChange={(e) => setEditSpecialty(e.target.value)}
                          placeholder="Especialidade"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-foreground">
                          {d.display_name?.trim() ? d.display_name : d.full_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.crm ? `CRM: ${d.crm}` : "CRM: —"} •{" "}
                          {d.specialty ? `Especialidade: ${d.specialty}` : "Especialidade: —"}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {!isEditing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{d.is_active ? "Ativo" : "Inativo"}</span>
                          <Switch checked={d.is_active} onCheckedChange={(v) => toggleActive(d.id, v)} />
                        </div>

                        <Button variant="outline" size="sm" onClick={() => startEdit(d)} className="gap-2">
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={saveEdit} className="gap-2">
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
            })}

            {!loading && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum médico(a) encontrado.
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Total: {doctors.length} ({doctors.filter((d) => d.is_active).length} ativos)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
