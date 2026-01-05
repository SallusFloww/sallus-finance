import { 
  UnitConfig, 
  Category, 
  PaymentMethod, 
  Settings, 
  BusinessUnit, 
  Specialty, 
  ReceiptType, 
  PaymentMethodParticular, 
  Operadora,
  FinancialCategory,
  NonOperationalSubtype,
  ApportionmentCriteria,
  TransactionOrigin
} from "@/types";

// ============= CLASSIFICAÇÃO FINANCEIRA =============
// 3 macro classificações obrigatórias
export const FINANCIAL_CATEGORIES: { id: FinancialCategory; name: string; icon: string; description: string; sublabel?: string; examples?: string[] }[] = [
  { 
    id: "OPERACIONAL", 
    name: "Operacional — Unidade", 
    icon: "🟢",
    description: "Receitas e custos diretamente ligados à operação assistencial",
    sublabel: "Unidade OBRIGATÓRIA • Impacta Caixa, DRE Operacional, Score",
    examples: ["Consulta", "Quimioterapia", "Medicamentos", "Material assistencial", "Exames"]
  },
  { 
    id: "COMPARTILHADO", 
    name: "Operacional — Compartilhado", 
    icon: "🟣",
    description: "Custos operacionais gerais que sustentam a operação",
    sublabel: "Unidade DESABILITADA • Resultado Operacional Total • Não impacta Score",
    examples: ["Energia", "Água", "Internet", "Limpeza", "Papelaria", "Manutenção predial"]
  },
  { 
    id: "NAO_OPERACIONAL", 
    name: "Não Operacional / Financeiro", 
    icon: "🔵",
    description: "Movimentações que NÃO representam desempenho operacional",
    sublabel: "Unidade DESABILITADA • Resultado Não Operacional • Não impacta Score",
    examples: ["Aporte de Sócio", "Distribuição de Lucros", "Receita Financeira", "Ajuste Contábil"]
  },
];

// ============= CRITÉRIOS DE RATEIO (informativo) =============
export const APPORTIONMENT_CRITERIA: { id: ApportionmentCriteria; name: string; description: string; auto?: boolean }[] = [
  { id: "IGUAL", name: "Igual entre unidades", description: "Divide igualmente entre todas as unidades", auto: true },
  { id: "MANUAL", name: "Manual", description: "Você define os percentuais para cada unidade", auto: false },
  { id: "FATURAMENTO", name: "Por Faturamento", description: "Proporcional ao faturamento de cada unidade", auto: true },
  { id: "PRODUCAO", name: "Por Produção", description: "Proporcional à produção de cada unidade", auto: true },
];

// ============= CATEGORIAS QUE SÃO COMPARTILHADAS POR PADRÃO =============
// Categorias que devem ser automaticamente classificadas como COMPARTILHADO
export const SHARED_EXPENSE_CATEGORIES: string[] = [
  "energia",
  "agua",
  "internet",
  "higiene_limpeza",
  "papelaria",
  "manutencao",
  "seguranca_trabalho",
  "telefonia",
  "lavanderia",
];

