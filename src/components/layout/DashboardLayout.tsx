import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar, MobileNav } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-7xl p-4 md:p-5 lg:p-6">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <footer className="hidden lg:block border-t border-border bg-card py-2 text-center">
        <p className="text-[10px] text-muted-foreground">
          Sallus Finance — Módulo Financeiro
        </p>
      </footer>
    </div>
  );
}
