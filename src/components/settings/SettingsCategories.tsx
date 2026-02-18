import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, AlertCircle, Info, TrendingUp, TrendingDown, Star, CheckCircle2, XCircle } from 'lucide-react';
import { Category, CategoryType } from '@/types';
import { toast } from 'sonner';

interface SettingsCategoriesProps {
  categories: Category[];
  onAdd: (name: string, type: CategoryType, code: string) => void;
  onUpdate: (id: string, updates: Partial<Category>) => void;
  getUsageCount: (categoryId: string) => number;
}

export function SettingsCategories({
  categories,
  onAdd,
  onUpdate,
  getUsageCount
}: SettingsCategoriesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeTab, setActiveTab] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [formData, setFormData] = useState({
    name: '',
    type: 'INCOME' as CategoryType,
    isStrategic: false,
    impactsPredictability: false,
    internalNote: '',
    active: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: activeTab,
      isStrategic: false,
      impactsPredictability: false,
      internalNote: '',
      active: true
    });
    setEditingCategory(null);
  };

  const openNewDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, type: activeTab }));
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      isStrategic: category.isStrategic || false,
      impactsPredictability: category.impactsPredictability || false,
      internalNote: category.internalNote || '',
      active: category.active
    });
    setDialogOpen(true);
  };

  // Generate the DB-compatible code from a display name (uppercase slug)
  const generateCode = (name: string): string =>
    name
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

  // Inline validation state derived from current form input
  const codeValidation = useMemo(() => {
    if (editingCategory || !formData.name.trim()) return null;

    const code = generateCode(formData.name);

    if (!code) {
      return {
        status: 'error' as const,
        code: '',
        message: 'O nome precisa conter ao menos uma letra ou número.',
      };
    }

    const duplicate = categories.some(
      (c) => c.id !== editingCategory?.id && (c.code || c.id)?.toUpperCase() === code,
    );

    if (duplicate) {
      return {
        status: 'error' as const,
        code,
        message: `O código "${code}" já está em uso por outra categoria. Escolha um nome diferente.`,
      };
    }

    return { status: 'ok' as const, code, message: '' };
  }, [formData.name, categories, editingCategory]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!editingCategory) {
      if (!codeValidation || codeValidation.status === 'error') {
        toast.error(codeValidation?.message || 'Nome inválido: use letras ou números');
        return;
      }
    }

    const code = generateCode(formData.name);

    if (editingCategory) {
      onUpdate(editingCategory.id, {
        name: formData.name,
        isStrategic: formData.isStrategic,
        impactsPredictability: formData.impactsPredictability,
        internalNote: formData.internalNote || undefined,
        active: formData.active
      });
      toast.success('Categoria atualizada');
    } else {
      onAdd(formData.name, formData.type, code);
      toast.success('Categoria criada');
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = (category: Category) => {
    onUpdate(category.id, { active: !category.active });
    toast.success(category.active ? 'Categoria inativada' : 'Categoria reativada');
  };

  const handleToggleStrategic = (category: Category) => {
    onUpdate(category.id, { isStrategic: !category.isStrategic });
    toast.success(category.isStrategic ? 'Categoria removida de estratégicas' : 'Categoria marcada como estratégica');
  };

  const incomeCategories = categories
    .filter(c => c.type === 'INCOME')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const expenseCategories = categories
    .filter(c => c.type === 'EXPENSE')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const renderCategoryCard = (category: Category) => {
    const usageCount = getUsageCount(category.id);
    const isInUse = usageCount > 0;

    return (
      <div
        key={category.id}
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              {category.active ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                  Inativo
                </Badge>
              )}
              {category.isStrategic && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      Estratégica
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Categoria estratégica impacta DRE e previsibilidade.</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {isInUse && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                      Em uso ({usageCount})
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Esta categoria possui {usageCount} movimentações vinculadas.</p>
                    <p className="text-xs text-muted-foreground">Para manter histórico, utilize inativação.</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {category.internalNote && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {category.internalNote}
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
                onClick={() => handleToggleStrategic(category)}
              >
                <Star className={`h-4 w-4 ${category.isStrategic ? 'fill-purple-500 text-purple-500' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {category.isStrategic ? 'Remover de estratégicas' : 'Marcar como estratégica'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(category)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar categoria</TooltipContent>
          </Tooltip>
          <Switch
            checked={category.active}
            onCheckedChange={() => handleToggleActive(category)}
          />
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categorias</CardTitle>
            <CardDescription>
              Gerencie categorias de entrada e saída
            </CardDescription>
          </div>
          <Button onClick={openNewDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'INCOME' | 'EXPENSE')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="INCOME" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Entradas ({incomeCategories.length})
              </TabsTrigger>
              <TabsTrigger value="EXPENSE" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Saídas ({expenseCategories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="INCOME" className="mt-4 space-y-2">
              {incomeCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma categoria de entrada
                </p>
              ) : (
                incomeCategories.map((cat) => renderCategoryCard(cat))
              )}
            </TabsContent>

            <TabsContent value="EXPENSE" className="mt-4 space-y-2">
              {expenseCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma categoria de saída
                </p>
              ) : (
                expenseCategories.map((cat) => renderCategoryCard(cat))
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Categorias estratégicas impactam DRE e previsibilidade.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory && getUsageCount(editingCategory.id) > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Esta categoria possui {getUsageCount(editingCategory.id)} movimentações vinculadas
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
                placeholder="Ex: Consultas, Folha de Pagamento"
                className={
                  codeValidation?.status === 'error'
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />

              {/* Inline code validation feedback */}
              {formData.name.trim() && !editingCategory && codeValidation && (
                <div className={`flex items-start gap-2 text-xs rounded-md px-2 py-1.5 ${
                  codeValidation.status === 'error'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {codeValidation.status === 'error' ? (
                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-600" />
                  )}
                  <span>
                    {codeValidation.status === 'error' ? (
                      codeValidation.message
                    ) : (
                      <>
                        Código interno:{' '}
                        <code className="font-mono font-semibold text-foreground bg-background/70 px-1 py-0.5 rounded">
                          {codeValidation.code}
                        </code>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {!editingCategory && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={formData.type === 'INCOME' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                    className="flex-1"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Entrada
                  </Button>
                  <Button
                    type="button"
                    variant={formData.type === 'EXPENSE' ? 'default' : 'outline'}
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                    className="flex-1"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Saída
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Categoria Estratégica
                </Label>
                <p className="text-xs text-muted-foreground">
                  Impacta DRE e indicadores de previsibilidade
                </p>
              </div>
              <Switch
                checked={formData.isStrategic}
                onCheckedChange={(checked) => setFormData({ ...formData, isStrategic: checked })}
              />
            </div>

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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editingCategory && codeValidation?.status === 'error'}
            >
              {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
