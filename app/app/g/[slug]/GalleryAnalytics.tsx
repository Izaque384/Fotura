"use client";

import { useEffect } from "react";
import { registrarEventoProduto } from "../../../lib/product-analytics";

export default function GalleryAnalytics({ galeriaId }: { galeriaId: string }) {
  useEffect(() => {
    registrarEventoProduto("public_gallery_view", {
      rota: `/g/${galeriaId}`,
      entidade: "galeria",
      entidadeId: galeriaId,
    });
  }, [galeriaId]);

  return null;
}
