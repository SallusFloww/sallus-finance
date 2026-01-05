// ============= TIPOS SIMPLIFICADOS - VERSÃO FORENSE =============
// Sistema trabalha APENAS com dinheiro que JÁ ENTROU e JÁ SAIU
// Sem previsões, sem projeções, sem status pendente

export type TransactionType = "INCOME" | "EXPENSE";

// Status de movimentação:
// - PENDENTE: movimentação agendada/prevista (NÃO impacta saldo até ser realizada)
// - REALIZADO: dinheiro efetivamente entrou ou saiu (compõe o saldo)
// - CANCELADO: movimentação cancelada logicamente (NÃO compõe o saldo, mas permanece no histórico)
export type TransactionStatus = "PENDENTE" | "REALIZADO" | "CANCELADO";

// Log de edição de transação
export interface TransactionEditLog {
  field: string;
  previousValue: string;
  newValue: string;
  editedAt: string;
  editedBy: string;
}

// ============= ORIGEM DA TRANSAÇÃO (RASTREABILIDADE) =============
// Identifica como a transação foi criada no sistema
export type TransactionOrigin = 
  | "MANUAL"                    // Criada pelo usuário via formulário
  | "FATURAMENTO_RECEBIDO"      // Gerada automaticamente ao receber faturamento
  | "FATURAMENTO_GLOSA_PARCIAL" // Gerada automaticamente ao registrar glosa parcial
  | "RECURSO_GLOSA"             // Gerada automaticamente ao deferir recurso de glosa
  | "IMPORTACAO"                // Importada via arquivo
  | "MIGRACAO";                 // Migrada de sistema anterior

// ============= CLASSIFICAÇÃO FINANCEIRA =============
// 3 macro classificações obrigatórias para todas as transações
export type FinancialCategory = 
  | "OPERACIONAL"       // Receitas/despesas operacionais diretas da unidade
  | "COMPARTILHADO"     // Custos operacionais compartilhados (corporativo)
  | "NAO_OPERACIONAL";  // Financeiras não assistenciais (aportes, distribuições, etc.)

// Critérios de rateio para custos compartilhados
export type ApportionmentCriteria = 
  | "IGUAL"             // Divide igualmente entre unidades
  | "MANUAL"            // Rateio definido manualmente
  | "FATURAMENTO"       // Proporcional ao faturamento
  | "PRODUCAO";         // Proporcional à produção

// ============= RATEIO POR UNIDADE =============
// Estrutura para armazenar o rateio detalhado por unidade
export interface UnitApportionment {
  unitId: string;
  unitName: string;
  criterionValue: number;  // Valor do critério (%, m², etc.)
  apportionedAmount: number; // Valor rateado em R$
}

// Subtipos para Não Operacional / Financeiro
export type NonOperationalSubtype =
  // RECEITAS NÃO OPERACIONAIS
  | "APORTE_SOCIO"
  | "ROYALTIES_ALUGUEL_MARCA"
  | "RECEITA_ALUGUEL_ESPACOS"
  | "RECEITA_FINANCEIRA"
  | "REEMBOLSO_RESSARCIMENTO"
  | "AJUSTE_CONTABIL_POSITIVO"
  // DESPESAS NÃO OPERACIONAIS
  | "DISTRIBUICAO_LUCROS"
  | "AJUSTE_CONTABIL_NEGATIVO"
  | "EVENTO_EXTRAORDINARIO"
  | "DESPESA_FINANCEIRA"
  | "DESPESA_JURIDICA_NAO_RECORRENTE";

// Nível 4 - Formas de pagamento para Particular
export type PaymentMethodParticular = 
  | "DINHEIRO" 
  | "CARTAO_DEBITO" 
  | "CREDITO_VISTA" 
  | "CREDITO_PARCELADO" 
  | "PIX";

// Nível 4 - Operadoras para Convênios
export type Operadora = "IPASGO" | "UNIMED" | "BRADESCO" | "GEAP";

// Nível 3 - Tipo de Recebimento (apenas para INCOME)
export type ReceiptType = "PARTICULAR" | "CONVENIO";

// Nível 2 - Especialidades do Centro Clínico (gerenciável via Configurações)
export type Specialty = string;

