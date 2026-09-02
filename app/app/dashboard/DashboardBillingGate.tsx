"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

type BillingStatus = {
  plano?: { codigo?: string };
  status?: string;
};

const ROTAS_SEM_PLANO = ["/dashboard/assinatura", "/dashboard/onboarding"];

export default function DashboardBillingGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    let ativo = true;

    if (ROTAS_SEM_PLANO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
      setLiberado(true);
      return () => { ativo = false; };
    }

    setLiberado(false);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      try {
        const resposta = await fetch("/api/billing/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });

        if (!resposta.ok) {
          if (ativo) setLiberado(true);
          return;
        }

        const billing = await resposta.json() as BillingStatus;
        if (!ativo) return;

        if (billing.plano?.codigo === "sem_plano") {
          router.replace("/dashboard/onboarding");
          return;
        }

        setLiberado(true);
      } catch {
        // Falha de rede não deve derrubar o painel; os limites continuam protegidos no backend.
        if (ativo) setLiberado(true);
      }
    })();

    return () => { ativo = false; };
  }, [pathname, router, supabase]);

  if (!liberado) {
    return <div style={{ minHeight: "100vh", background: "#090917", display: "grid", placeItems: "center", color: "#7a7f9a", fontFamily: "Sora, sans-serif" }}>Verificando seu plano…</div>;
  }

  return children;
}
