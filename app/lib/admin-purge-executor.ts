import "server-only";
import { createServiceClient } from "./supabase-server";

const STORAGE_BATCH = 100;
const STATUS_STRIPE_ATIVOS = new Set(["active", "trialing", "past_due"]);

export type PurgeExecucaoResultado = {
  storageRemovido: { fotos: number; marca: number };
  banco: Record<string, number>;
  authRemovido: boolean;
};

type StorageItem = { name: string; id?: string | null };

async function listarArquivosRecursivo(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  pasta: string,
): Promise<string[]> {
  const arquivos: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(pasta, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    const itens = (data ?? []) as StorageItem[];
    for (const item of itens) {
      const caminho = pasta ? `${pasta}/${item.name}` : item.name;
      if (item.id) arquivos.push(caminho);
      else arquivos.push(...await listarArquivosRecursivo(supabase, bucket, caminho));
    }

    if (itens.length < pageSize) break;
    offset += pageSize;
  }

  return arquivos;
}

async function removerPrefixoStorage(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: "fotos" | "marca",
  userId: string,
) {
  const arquivos = await listarArquivosRecursivo(supabase, bucket, userId);
  for (let i = 0; i < arquivos.length; i += STORAGE_BATCH) {
    const lote = arquivos.slice(i, i + STORAGE_BATCH);
    const { error } = await supabase.storage.from(bucket).remove(lote);
    if (error) throw error;
  }
  return arquivos.length;
}

async function checkpoint(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  etapa: "storage" | "banco" | "auth" | "falhou",
  erro: string | null = null,
) {
  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = {
    execucao_etapa: etapa,
    execucao_atualizada_em: agora,
    execucao_erro: erro,
    atualizado_em: agora,
  };
  if (etapa === "storage") patch.execucao_iniciada_em = agora;
  const { error } = await supabase.from("admin_purges").update(patch).eq("user_id", userId);
  if (error) throw error;
}

export async function executarPurgeDefinitivo({
  supabase,
  userId,
  adminUserId,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  userId: string;
  adminUserId: string;
}): Promise<PurgeExecucaoResultado> {
  if (userId === adminUserId) throw new Error("A própria conta administrativa não pode ser purgada.");

  const [{ data: adminAlvo, error: adminError }, { data: purge, error: purgeError }, { data: encerramento, error: encerramentoError }, { data: assinatura, error: assinaturaError }] = await Promise.all([
    supabase.from("admin_usuarios").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("admin_purges").select("status,elegivel_em,execucao_etapa,preview_snapshot").eq("user_id", userId).maybeSingle(),
    supabase.from("admin_encerramentos").select("status").eq("user_id", userId).maybeSingle(),
    supabase.from("assinaturas").select("provedor,provedor_assinatura_id,status").eq("user_id", userId).maybeSingle(),
  ]);
  if (adminError) throw adminError;
  if (purgeError) throw purgeError;
  if (encerramentoError) throw encerramentoError;
  if (assinaturaError) throw assinaturaError;
  if (adminAlvo) throw new Error("Contas administrativas não podem ser purgadas.");
  if (!purge || purge.status !== "agendado") throw new Error("Purge não está agendado.");
  if (!purge.elegivel_em || Date.now() < new Date(purge.elegivel_em).getTime()) throw new Error("O período de segurança do purge ainda não terminou.");
  if (encerramento?.status !== "confirmado") throw new Error("O encerramento administrativo não está confirmado.");
  if (assinatura?.provedor === "stripe" && assinatura.provedor_assinatura_id && STATUS_STRIPE_ATIVOS.has(String(assinatura.status))) {
    throw new Error("A assinatura Stripe ainda está ativa.");
  }

  let etapa = String(purge.execucao_etapa ?? "nao_iniciada");
  const resultado: PurgeExecucaoResultado = { storageRemovido: { fotos: 0, marca: 0 }, banco: {}, authRemovido: false };

  try {
    if (["nao_iniciada", "falhou", "storage"].includes(etapa)) {
      await checkpoint(supabase, userId, "storage");
      resultado.storageRemovido.fotos = await removerPrefixoStorage(supabase, "fotos", userId);
      resultado.storageRemovido.marca = await removerPrefixoStorage(supabase, "marca", userId);
      await checkpoint(supabase, userId, "banco");
      etapa = "banco";
    }

    if (etapa === "banco") {
      const { data, error } = await supabase.rpc("executar_purge_dados_backend", { p_user_id: userId });
      if (error) throw error;
      resultado.banco = (data ?? {}) as Record<string, number>;
      await checkpoint(supabase, userId, "auth");
      etapa = "auth";
    }

    if (etapa === "auth") {
      const { data: authUser, error: lookupError } = await supabase.auth.admin.getUserById(userId);
      if (lookupError && !String(lookupError.message ?? "").toLowerCase().includes("not found")) throw lookupError;
      if (authUser?.user) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;
        resultado.authRemovido = true;
      }

      const { error: finalizarError } = await supabase.rpc("finalizar_purge_backend", {
        p_user_id: userId,
        p_admin_user_id: adminUserId,
      });
      if (finalizarError) throw finalizarError;
    }

    return resultado;
  } catch (error) {
    const mensagem = error instanceof Error ? error.message.slice(0, 1000) : "Falha desconhecida no purge.";
    try { await checkpoint(supabase, userId, "falhou", mensagem); } catch {}
    throw error;
  }
}