// Configuração de especialidade (gerenciável)
export interface SpecialtyConfig {
  id: string;
  name: string;
  active: boolean;
}

// Nível 1 - Unidades de Negócio
export type BusinessUnit = "ONCOLOGIA" | "PRONTO_SOCORRO" | "CENTRO_CLINICO";

// Legacy - manter compatibilidade
export type PaymentMethod = "PIX" | "TRANSFER" | "CASH" | "CARD";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  
  // ============= CLASSIFICAÇÃO FINANCEIRA (OBRIGATÓRIO) =============
  financialCategory: FinancialCategory;
  // Subtipo para Não Operacional
  nonOperationalSubtype?: NonOperationalSubtype;
  // Descrição obrigatória para "Outros" em Não Operacional
  nonOperationalDescription?: string;
  // Campos para Ajuste/Evento Extraordinário
  adjustmentReason?: string;
  adjustmentReference?: string;
  isNonRecurrent?: boolean;
  // Campos para Custo Compartilhado (Corporativo)
  apportionmentCriteria?: ApportionmentCriteria;
  // Rateio detalhado por unidade
  unitApportionments?: UnitApportionment[];
  
  // Nível 1 - Unidade de Negócio (opcional para Não Operacional)
  unit: string;
  // Nível 2 - Especialidade (apenas para Centro Clínico)
  specialty?: Specialty;
  // Nível 3 - Tipo de Recebimento (apenas para INCOME Operacional)
  receiptType?: ReceiptType;
  // Nível 4 - Forma de pagamento (Particular) ou Operadora (Convênio)
  paymentMethodParticular?: PaymentMethodParticular;
  operadora?: Operadora;
  // Campos gerais
  category: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  // ============= CONTROLE DE RECEBIMENTO (ENTRADAS) =============
  // Data em que o valor foi efetivamente recebido (apenas para INCOME)
  receivedAt?: string;
  // Observação sobre o recebimento
  receiptObservation?: string;
  // ID do agrupamento de recebimentos (quando faz parte de um grupo)
  receiptGroupId?: string;
  // Campos de cancelamento (soft delete)
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;
  // Histórico de edições
  editLogs?: TransactionEditLog[];
  // ============= RASTREABILIDADE DE ORIGEM =============
  // Identifica como a transação foi criada no sistema
  origin?: TransactionOrigin;
  // ID do recebível vinculado (para transações automáticas de faturamento)
  sourceReceivableId?: string;
}

export interface User {
  name: string;
  department: string;
  lastLogin: string;
}

// Subunidade / Setor dentro de uma unidade
export interface Subunit {
  id: string;
  name: string;
  active: boolean;
}

export interface UnitConfig {
  id: string;
  name: string;
  active: boolean;
  subunits?: Subunit[];
  // Especialidades (apenas para Centro Clínico)
  specialties?: SpecialtyConfig[];
}

export type CategoryType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  // Campos opcionais de governança
  isStrategic?: boolean;
  impactsPredictability?: boolean;
  internalNote?: string;
}

// Registro de ajuste de saldo inicial
export interface InitialBalanceAdjustment {
  id: string;
  previousValue: number;
  newValue: number;
  adjustedBy: string;
  adjustedAt: string;
  reason?: string;
}

export interface Settings {
  units: UnitConfig[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  initialBalance: number;
  initialBalanceLastUpdate?: string;
  initialBalanceAdjustments?: InitialBalanceAdjustment[];
}

export type AuditAction =
  | "CREATE_TRANSACTION"
  | "UPDATE_TRANSACTION"
  | "DELETE_TRANSACTION"
  | "IMPORT_DATA"
  | "EXPORT_DATA"
  | "LOGIN"
  | "LOGOUT"
  | "UPDATE_SETTINGS"
  | "ADJUST_INITIAL_BALANCE";

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  details: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============= DASHBOARD STATS - SIMPLIFICADO =============
// Fórmula única: Saldo Atual = Saldo Inicial + Entradas - Saídas
export interface DashboardStats {
  // Base
  initialBalance: number;
  initialBalanceLastUpdate?: string;
  
  // Totais REALIZADOS (único tipo de movimentação)
  totalIncome: number;
  totalExpense: number;
  
