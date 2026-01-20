import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDoctors(companyId?: string) {
  return useQuery({
    queryKey: ["doctors", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, active")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useCreateDoctor(companyId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!companyId) throw new Error("companyId ausente");

      const { data, error } = await supabase
        .from("doctors")
        .insert({ company_id: companyId, name, active: true })
        .select("id, name, active")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, __, ctx: any) => {
      // invalidate baseado na company do key
      qc.invalidateQueries({ queryKey: ["doctors"] });
    },
  });
}
