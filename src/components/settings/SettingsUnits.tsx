import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Edit2, ChevronDown, AlertCircle, Info, Building, MapPin } from 'lucide-react';
import { UnitConfig, Subunit } from '@/types';
import { toast } from 'sonner';

interface SettingsUnitsProps {
  units: UnitConfig[];
  onAddUnit: (name: string) => void;
  onUpdateUnit: (id: string, updates: Partial<UnitConfig>) => void;
  onAddSubunit: (unitId: string, name: string) => void;
  getUnitUsageCount: (unitId: string) => number;
  getSubunitUsageCount: (unitId: string, subunitId: string) => number;
}

export function SettingsUnits({
  units,
  onAddUnit,
  onUpdateUnit,
  onAddSubunit,
  getUnitUsageCount,
  getSubunitUsageCount
}: SettingsUnitsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'unit' | 'subunit'>('unit');
  const [editingUnit, setEditingUnit] = useState<UnitConfig | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    active: true
  });
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const resetForm = () => {
    setFormData({ name: '', active: true });
    setEditingUnit(null);
    setSelectedUnitId('');
  };

  const openNewUnitDialog = () => {
    resetForm();
    setDialogType('unit');
    setDialogOpen(true);
  };

  const openNewSubunitDialog = (unitId: string) => {
    resetForm();
    setDialogType('subunit');
    setSelectedUnitId(unitId);
    setDialogOpen(true);
  };

  const openEditUnitDialog = (unit: UnitConfig) => {
    setEditingUnit(unit);
    setFormData({
      name: unit.name,
      active: unit.active
    });
    setDialogType('unit');
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (dialogType === 'unit') {
      if (editingUnit) {
        const usageCount = getUnitUsageCount(editingUnit.id);
        if (usageCount > 0 && formData.name !== editingUnit.name) {
          toast.info('Nome atualizado. Registros anteriores mantêm histórico original.');
        }
        onUpdateUnit(editingUnit.id, formData);
        toast.success('Unidade atualizada');
      } else {
        onAddUnit(formData.name);
        toast.success('Unidade criada');
      }
    } else {
      onAddSubunit(selectedUnitId, formData.name);
      toast.success('Subunidade criada');
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = (unit: UnitConfig) => {
    onUpdateUnit(unit.id, { active: !unit.active });
    toast.success(unit.active ? 'Unidade inativada' : 'Unidade reativada');
  };

  const handleToggleSubunitActive = (unit: UnitConfig, subunit: Subunit) => {
    const updatedSubunits = unit.subunits?.map(s =>
      s.id === subunit.id ? { ...s, active: !s.active } : s
    ) || [];
    onUpdateUnit(unit.id, { subunits: updatedSubunits });
    toast.success(subunit.active ? 'Subunidade inativada' : 'Subunidade reativada');
  };

  const toggleExpanded = (unitId: string) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Unidades
            </CardTitle>
            <CardDescription>
              Gerencie unidades e subunidades do sistema
            </CardDescription>
          </div>
          <Button onClick={openNewUnitDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Unidade
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {units.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma unidade cadastrada
              </p>
            ) : (
              units.map((unit) => {
                const usageCount = getUnitUsageCount(unit.id);
                const isInUse = usageCount > 0;
                const hasSubunits = (unit.subunits?.length || 0) > 0;

                return (
                  <Collapsible
                    key={unit.id}
                    open={expandedUnits.has(unit.id)}
                    onOpenChange={() => toggleExpanded(unit.id)}
                  >
                    <div className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          {hasSubunits && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <ChevronDown className={`h-4 w-4 transition-transform ${
                                  expandedUnits.has(unit.id) ? 'rotate-180' : ''
                                }`} />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          {!hasSubunits && <div className="w-6" />}
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{unit.name}</span>
                              {unit.active ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                                  Inativo
                                </Badge>
                              )}
                              {isInUse && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                      Em uso ({usageCount})
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Esta unidade possui {usageCount} registros vinculados.</p>
                                    <p className="text-xs text-muted-foreground">Para manter histórico, utilize inativação.</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            {hasSubunits && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {unit.subunits?.length} subunidade{(unit.subunits?.length || 0) > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openNewSubunitDialog(unit.id)}
                              >
                                <MapPin className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Adicionar subunidade</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditUnitDialog(unit)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar unidade</TooltipContent>
                          </Tooltip>
                          <Switch
                            checked={unit.active}
                            onCheckedChange={() => handleToggleActive(unit)}
                          />
                        </div>
                      </div>

                      <CollapsibleContent>
                        {hasSubunits && (
                          <div className="border-t px-3 py-2 space-y-1 bg-muted/30">
                            {unit.subunits?.map((subunit) => {
                              const subUsageCount = getSubunitUsageCount(unit.id, subunit.id);
                              const subInUse = subUsageCount > 0;

                              return (
                                <div
                                  key={subunit.id}
                                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 ml-8"
                                >
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{subunit.name}</span>
                                    {subunit.active ? (
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                        Ativo
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                                        Inativo
                                      </Badge>
                                    )}
                                    {subInUse && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                            Em uso ({subUsageCount})
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Esta subunidade possui {subUsageCount} registros.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                  <Switch
                                    checked={subunit.active}
                                    onCheckedChange={() => handleToggleSubunitActive(unit, subunit)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Unidades com histórico não podem ser excluídas, apenas inativadas.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'unit'
                ? (editingUnit ? 'Editar Unidade' : 'Nova Unidade')
                : 'Nova Subunidade'
              }
            </DialogTitle>
            <DialogDescription>
              {editingUnit && getUnitUsageCount(editingUnit.id) > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Esta unidade possui {getUnitUsageCount(editingUnit.id)} registros vinculados
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={dialogType === 'unit' ? 'Ex: Hospital Central' : 'Ex: Ala Norte'}
              />
            </div>

            {editingUnit && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Disponível para novos lançamentos
                  </p>
                </div>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingUnit ? 'Salvar Alterações' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
