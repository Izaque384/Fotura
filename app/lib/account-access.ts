import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuspensaoAdministrativa = {
  ativa: boolean;
  motivo: string;
  suspensoEm: string | null;
  reativadoEm: string | null;
};

export async function obterSuspensaoAdministrativa(supabase: SupabaseClient, userId: string): Promise<SuspensaoAdministrativa | null> {
  const { data, error } = await supabase
    .from("admin_suspensoes")
    .select("ativa,motivo,suspenso_em,reativado_em")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ativa: Boolean(data.ativa),
    motivo: String(data.motivo ?? ""),
    suspensoEm: data.suspenso_em ? String(data.suspenso_em) : null,
    reativadoEm: data.reativado_em ? String(data.reativado_em) : null,
  };
}
