import { Specialty } from "@/types";

export interface CategoryAnalysisItem {
  category: string;
  categoryName: string;
  value: number;
  count: number;
  percentage: number;
  avgTicket?: number;
}

export interface SpecialtyAnalysis {
  specialty: Specialty | "SEM_ESPECIALIDADE";
  name: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
  avgTicket: number;
  percentage: number;
  categories: CategoryAnalysisItem[];
  particular: { value: number; percentage: number };
  convenio: { value: number; percentage: number };
  hasMovement: boolean;
}

export interface UnitAnalysisItem {
  unit: string;
  name: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
  avgTicket: number;
  categories: CategoryAnalysisItem[];
  particular: { value: number; percentage: number };
  convenio: { value: number; percentage: number };
  specialties: SpecialtyAnalysis[];
}

export interface ManagementAlert {
  type: "danger" | "warning" | "info";
  riskType: "Financeiro" | "Concentração" | "Dependência";
  riskIcon: string;
  unit?: string;
  specialty?: string;
  title: string;
  description: string;
  value?: string;
}

export interface RevenueMapItem {
  unit: string;
  unitName: string;
  category: string;
  categoryName: string;
  value: number;
  rank: number;
  percentage: number;
}

export interface OperadoraAnalysisItem {
  id: string;
  name: string;
  value: number;
  percentageOfConvenio: number;
  percentageOfTotal: number;
}

export interface PaymentMethodAnalysisItem {
  id: string;
  name: string;
  value: number;
  count: number;
  avgTicket: number;
  percentage: number;
}

export interface ReceiptTypeAnalysis {
  particular: { value: number; percentage: number };
  convenio: { value: number; percentage: number };
  total: number;
}

export interface FilteredStats {
  initialBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  transactionCount: number;
}