// ============= SUBTIPOS NÃO OPERACIONAL / FINANCEIRO =============
export const NON_OPERATIONAL_SUBTYPES: { id: NonOperationalSubtype; name: string; icon: string; type: "INCOME" | "EXPENSE"; description?: string }[] = [
  // RECEITAS NÃO OPERACIONAIS
  { id: "APORTE_SOCIO", name: "Aporte de Sócio", icon: "💰", type: "INCOME", description: "Entrada de capital dos sócios" },
  { id: "ROYALTIES_ALUGUEL_MARCA", name: "Royalties / Aluguel de Marca", icon: "®️", type: "INCOME", description: "Receita por uso de marca ou licenciamento" },
  { id: "RECEITA_ALUGUEL_ESPACOS", name: "Receita de Aluguel (Salas/Espaços)", icon: "🏢", type: "INCOME", description: "Locação de salas ou espaços físicos" },
  { id: "RECEITA_FINANCEIRA", name: "Receita Financeira (juros, rendimentos)", icon: "📈", type: "INCOME", description: "Juros, rendimentos de aplicações" },
  { id: "REEMBOLSO_RESSARCIMENTO", name: "Reembolso / Ressarcimento", icon: "↩️", type: "INCOME", description: "Valores devolvidos ou ressarcidos" },
  { id: "AJUSTE_CONTABIL_POSITIVO", name: "Ajuste Contábil Positivo", icon: "📋", type: "INCOME", description: "Correção contábil a crédito" },
  // DESPESAS NÃO OPERACIONAIS
  { id: "DISTRIBUICAO_LUCROS", name: "Distribuição de Lucros", icon: "💸", type: "EXPENSE", description: "Pagamento de dividendos aos sócios" },
  { id: "AJUSTE_CONTABIL_NEGATIVO", name: "Ajuste Contábil Negativo", icon: "📋", type: "EXPENSE", description: "Correção contábil a débito" },
  { id: "EVENTO_EXTRAORDINARIO", name: "Evento Extraordinário (não recorrente)", icon: "⚡", type: "EXPENSE", description: "Despesa única não prevista" },
  { id: "DESPESA_FINANCEIRA", name: "Despesa Financeira (juros, tarifas)", icon: "📉", type: "EXPENSE", description: "Juros, tarifas bancárias, IOF" },
  { id: "DESPESA_JURIDICA_NAO_RECORRENTE", name: "Despesa Jurídica Não Recorrente", icon: "⚖️", type: "EXPENSE", description: "Acordos, indenizações, honorários extraordinários" },
];

export const FINANCIAL_CATEGORY_LABELS: Record<FinancialCategory, string> = {
  OPERACIONAL: "Operacional — Unidade",
  COMPARTILHADO: "Operacional — Compartilhado",
  NAO_OPERACIONAL: "Não Operacional / Financeiro",
};

export const NON_OPERATIONAL_SUBTYPE_LABELS: Record<NonOperationalSubtype, string> = {
  APORTE_SOCIO: "Aporte de Sócio",
  ROYALTIES_ALUGUEL_MARCA: "Royalties / Aluguel de Marca",
  RECEITA_ALUGUEL_ESPACOS: "Receita de Aluguel (Salas/Espaços)",
  RECEITA_FINANCEIRA: "Receita Financeira",
  REEMBOLSO_RESSARCIMENTO: "Reembolso / Ressarcimento",
  AJUSTE_CONTABIL_POSITIVO: "Ajuste Contábil Positivo",
  DISTRIBUICAO_LUCROS: "Distribuição de Lucros",
  AJUSTE_CONTABIL_NEGATIVO: "Ajuste Contábil Negativo",
  EVENTO_EXTRAORDINARIO: "Evento Extraordinário",
  DESPESA_FINANCEIRA: "Despesa Financeira",
  DESPESA_JURIDICA_NAO_RECORRENTE: "Despesa Jurídica Não Recorrente",
};

// ============= NÍVEL 1 - UNIDADES DE NEGÓCIO =============
export const BUSINESS_UNITS: { id: BusinessUnit; name: string }[] = [
  { id: "ONCOLOGIA", name: "Oncologia" },
  { id: "PRONTO_SOCORRO", name: "Pronto Socorro" },
  { id: "CENTRO_CLINICO", name: "Centro Clínico" },
];

export const DEFAULT_UNITS: UnitConfig[] = [
  { id: "ONCOLOGIA", name: "Oncologia", active: true },
  { id: "PRONTO_SOCORRO", name: "Pronto Socorro", active: true },
  { id: "CENTRO_CLINICO", name: "Centro Clínico", active: true },
];

// ============= NÍVEL 2 - ESPECIALIDADES (Centro Clínico) =============
export const SPECIALTIES: { id: Specialty; name: string }[] = [
  { id: "CARDIOLOGIA", name: "Cardiologia" },
  { id: "HIPERBARICA", name: "Hiperbárica" },
  { id: "OFTALMOLOGIA", name: "Oftalmologia" },
  { id: "NEUROLOGIA", name: "Neurologia" },
  { id: "NUTRICIONISTA", name: "Nutricionista" },
  { id: "DERMATOLOGIA", name: "Dermatologia" },
];

