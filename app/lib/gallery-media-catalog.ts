import "server-only";
import { createServiceClient } from "./supabase-server";
import { isR2ReadEnabled } from "./r2-storage";

type DB = ReturnType<typeof createServiceClient>;
type Variante = "principal" | "entrega";

export type FotoCatalogo = {
  nome: string;
  criado_em: string | null;
  bytes: number | null;
  mime_type: string | null;
  largura: number | null;
  altura: number | null;
  thumb_bytes: number | null;
};

function nomeArquivoValido(nome: string) {
  return nome.length > 0 && nome.length <= 300 &&
    nome !== "." && nome !== ".." && !/[\/\\\u0000-\u001f\u007f]/.test(nome);
}

/**
 * Mescla o catálogo antigo do Supabase Storage aos objetos verificados do R2.
 * Só inclui R2 quando a leitura R2 está explicitamente habilitada, para
 * permitir a reversão imediata para o Storage legado.
 *
 * O chamador sempre deve validar permissões da galeria antes de expor mídia.
 */
export async function listarCatalogoGaleriaHibrido(
  db: DB,
  userId: string,
  galeriaId: string,
  variante: Variante
): Promise<{ data: FotoCatalogo[] | null; error: unknown }> {
  const legacy = await db.rpc("listar_fotos_galeria_storage", {
    p_galeria: galeriaId, p_user: userId, p_variante: variante,
  });
  if (legacy.error || !isR2ReadEnabled()) {
    return { data: (legacy.data as FotoCatalogo[] | null) ?? null, error: legacy.error };
  }

  try {
    const prefix = userId + "/" + galeriaId + "/" + (variante === "entrega" ? "entrega/" : "");
    const records: Array<{ object_key: string; bytes: number | null; content_type: string | null; created_at: string }> = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const { data, error } = await db.from("fotura_media_objects")
        .select("object_key,bytes,content_type,created_at")
        .eq("bucket", "fotos").eq("owner_id", userId)
        .like("object_key", prefix + "%")
        .order("object_key", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      const rows = (data ?? []) as typeof records;
      records.push(...rows);
      if (rows.length < 500) break;
    }

    const novos = records
      .map((item) => ({ item, nome: item.object_key.slice(prefix.length) }))
      .filter(({ nome, item }) => item.object_key.startsWith(prefix) && nomeArquivoValido(nome) &&
        (variante === "entrega" || (nome !== "thumbs" && nome !== "entrega")));

    const metadata = new Map<string, { largura: number | null; altura: number | null; thumb_bytes: number | null }>();
    for (let i = 0; i < novos.length; i += 200) {
      const nomes = novos.slice(i, i + 200).map((x) => x.nome);
      const { data, error } = await db.from("galeria_foto_metadata")
        .select("nome,largura,altura,thumb_bytes")
        .eq("galeria_id", galeriaId).eq("user_id", userId).eq("variante", variante)
        .in("nome", nomes);
      if (error) throw error;
      for (const item of data ?? []) metadata.set(String(item.nome), item);
    }

    // Preserva informações e ordenação originais em arquivos já presentes nos
    // dois provedores. Nenhum objeto existente é alterado.
    const byName = new Map<string, FotoCatalogo>();
    for (const item of (legacy.data ?? []) as FotoCatalogo[]) {
      if (nomeArquivoValido(item.nome)) byName.set(item.nome, item);
    }
    for (const { item, nome } of novos) {
      if (byName.has(nome)) continue;
      const meta = metadata.get(nome);
      byName.set(nome, {
        nome, criado_em: item.created_at ?? null, bytes: item.bytes,
        mime_type: item.content_type,
        largura: meta?.largura ?? null, altura: meta?.altura ?? null,
        thumb_bytes: meta?.thumb_bytes ?? null,
      });
    }

    const data = [...byName.values()].sort((a, b) =>
      String(a.criado_em ?? "").localeCompare(String(b.criado_em ?? "")) ||
      a.nome.localeCompare(b.nome));
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
