// ============================================
// BI FOOTER - VERSÃO DO PRODUTO
// Release freeze: only bugfixes allowed
// ============================================

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Eye, Info } from "lucide-react";
import { APP_VERSION, RELEASE_MODE } from "@/contracts/version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BIFooterProps {
  lastUpdated: Date;
}

export function BIFooter({ lastUpdated }: BIFooterProps) {
  return (
    <div className="mt-8 pt-6 border-t border-border/50">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status badges */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] gap-1 h-5">
            <Eye className="h-3 w-3" />
            Somente leitura
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 h-5 border-green-200 text-green-700 dark:border-green-900 dark:text-green-400">
            <Shield className="h-3 w-3" />
            Dados protegidos
          </Badge>
        </div>

        {/* Institutional text + Version */}
        <div className="text-center space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium">
            SallusFlow — Gestão Financeira Inteligente
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[10px] text-muted-foreground/70 flex items-center justify-center gap-1 cursor-help">
                  <Info className="h-3 w-3" />
                  Versão {APP_VERSION}
                  {RELEASE_MODE === "production" && (
                    <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-1">
                      Produção
                    </Badge>
                  )}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Versão {APP_VERSION} • Modo: {RELEASE_MODE === "production" ? "Produção" : "Desenvolvimento"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Consolidado até: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>
    </div>
  );
}
