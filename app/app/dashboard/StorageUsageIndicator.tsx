"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

type UsageResponse = {
  plano?: { codigo?: string; nome?: string };
  uso?: { armazenamentoBytes?: number; armazenamentoGb?: number };
  limites?: { armazenamento?: { usadoBytes?: number; usadoGb?: number; limiteGb?: number | null; excedido?: boolean } };
};

const GIB = 1024 * 1024 * 1024;

function formatarUso(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(0)} KB`;
  if (bytes < GIB) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / GIB).toFixed(bytes >= 10 * GIB ? 1 : 2)} GB`;
}

export default function StorageUsageIndicator() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [dados, setDados] = useState<UsageResponse | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const resposta = await fetch("/api/billing/usage", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!resposta.ok) return;
        const json = await resposta.json() as UsageResponse;
        if (ativo) setDados(json);
      } catch {}
    })();
    return () => { ativo = false; };
  }, [pathname, supabase]);

  if (!dados || pathname.startsWith("/dashboard/assinatura") || pathname.startsWith("/dashboard/onboarding")) return null;

  const armazenamento = dados.limites?.armazenamento;
  const usadoBytes = Number(armazenamento?.usadoBytes ?? dados.uso?.armazenamentoBytes ?? 0);
  const limiteGb = armazenamento?.limiteGb ?? null;
  const ilimitado = limiteGb === null;
  const limiteBytes = ilimitado ? 0 : limiteGb * GIB;
  const percentual = ilimitado ? 0 : Math.min(100, Math.max(0, Math.round((usadoBytes / Math.max(1, limiteBytes)) * 100)));
  const alerta = !ilimitado && percentual >= 85;

  return (
    <aside className={`storage-usage${alerta ? " storage-usage--alert" : ""}`} aria-label="Uso de armazenamento">
      <div className="storage-usage__head">
        <span>Armazenamento</span>
        <strong>{ilimitado ? "Ilimitado" : `${percentual}%`}</strong>
      </div>
      {!ilimitado && <div className="storage-usage__track" aria-hidden="true"><span style={{ width: `${percentual}%` }} /></div>}
      <div className="storage-usage__meta">
        <span>{formatarUso(usadoBytes)}</span>
        <span>{ilimitado ? dados.plano?.nome ?? "Legacy" : `de ${limiteGb} GB`}</span>
      </div>
      <style>{`
        .storage-usage{position:fixed;right:22px;bottom:22px;z-index:45;width:224px;padding:13px 14px;border:1px solid rgba(74,81,126,.42);border-radius:13px;background:linear-gradient(180deg,rgba(20,20,43,.97),rgba(14,14,31,.97));box-shadow:0 16px 42px rgba(0,0,0,.28);backdrop-filter:blur(12px);font-family:var(--font-sora),Sora,sans-serif;color:#f0f0f5}
        .storage-usage__head,.storage-usage__meta{display:flex;align-items:center;justify-content:space-between;gap:10px}.storage-usage__head{font-size:10px;font-weight:650}.storage-usage__head span{color:#a4a9bf}.storage-usage__head strong{font-size:10px;color:#dfe3f5}.storage-usage__track{height:5px;margin:9px 0 8px;overflow:hidden;border-radius:999px;background:#090916}.storage-usage__track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#1196fc,#5d0dfa);transition:width .35s ease}.storage-usage__meta{font-size:9px;color:#6f76a0}.storage-usage--alert{border-color:rgba(246,196,69,.35)}.storage-usage--alert .storage-usage__head strong{color:#f6c445}.storage-usage--alert .storage-usage__track span{background:linear-gradient(90deg,#f6c445,#ff9d6c)}
        @media(max-width:640px){.storage-usage{right:14px;bottom:14px;width:190px;padding:11px 12px}.storage-usage__head{font-size:9.5px}.storage-usage__meta{font-size:8.5px}}
      `}</style>
    </aside>
  );
}