  // SALDO ATUAL = initialBalance + totalIncome - totalExpense
  currentBalance: number;
  
  // Contadores
  transactionCount: number;
  
  // ============= CONTROLE DE STATUS DE ENTRADAS =============
  // Total de entradas por status
  incomeByStatus: {
    previsto: number;    // PENDENTE - não entrou no caixa
    recebido: number;    // REALIZADO - já entrou no caixa
    cancelado: number;   // CANCELADO - não será recebido
  };
  // Contagem de entradas por status
  incomeCountByStatus: {
    previsto: number;
    recebido: number;
    cancelado: number;
  };
  
  // Detalhamento por tipo de recebimento (para análise, não projeção)
  incomeByReceiptType: {
    particular: number;
    convenio: number;
  };
  
  // Detalhamento por forma de pagamento
  incomeByPaymentMethod: {
    dinheiro: number;
    pix: number;
    debito: number;
    creditoVista: number;
    creditoParcelado: number;
  };
  
  // Detalhamento por operadora
  incomeByOperadora: {
    ipasgo: number;
    unimed: number;
    bradesco: number;
    geap: number;
  };
  
  // Detalhamento de saídas por categoria
  expenseByCategory: Record<string, number>;
}

export interface UnitStats {
  unit: string;
  income: number;
  expense: number;
  transactionCount: number;
  netBalance: number;
}

// ============= FASE 2: FATURAMENTO A RECEBER (RECEBÍVEIS) =============
// Valores faturados que ainda não entraram em caixa
// ISOLADOS de: Caixa, DRE, Score até efetivo recebimento

export type ReceivableStatus = "FATURADO" | "RECEBIDO" | "RECEBIDO_COM_GLOSA" | "GLOSADO";

export type GlossType = "PARCIAL" | "TOTAL";

// ============= SUBSTATUS DE RECURSO DE GLOSA =============
export type AppealStatus = 
  | "NAO_INICIADO"     // Recurso não iniciado
  | "EM_RECURSO"       // Em recurso
  | "DEFERIDO"         // Recurso deferido (valor recuperado)
  | "INDEFERIDO";      // Recurso indeferido (perda definitiva)

export interface ReceivableEditLog {
  field: string;
  previousValue: string;
  newValue: string;
  editedAt: string;
  editedBy: string;
}

// ============= HISTÓRICO DE EVENTOS DO RECEBÍVEL =============
export interface ReceivableHistoryEntry {
  id: string;
  action: 
    | "CRIADO"
    | "RECEBIDO"
    | "GLOSA_REGISTRADA"
    | "RECURSO_INICIADO"
    | "RECURSO_DEFERIDO"
    | "RECURSO_INDEFERIDO"
    | "EDITADO";
  description: string;
  timestamp: string;
  userName: string;
  // Valores envolvidos na ação
  amount?: number;
  // Transação gerada (se houver)
  linkedTransactionId?: string;
}

export interface Receivable {
  id: string;
  // Data do faturamento
  billingDate: string;
  // Competência do faturamento (MM/YYYY) - período de prestação do serviço
  competencia?: string;
  // Unidade de negócio
  unit: string;
  // Convênio/Origem do faturamento
  source: string;
  // Descrição do serviço/procedimento
  description: string;
  
  // ============= TRÊS VALORES OBRIGATÓRIOS =============
  // Valor original faturado (NUNCA muda após criação)
  billedAmount: number;
  // Valor efetivamente recebido (acumulado de todos os recebimentos)
  receivedAmount: number;
  // Valor total glosado (acumulado de glosas)
  glossedAmount: number;
  // REGRA: billedAmount = receivedAmount + glossedAmount (quando finalizado)
  
  // Status principal
  status: ReceivableStatus;
  
  // ============= CONTROLE DE GLOSA E RECURSO =============
  // Tipo de glosa (quando houver)
  glossType?: GlossType;
  // Motivo da glosa (obrigatório quando glosado)
  glossReason?: string;
  // Substatus do recurso de glosa
  appealStatus?: AppealStatus;
  // Valor em recurso (pode ser diferente do glossedAmount se recurso parcial)
  appealAmount?: number;
  // Data de abertura do recurso
  appealStartDate?: string;
  // Data de resolução do recurso
  appealResolvedDate?: string;
  // Valor recuperado via recurso (quando deferido)
  appealRecoveredAmount?: number;
  // ID da transação gerada pelo recurso deferido
  appealTransactionId?: string;
  
