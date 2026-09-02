import type { SupabaseClient } from "@supabase/supabase-js";
import { planoFotura, type PlanoFotura } from "./billing-plans";

const GIB = 1024 * 1024 * 1024;
const STATUS_COM_ACESSO = new Set(["active", "trialing", "past_due"]);

export type UsoPlano = {
  galeriasAtivas: number;
  clientes: number;
  armazenamentoBytes: number;
  armazenamentoGb: number;
};

export type SituacaoLimites = {
  galeriasAtivas: { usado: number; limite: number | null; excedido: boolean };
  clientes: { usado: number; limite: number | null; excedido: boolean };
  armazenamento: { usadoBytes: number; usadoGb: number; limiteGb: number | null; excedido: boolean };
};

export async function obterUsoPlano(supabase: SupabaseClient, userId: string): Promise<UsoPlano> {
  const { data, error } = await supabase.rpc("billing_usage_backend", { p_user_id: userId });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const armazenamentoBytes = Number(row?.armazenamento_bytes ?? 0);

  return {
    galeriasAtivas: Number(row?.galerias_ativas ?? 0),
    clientes: Number(row?.clientes ?? 0),
    armazenamentoBytes,
    armazenamentoGb: Number((armazenamentoBytes / GIB).toFixed(3)),
  };
}

export function avaliarLimites(plano: PlanoFotura, uso: UsoPlano): SituacaoLimites {
  const limiteGalerias = plano.limites.galeriasAtivas;
  const limiteClientes = plano.limites.clientes;
  const limiteArmazenamento = plano.limites.armazenamentoGb;

  return {
    galeriasAtivas: {
      usado: uso.galeriasAtivas,
      limite: limiteGalerias,
      excedido: limiteGalerias !== null && uso.galeriasAtivas >= limiteGalerias,
    },
    clientes: {
      usado: uso.clientes,
      limite: limiteClientes,
      excedido: limiteClientes !== null && uso.clientes >= limiteClientes,
    },
    armazenamento: {
      usadoBytes: uso.armazenamentoBytes,
      usadoGb: uso.armazenamentoGb,
      limiteGb: limiteArmazenamento,
      excedido: limiteArmazenamento !== null && uso.armazenamentoBytes >= limiteArmazenamento * GIB,
    },
  };
}

export function podeAdicionarFotos(plano: PlanoFotura, quantidadeAtual: number, quantidadeNova: number) {
  const limite = plano.limites.fotosPorGaleria;
  if (limite === null) return true;
  return quantidadeAtual + quantidadeNova <= limite;
}

export function recursoLiberado(plano: PlanoFotura, recurso: keyof PlanoFotura["recursos"]) {
  return plano.recursos[recurso];
}

export async function contextoPlano(supabase: SupabaseClient, userId: string) {
  const { data: assinatura, error } = await supabase
    .from("assinaturas")
    .select("plano_codigo,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const status = (assinatura?.status as string | null) ?? "active";
  const codigoPersistido = (assinatura?.plano_codigo as string | null) ?? "sem_plano";
  const plano = STATUS_COM_ACESSO.has(status) ? planoFotura(codigoPersistido) : planoFotura("sem_plano");
  const uso = await obterUsoPlano(supabase, userId);

  return {
    plano,
    planoPersistido: planoFotura(codigoPersistido),
    status,
    uso,
    limites: avaliarLimites(plano, uso),
  };
}
