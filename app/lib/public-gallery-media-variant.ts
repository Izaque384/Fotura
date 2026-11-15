import type { createServiceClient } from "./supabase-server";

export type VariantePublica = "principal" | "entrega";

type GaleriaPublicavel = {
  id: string;
  etapa: string | null;
  prova: boolean | null;
  entrega_publicada_em: string | null;
};

/**
 * Select the public media catalog after publishing, not the original proof.
 *
 * Publishing a selection intentionally clears galerias.prova, so that flag
 * alone cannot identify the final media location. Completed selected proofs
 * and galleries with recorded final media always use /entrega. Galleries
 * delivered directly, without a separate final set, still use /principal.
 *
 * Failure to verify the catalog must never silently expose proof originals.
 */
export async function variantePublicaDaGaleria(
  supabase: ReturnType<typeof createServiceClient>,
  galeria: GaleriaPublicavel
): Promise<VariantePublica> {
  if (galeria.etapa !== "entrega") return "principal";
  if (galeria.prova) return "entrega";

  // An un-published direct-delivery gallery still uses its normal originals.
  if (!galeria.entrega_publicada_em) return "principal";

  const { data: finais, error: catalogError } = await supabase
    .from("galeria_foto_metadata")
    .select("nome")
    .eq("galeria_id", galeria.id)
    .eq("variante", "entrega")
    .limit(1);

  if (catalogError) throw catalogError;
  if (finais?.length) return "entrega";

  // Older delivery records may lack metadata; completed selections are still
  // a reliable indication that this is a proof-to-delivery workflow.
  const { data: selecao, error: selectionError } = await supabase
    .from("selecoes")
    .select("finalizada")
    .eq("galeria", galeria.id)
    .maybeSingle();

  if (selectionError) throw selectionError;
  return selecao?.finalizada === true ? "entrega" : "principal";
}