  // ============= DATAS E PRAZOS =============
  // Prazo estimado de recebimento (dias)
  expectedReceiptDays?: number;
  // Data efetiva do recebimento (primeiro recebimento)
  actualReceiptDate?: string;
  
  // ============= OBSERVAÇÕES =============
  notes?: string;
  
  // ============= AUDITORIA COMPLETA =============
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  // ID da movimentação gerada (recebimento inicial)
  linkedTransactionId?: string;
  // Histórico de edições simples
  editLogs?: ReceivableEditLog[];
  // Histórico completo de eventos
  history?: ReceivableHistoryEntry[];
  
  // ============= CAMPOS LEGADOS (manter compatibilidade) =============
  expectedReceiptDate?: string;
  glossAmount?: number; // Deprecated: usar glossedAmount
}

export interface ReceivablesStats {
  totalBilled: number;
  totalReceived: number;
  totalOpen: number;
  totalGlossed: number;
  totalInAppeal: number;        // Valor em recurso
  totalRecovered: number;       // Valor recuperado via recurso
  totalDefinitiveLoss: number;  // Perda definitiva (glosa indeferida)
  count: number;
  averageReceiptDays: number;
}

// ============= FASE 3: PRODUÇÃO ASSISTENCIAL =============
// Rastreamento da produção antes do faturamento
// ISOLADO de: Caixa, DRE, Score - alimenta apenas indicadores operacionais

export type ProductionStatus = "PRODUZIDO" | "FATURADO" | "GLOSADO" | "RECEBIDO";

// ProductionType é string para permitir cadastro dinâmico de novos tipos
export type ProductionType = string;

// Tipos base de produção OFICIAIS (padrão do sistema)
// Modelo definitivo IMEC Saúde
export const BASE_PRODUCTION_TYPES = [
  "CONSULTA",
  "EXAME",
  "QUIMIOTERAPIA",
  "BOX_PS",
  "SESSAO_TERAPEUTICA",
  "INTERNACAO",
  "OUTRO",
] as const;

// Subtipos para Exame
export type ExamType = string;

// Subtipos para Box  
export type BoxType = string;

// Subtipos para Sessão Terapêutica
export type TherapySessionType = string;

export interface ProductionEditLog {
  field: string;
  previousValue: string;
  newValue: string;
  editedAt: string;
  editedBy: string;
}

export interface ProductionHistoryEntry {
  id: string;
  action: 
    | "CRIADO"
    | "VINCULADO_FATURAMENTO"
    | "GLOSADO"
    | "RECEBIDO"
    | "EDITADO";
  description: string;
  timestamp: string;
  userName: string;
  // Valores envolvidos
  amount?: number;
  // Faturamento vinculado (se houver)
  linkedReceivableId?: string;
}

export interface Production {
  id: string;
  // Data da produção
  productionDate: string;
  // Competência (MM/YYYY)
  competencia: string;
  // Unidade de negócio
  unit: string;
  // Especialidade (se aplicável)
  specialty?: string;
  // Convênio ou Particular
  payerType: "CONVENIO" | "PARTICULAR";
  // Convênio específico (se payerType = CONVENIO)
  convenio?: string;
  // Tipo de produção
  productionType: ProductionType;
  // Procedimento/Exame realizado
  description: string;
  // Código do procedimento (TUSS, AMB, etc.)
  procedureCode?: string;
  // Quantidade produzida (campo central)
  quantity: number;
  // Valor unitário estimado (opcional para referência)
  unitValue: number;
  // Valor total estimado (quantity * unitValue)
  estimatedValue: number;
  // Status da produção
  status: ProductionStatus;
  
  // ============= CAMPOS DINÂMICOS POR TIPO =============
  // Tipo de exame (se productionType = EXAME)
  examType?: ExamType;
  // Tipo de box (se productionType = BOX)
  boxType?: BoxType;
  // Tipo de sessão terapêutica (se productionType = SESSAO_TERAPEUTICA)
  therapySessionType?: TherapySessionType;
  
