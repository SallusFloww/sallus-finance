import React, { createContext, useContext, ReactNode } from "react";
import { useTransactionsDB } from "@/hooks/useTransactionsDB";
import { useAuditLogDB } from "@/hooks/useAuditLogDB";

interface AppContextType {
  transactions: ReturnType<typeof useTransactionsDB>;
  auditLog: ReturnType<typeof useAuditLogDB>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const transactions = useTransactionsDB();
  const auditLog = useAuditLogDB();

  return (
    <AppContext.Provider value={{ transactions, auditLog }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
