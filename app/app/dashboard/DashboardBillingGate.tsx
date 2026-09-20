"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";

type Suspensao = { ativa?: boolean; motivo?: string | null };

const ROTAS_SEM_PLANO = ["/dashboard/assinatura", "/dashboard/onboarding"];

export default function DashboardBillingGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [suspensao, setSuspensao] = useState<Suspensao | null>(null);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          if (ativo) router.replace("/login");
          return;
        }

        const userId = auth.user.id;
        const [{ data: assinatura }, { data: suspensaoRow }] = await Promise.all([
          supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", userId).maybeSingle(),
          supabase.from("admin_suspensoes").select("ativa,motivo").eq("user_id", userId).maybeSingle(),
        ]);

        if (!ativo) return;

        if (suspensaoRow?.ativa) {
          setSuspensao({ ativa: true, motivo: (suspensaoRow.motivo as string | null) ?? null });
          return;
        }

        const rotaLiberadaSemPlano = ROTAS_SEM_PLANO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
        if (assinatura?.plano_codigo === "sem_plano" && !rotaLiberadaSemPlano) {
          router.replace("/dashboard/onboarding");
        }
      } catch {
        // Nunca bloquear a interface por falha de verificação.
        // Operações sensíveis continuam protegidas por RLS e pelas APIs.
      }
    })();

    return () => { ativo = false; };
  }, [pathname, router, supabase]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (suspensao?.ativa) {
    return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#090917,#0e0e20)", display: "grid", placeItems: "center", padding: 24, color: "#f0f0f5", fontFamily: "Sora, sans-serif" }}>
      <div style={{ width: "min(560px,100%)", background: "linear-gradient(180deg,#14142b,#101023)", border: "1px solid #2a2d40", borderRadius: 18, padding: 28, boxSizing: "border-box" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#f6c445", marginBottom: 10 }}>Acesso temporariamente suspenso</div>
        <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>Esta conta está suspensa.</h1>
        <p style={{ margin: 0, color: "#9ba1bb", fontSize: 13, lineHeight: 1.7 }}>O acesso ao painel e a novas operações foi bloqueado administrativamente. Entre em contato com o suporte do Fotura para revisar a situação.</p>
        {suspensao.motivo && <div style={{ marginTop: 18, padding: 14, border: "1px solid #2a2d40", borderRadius: 12, background: "#0d0d1d", color: "#c8cce0", fontSize: 12 }}><strong style={{ color: "#f0f0f5" }}>Motivo informado:</strong><br/>{suspensao.motivo}</div>}
        <button onClick={() => void sair()} style={{ marginTop: 20, border: "1px solid #303552", background: "#15172d", color: "#f0f0f5", borderRadius: 10, padding: "10px 14px", font: "600 12px Sora, sans-serif", cursor: "pointer" }}>Sair da conta</button>
      </div>
    </div>;
  }

  return children;
}