// ============= NÍVEL 3 - TIPO DE RECEBIMENTO =============
export const RECEIPT_TYPES: { id: ReceiptType; name: string }[] = [
  { id: "PARTICULAR", name: "Particular" },
  { id: "CONVENIO", name: "Convênios" },
];

// ============= NÍVEL 4A - FORMAS DE PAGAMENTO (Particular) =============
export const PAYMENT_METHODS_PARTICULAR: { id: PaymentMethodParticular; name: string }[] = [
  { id: "DINHEIRO", name: "Dinheiro" },
  { id: "CARTAO_DEBITO", name: "Cartão de Débito" },
  { id: "CREDITO_VISTA", name: "Crédito à Vista" },
  { id: "CREDITO_PARCELADO", name: "Crédito Parcelado" },
  { id: "PIX", name: "Pix" },
];

// ============= NÍVEL 4B - OPERADORAS (Convênios) =============
export const OPERADORAS: { id: Operadora; name: string }[] = [
  { id: "IPASGO", name: "Ipasgo" },
  { id: "UNIMED", name: "Unimed" },
  { id: "BRADESCO", name: "Bradesco" },
  { id: "GEAP", name: "GEAP" },
];

// ============= CATEGORIAS =============
export const DEFAULT_CATEGORIES: Category[] = [
  // SAÍDAS (Despesas)
  { id: "agua", name: "Água", type: "EXPENSE", active: true },
  { id: "aluguel", name: "Aluguel", type: "EXPENSE", active: true },
  { id: "box", name: "Box", type: "EXPENSE", active: true },
  { id: "cesta_basica", name: "Cesta Básica", type: "EXPENSE", active: true },
  { id: "conselho_regional", name: "Conselho Regional", type: "EXPENSE", active: true },
  { id: "consultoria", name: "Consultoria", type: "EXPENSE", active: true },
  { id: "contabilidade", name: "Contabilidade", type: "EXPENSE", active: true },
  { id: "correios", name: "Correios", type: "EXPENSE", active: true },
  { id: "educacao", name: "Educação", type: "EXPENSE", active: true },
  { id: "energia", name: "Energia", type: "EXPENSE", active: true },
  { id: "estorno", name: "Estorno", type: "EXPENSE", active: true },
  { id: "ferias", name: "Férias", type: "EXPENSE", active: true },
  { id: "gratificacao", name: "Gratificação", type: "EXPENSE", active: true },
  { id: "higiene_limpeza", name: "Higiene e Limpeza", type: "EXPENSE", active: true },
  { id: "hospedagem", name: "Hospedagem", type: "EXPENSE", active: true },
  { id: "imposto", name: "Imposto", type: "EXPENSE", active: true },
  { id: "informatica", name: "Informática", type: "EXPENSE", active: true },
  { id: "internet", name: "Internet", type: "EXPENSE", active: true },
  { id: "lavanderia", name: "Lavanderia", type: "EXPENSE", active: true },
  { id: "mantimentos", name: "Mantimentos", type: "EXPENSE", active: true },
  { id: "manutencao", name: "Manutenção", type: "EXPENSE", active: true },
  { id: "marketing", name: "Marketing", type: "EXPENSE", active: true },
  { id: "medicacao", name: "Medicação", type: "EXPENSE", active: true },
  { id: "medicamento", name: "Medicamento", type: "EXPENSE", active: true },
  { id: "moveis", name: "Móveis", type: "EXPENSE", active: true },
  { id: "papelaria", name: "Papelaria", type: "EXPENSE", active: true },
  { id: "fornecedor", name: "Fornecedor", type: "EXPENSE", active: true },
  { id: "rescisao", name: "Rescisão", type: "EXPENSE", active: true },
  { id: "royalty", name: "Royalty", type: "EXPENSE", active: true },
  { id: "salario", name: "Salário", type: "EXPENSE", active: true },
  { id: "seguranca_trabalho", name: "Segurança do Trabalho", type: "EXPENSE", active: true },
  { id: "sistema", name: "Sistema", type: "EXPENSE", active: true },
  { id: "tarifas", name: "Tarifas", type: "EXPENSE", active: true },
  { id: "telefonia", name: "Telefonia", type: "EXPENSE", active: true },
  { id: "uniforme", name: "Uniforme", type: "EXPENSE", active: true },
  // ENTRADAS (Receitas)
  { id: "consulta", name: "Consulta", type: "INCOME", active: true },
  { id: "convenios", name: "Convênios", type: "INCOME", active: true },
  { id: "ecg", name: "ECG", type: "INCOME", active: true },
  { id: "exame", name: "Exame", type: "INCOME", active: true },
  { id: "holter", name: "Holter", type: "INCOME", active: true },
  { id: "mapa", name: "Mapa", type: "INCOME", active: true },
  { id: "medico", name: "Médico", type: "INCOME", active: true },
  { id: "parecer", name: "Parecer", type: "INCOME", active: true },
  { id: "quimioterapia", name: "Quimioterapia", type: "INCOME", active: true },
  { id: "reembolso", name: "Reembolso", type: "INCOME", active: true },
  { id: "teste_ergometrico", name: "Teste Ergométrico", type: "INCOME", active: true },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ["PIX", "TRANSFER", "CASH", "CARD"];

export const DEFAULT_SETTINGS: Settings = {
  units: DEFAULT_UNITS,
  categories: DEFAULT_CATEGORIES,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  initialBalance: 0,
  initialBalanceAdjustments: [],
};

export const STORAGE_KEYS = {
  USER: "sallusflow_user",
  TRANSACTIONS: "sallusflow_transactions",
  SETTINGS: "sallusflow_settings",
  AUDIT_LOGS: "sallusflow_audit",
};

// ============= LABELS =============
export const UNIT_LABELS: Record<string, string> = {
  ONCOLOGIA: "Oncologia",
  PRONTO_SOCORRO: "Pronto Socorro",
  CENTRO_CLINICO: "Centro Clínico",
};

export const SPECIALTY_LABELS: Record<string, string> = {
  CARDIOLOGIA: "Cardiologia",
  HIPERBARICA: "Hiperbárica",
  OFTALMOLOGIA: "Oftalmologia",
  NEUROLOGIA: "Neurologia",
  NUTRICIONISTA: "Nutricionista",
  DERMATOLOGIA: "Dermatologia",
};

export const RECEIPT_TYPE_LABELS: Record<string, string> = {
  PARTICULAR: "Particular",
  CONVENIO: "Convênios",
};

export const PAYMENT_METHOD_PARTICULAR_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de Débito",
  CREDITO_VISTA: "Crédito à Vista",
  CREDITO_PARCELADO: "Crédito Parcelado",
  PIX: "Pix",
};

export const OPERADORA_LABELS: Record<string, string> = {
  IPASGO: "Ipasgo",
  UNIMED: "Unimed",
  BRADESCO: "Bradesco",
  GEAP: "GEAP",
};

// Status de movimentações
export const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  TRANSFER: "Transferência",
  CASH: "Dinheiro",
  CARD: "Cartão",
};

// ============= ORIGEM DA TRANSAÇÃO (RASTREABILIDADE) =============
export const TRANSACTION_ORIGIN_LABELS: Record<TransactionOrigin, string> = {
  MANUAL: "Manual",
  FATURAMENTO_RECEBIDO: "Recebimento de Faturamento",
  FATURAMENTO_GLOSA_PARCIAL: "Glosa Parcial",
  RECURSO_GLOSA: "Recurso de Glosa",
  IMPORTACAO: "Importação",
  MIGRACAO: "Migração",
};

export const TRANSACTION_ORIGIN_ICONS: Record<TransactionOrigin, string> = {
  MANUAL: "✍️",
  FATURAMENTO_RECEBIDO: "📋",
  FATURAMENTO_GLOSA_PARCIAL: "⚠️",
  RECURSO_GLOSA: "📝",
  IMPORTACAO: "📥",
  MIGRACAO: "🔄",
};
