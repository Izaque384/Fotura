"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import FoturaLoadingScreen from "../components/FoturaLoadingScreen";

type BillingStatus = {
  plano?: { codigo?: string };
  status?: string;
  suspensao?: { ativa?: boolean; motivo?: string; suspensoEm?: string | null };
};

const ROTAS_SEM_PLANO = ["/dashboard/assinatura", "/dashboard/onboarding"];
const GATE_TIMEOUT_MS = 5000;

export default function DashboardBillingGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [consultando, setConsultando] = useState(true);
  const [falhaConsulta, setFalhaConsulta] = useState(false);

  useEffect(() => {
    let ativo = true;
    const watchdog = window.setTimeout(() => {
      if (!ativo) return;
      // As operações sensíveis continuam protegidas no backend.
      // O gate visual nunca deve bloquear o SaaS indefinidamente.
      setFalhaConsulta(true);
      setConsultando(false);
    }, GATE_TIMEOUT_MS);

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const session = data.session;
        if (!session) {
          if (ativo) {
            setFalhaConsulta(true);
            setConsultando(false);
          }
          router.replace("/login");
          return;
        }

        const controller = new AbortController();
        const requestTimeout = window.setTimeout(() => controller.abort(), 4000);

        try {
          const resposta = await fetch("/api/billing/status", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
            signal: controller.signal,
          });

          if (!resposta.ok) {
            if (ativo) setFalhaConsulta(true);
            return;
          }

          const resultado = await resposta.json() as BillingStatus;
          if (ativo) setBilling(resultado);
        } finally {
          window.clearTimeout(requestTimeout);
        }
      } catch {
        if (ativo) setFalhaConsulta(true);
      } finally {
        window.clearTimeout(watchdog);
        if (ativo) setConsultando(false);
      }
    })();

    return () => {
      ativo = false;
      window.clearTimeout(watchdog);
    };
  }, [router, supabase]);

  const rotaLiberadaSemPlano = ROTAS_SEM_PLANO.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
  const precisaOnboarding = billing?.plano?.codigo === "sem_plano" && !rotaLiberadaSemPlano;

  useEffect(() => {
    if (precisaOnboarding) router.replace("/dashboard/onboarding");
  }, [precisaOnboarding, router]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (billing?.suspensao?.ativa) {
    return <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#090917,#0e0e20)", display: "grid", placeItems: "center", padding: 24, color: "#f0f0f5", fontFamily: "Sora, sans-serif" }}>
      <div style={{ width: "min(560px,100%)", background: "linear-gradient(180deg,#14142b,#101023)", border: "1px solid #2a2d40", borderRadius: 18, padding: 28, boxSizing: "border-box" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#f6c445", marginBottom: 10 }}>Acesso temporariamente suspenso</div>
        <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>Esta conta está suspensa.</h1>
        <p style={{ margin: 0, color: "#9ba1bb", fontSize: 13, lineHeight: 1.7 }}>O acesso ao painel e a novas operações foi bloqueado administrativamente. Entre em contato com o suporte do Fotura para revisar a situação.</p>
        {billing.suspensao.motivo && <div style={{ marginTop: 18, padding: 14, border: "1px solid #2a2d40", borderRadius: 12, background: "#0d0d1d", color: "#c8cce0", fontSize: 12 }}><strong style={{ color: "#f0f0f5" }}>Motivo informado:</strong><br/>{billing.suspensao.motivo}</div>}
        <button onClick={() => void sair()} style={{ marginTop: 20, border: "1px solid #303552", background: "#15172d", color: "#f0f0f5", borderRadius: 10, padding: "10px 14px", font: "600 12px Sora, sans-serif", cursor: "pointer" }}>Sair da conta</button>
      </div>
    </div>;
  }

  if (consultando || precisaOnboarding) return <FoturaLoadingScreen />;

  // Em falha de rede/sessão, não bloqueamos o painel para sempre.
  // RLS e APIs continuam sendo a camada de autorização real.
  if (falhaConsulta) return children;
  return children;
}
