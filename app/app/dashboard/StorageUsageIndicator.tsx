"use client";

import { useEffect, useMemo, useState } from "react";
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
  }, [supabase]);

  if (!dados) return null;

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
        <span>{ilimitado ? dados.plano?.nome ?? "Legacy" : `/ ${limiteGb} GB`}</span>
      </div>
      <style>{`
        .storage-usage{width:184px;box-sizing:border-box;padding:7px 10px;border:1px solid rgba(74,81,126,.42);border-radius:11px;background:linear-gradient(180deg,rgba(20,20,43,.96),rgba(14,14,31,.96));font-family:var(--font-sora),Sora,sans-serif;color:#f0f0f5;flex:none}
        .storage-usage__head,.storage-usage__meta{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .storage-usage__head{font-size:9px;font-weight:650;line-height:1.2}.storage-usage__head span{color:#a4a9bf}.storage-usage__head strong{font-size:9px;color:#dfe3f5}
        .storage-usage__track{height:3px;margin:5px 0;overflow:hidden;border-radius:999px;background:#F3EFF9}.storage-usage__track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#1196fc,#5d0dfa);transition:width .35s ease}
        .storage-usage__meta{font-size:8px;line-height:1.2;color:#737a9b}.storage-usage__meta span:first-child{color:#b9bfd5}
        .storage-usage--alert{border-color:rgba(246,196,69,.35)}.storage-usage--alert .storage-usage__head strong{color:#f6c445}.storage-usage--alert .storage-usage__track span{background:linear-gradient(90deg,#f6c445,#ff9d6c)}
        @media(max-width:640px){.storage-usage{width:154px;padding:6px 8px}.storage-usage__head{font-size:8px}.storage-usage__meta{font-size:7.5px}}
      `}</style>
    </aside>
  );
}
