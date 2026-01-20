import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit2, Check, X, User } from "lucide-react";
import { useDoctors, useCreateDoctor } from "@/hooks/useDoctors";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SettingsDoctorsProps {
  companyId?: string;
}

export function SettingsDoctors({ companyId }: SettingsDoctorsProps) {
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: doctors = [], isLoading } = useDoctors(companyId);
  const createDoctor = useCreateDoctor(companyId);
  const queryClient = useQueryClient();

  const filteredDoctors = doctors.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const exists = doctors.some(
      (d) => d.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Médico já cadastrado");
      return;
    }

    try {
      await createDoctor.mutateAsync(trimmed);
      setNewName("");
      toast.success("Médico adicionado");
    } catch (err) {
      toast.error("Erro ao adicionar médico");
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("doctors")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(currentActive ? "Médico desativado" : "Médico ativado");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;

    try {
      const { error } = await supabase
        .from("doctors")
        .update({ name: trimmed })
        .eq("id", editingId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setEditingId(null);
      setEditingName("");
      toast.success("Nome atualizado");
    } catch {
      toast.error("Erro ao atualizar nome");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Médicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Médicos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar médico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo médico"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredDoctors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum médico encontrado
            </p>
          ) : (
            filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                {editingId === doctor.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={!doctor.active ? "text-muted-foreground" : ""}>
                        {doctor.name}
                      </span>
                      {!doctor.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleStartEdit(doctor.id, doctor.name)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`toggle-${doctor.id}`} className="text-xs text-muted-foreground">
                          Ativo
                        </Label>
                        <Switch
                          id={`toggle-${doctor.id}`}
                          checked={doctor.active}
                          onCheckedChange={() => handleToggle(doctor.id, doctor.active)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Total: {doctors.length} médico(s) • {doctors.filter((d) => d.active).length} ativo(s)
        </p>
      </CardContent>
    </Card>
  );
}