  // ============= VÍNCULO COM FATURAMENTO =============
  // IDs dos faturamentos vinculados
  linkedReceivableIds?: string[];
  // Valor faturado (quando vinculado)
  billedValue?: number;
  // Valor recebido (quando recebido)
  receivedValue?: number;
  // Valor glosado (quando glosado)
  glossedValue?: number;
  
  // ============= AUDITORIA =============
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  editLogs?: ProductionEditLog[];
  history?: ProductionHistoryEntry[];
}

export interface ProductionStats {
  // ============= INDICADORES QUANTITATIVOS (FOCO PRINCIPAL) =============
  // Total de exames/procedimentos produzidos
  totalQuantityProduced: number;
  // Quantidade faturada
  totalQuantityBilled: number;
  // Quantidade recebida
  totalQuantityReceived: number;
  // Quantidade em aberto (não faturada)
  totalQuantityOpen: number;
  // Quantidade glosada
  totalQuantityGlossed: number;
  
  // ============= VALORES FINANCEIROS (REFERÊNCIA) =============
  totalProduced: number;        // Valor total produzido
  totalBilled: number;          // Valor faturado
  totalReceived: number;        // Valor recebido
  totalOpen: number;            // Produção não faturada
  totalGlossed: number;         // Valor glosado
  
  // Contadores de registros
  countProduced: number;
  countBilled: number;
  countReceived: number;
  countOpen: number;
  
  // ============= TAXAS DE CONVERSÃO (BASEADAS EM QUANTIDADE) =============
  billingRate: number;          // % Produzido → Faturado (qtde)
  receiptRate: number;          // % Faturado → Recebido (qtde)
  conversionRate: number;       // % Produzido → Caixa (end-to-end, qtde)
  glossRate: number;            // % de glosa (qtde)
  
  // Por tipo de produção (dinâmico)
  byProductionType: Record<string, { count: number; quantity: number; value: number }>;
  // Por pagador (por quantidade)
  byPayerType: { convenio: number; particular: number };
  byPayerTypeQuantity: { convenio: number; particular: number };
}

// ============= CONFIGURAÇÕES DO SISTEMA =============

// Configuração de Tipo de Produção (gerenciável)
export interface ProductionTypeConfig {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  allowBatchEntry: boolean;  // Permite lançamento em lote?
  requiresDetail: boolean;   // Exige detalhamento (exame/procedimento)?
  valueModel: "TOTAL" | "QUANTITY_AVERAGE"; // Modelo de valor
  createdAt?: string;
  updatedAt?: string;
}

// Configuração de Tipo de Exame/Procedimento (gerenciável)
export interface ExamTypeConfig {
  id: string;
  name: string;
  linkedProductionType: string; // Tipo de produção vinculado
  category: "IMAGEM" | "LABORATORIO" | "TERAPIA" | "OUTRO";
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Configuração de Convênio/Pagador (gerenciável)
export interface PayerConfig {
  id: string;
  name: string;
  type: "CONVENIO" | "PARTICULAR";
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Parâmetros do Sistema
export interface SystemParameters {
  // Dias para alerta de produção sem faturamento
  daysForBillingAlert: number;
  // Permitir competência futura?
  allowFutureCompetence: boolean;
  // Permitir exclusão física de registros?
  allowPhysicalDeletion: boolean;
  // Tipo de confirmação para ações críticas
  criticalActionConfirmation: "SIMPLE" | "REINFORCED";
  // Data da última atualização
  updatedAt?: string;
  updatedBy?: string;
}

// Log de alteração de configuração
export interface SettingsChangeLog {
  id: string;
  section: "UNITS" | "CATEGORIES" | "PRODUCTION_TYPES" | "EXAM_TYPES" | "PAYERS" | "PARAMETERS";
  action: "CREATE" | "UPDATE" | "DEACTIVATE" | "REACTIVATE";
  entityId: string;
  entityName: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  changedAt: string;
}

// Settings expandido
export interface ExpandedSettings extends Settings {
  productionTypes?: ProductionTypeConfig[];
  examTypes?: ExamTypeConfig[];
  payers?: PayerConfig[];
  systemParameters?: SystemParameters;
  settingsChangeLogs?: SettingsChangeLog[];
}
