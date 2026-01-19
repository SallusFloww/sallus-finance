import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WINDOWS = [
  { label: "10 min", minutes: 10 },
  { label: "30 min", minutes: 30 },
  { label: "1 hora", minutes: 60 },
  { label: "2 horas", minutes: 120 },
  { label: "24 horas", minutes: 1440 },
];

export default function AdminCleanup() {
  const [minutes, setMinutes] = useState<number>(10);
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canExecute = useMemo(() => confirmText.trim().toUpperCase() === "LIMPAR TESTES", [confirmText]);

  const runPreview = async (m = minutes) => {
    setLoading(true);
    setPreview(null);

    const { data, error } = await supabase.rpc("cleanup_company_data_by_window", {
      p_minutes: m,
      p_dry_run: true,
      p_confirm_text: "",
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPreview(data);
    toast.success("Prévia gerada com sucesso.");
  };

  const runExecute = async () => {
    if (!canExecute) {
      toast.error('Digite "LIMPAR TESTES" para confirmar.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("cleanup_company_data_by_window", {
      p_minutes: minutes,
      p_dry_run: false,
      p_confirm_text: "LIMPAR TESTES",
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPreview(data);
    toast.success("Limpeza executada com sucesso.");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">🧹 Limpeza rápida (dados de teste)</div>
        <div className="text-sm text-muted-foreground">
          Remove dados criados dentro da janela selecionada. Apenas Admin. Ação irreversível.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w.minutes}
              variant={minutes === w.minutes ? "default" : "outline"}
              onClick={() => {
                setMinutes(w.minutes);
                runPreview(w.minutes);
              }}
              disabled={loading}
            >
              {w.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" onClick={() => runPreview(minutes)} disabled={loading}>
            Gerar prévia
          </Button>

          <div className="flex-1">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Digite "LIMPAR TESTES" para habilitar'
              disabled={loading}
            />
          </div>

          <Button onClick={runExecute} disabled={loading || !canExecute}>
            Executar limpeza
          </Button>
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl border p-4 space-y-2">
          <div className="font-semibold">Resultado</div>
          <pre className="text-xs overflow-auto bg-muted p-3 rounded-xl">{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
