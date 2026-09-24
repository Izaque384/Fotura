"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";

type Analytics = {
  janelaDias: number;
  atualizadoEm: string;
  volumes: {
    landingViews: number;
    signupClicks: number;
    usuariosNoPainel: number;
    criadoresDeGaleria: number;
    contasComSelecaoFinalizada: number;
    contasPagasAtivas: number;
    checkoutsDePlano: number;
    compartilhamentos: number;
    visualizacoesGaleriaPublica: number;
    sessoesLanding: number;
    sessoesLandingQueChegaramAoPainel: number;
  };
  porEvento: Record<string, number>;
  fontes: Array<{ fonte: string; total: number }>;
  ultimos14Dias: Array<{ data: string; total: number }>;
};

const NOMES_EVENTOS: Record<string, string> = {
  landing_view: "Visitas à LP",
  landing_signup_clicked: "Cliques para criar conta",
  dashboard_view: "Aberturas do painel",
  sales_page_view: "Aberturas de Vendas",
  plan_page_view: "Aberturas de Plano",
  plan_checkout_started: "Checkouts de plano",
  upgrade_prompt_view: "Prompts de upgrade vistos",
  upgrade_prompt_clicked: "Prompts de upgrade clicados",
  gallery_shared: "Galerias compartilhadas",
  public_gallery_view: "Galerias públicas abertas",
  extra_sale_checkout_started: "Checkouts de fotos extras",
  extra_sale_payment_confirmed: "Compras extras confirmadas",
};

export default function ProdutoAnalyticsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [dados, setDados] = useState<Analytics | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }
      const resposta = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      if (!ativo) return;
      if (resposta.status === 403) { setErro("Esta conta não possui acesso administrativo."); return; }
      if (!resposta.ok) { setErro("Não foi possível carregar as métricas de produto."); return; }
      setDados(await resposta.json() as Analytics);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const maxDia = Math.max(1, ...(dados?.ultimos14Dias.map((d) => d.total) ?? [1]));
  const sessaoPct = dados?.volumes.sessoesLanding
    ? Math.round((dados.volumes.sessoesLandingQueChegaramAoPainel / dados.volumes.sessoesLanding) * 100)
    : 0;

  return (
    <main className="pa">
      <style>{`
        .pa{min-height:100vh;padding:50px 6vw 100px;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#21253A;font-family:Sora,sans-serif}.pa-wrap{max-width:1180px;margin:auto}
        .pa-ey{font-size:10px;letter-spacing:1.8px;color:#737cae;font-weight:800}.pa h1{margin:7px 0 5px;font-size:31px;letter-spacing:-.7px}.pa-sub{margin:0;color:#7a7f9a;font-size:12px;line-height:1.55}
        .pa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.pa-card,.pa-panel{border:1px solid #DCD6EE;border-radius:15px;background:linear-gradient(180deg,#FAF8FD,#F3EFF9)}.pa-card{padding:18px}.pa-card strong{display:block;font-size:27px}.pa-card span{display:block;margin-top:6px;color:#858ba4;font-size:10px;line-height:1.4}
        .pa-panels{display:grid;grid-template-columns:1.12fr .88fr;gap:14px}.pa-panel{padding:20px}.pa-panel h2{margin:0 0 4px;font-size:15px}.pa-note{margin:0 0 17px;color:#6f7690;font-size:9.5px;line-height:1.5}
        .pa-bars{height:170px;display:flex;align-items:flex-end;gap:7px;padding-top:20px}.pa-bar{height:100%;flex:1;display:flex;align-items:flex-end;justify-content:center;position:relative}.pa-bar i{display:block;width:62%;min-height:3px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#1196fc,#5d0dfa)}.pa-bar b{position:absolute;bottom:-20px;color:#626a88;font-size:7px;font-weight:650}
        .pa-rows{display:grid;gap:9px}.pa-row{display:flex;justify-content:space-between;gap:16px;padding-bottom:9px;border-bottom:1px solid #E3DEEB;color:#596079;font-size:10.5px}.pa-row:last-child{border-bottom:0}.pa-row span{min-width:0;overflow:hidden;text-overflow:ellipsis}.pa-row strong{color:#21253A}
        .pa-wide{margin-top:14px}.pa-events{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pa-event{padding:11px 12px;border:1px solid #DCD6EE;border-radius:11px;background:#FAF8FD}.pa-event strong{font-size:17px}.pa-event span{display:block;margin-top:4px;color:#777e99;font-size:9px}
        .pa-session{margin-top:14px;padding:13px 14px;border:1px solid rgba(126,162,255,.22);border-radius:11px;background:rgba(74,108,247,.07);color:#596079;font-size:10px;line-height:1.55}.pa-session b{color:#45406E}
        .pa-err{margin-top:22px;color:#B95C66}.pa-updated{margin-top:18px;color:#555d7b;font-size:8.5px}
        @media(max-width:950px){.pa-grid{grid-template-columns:1fr 1fr}.pa-panels{grid-template-columns:1fr}.pa-events{grid-template-columns:1fr 1fr}}@media(max-width:600px){.pa{padding:34px 14px 90px}.pa-grid{grid-template-columns:1fr 1fr}.pa-card{padding:14px}.pa-card strong{font-size:23px}.pa-events{grid-template-columns:1fr}.pa-bars{height:145px}}
      `}</style>
      <div className="pa-wrap">
        <div className="pa-ey">PRODUTO · ÚLTIMOS 30 DIAS</div>
        <h1>Métricas de produto</h1>
        <p className="pa-sub">Aquisição, uso e sinais de conversão do Fotura. Eventos são agregados sem expor esta tabela diretamente ao navegador.</p>

        {erro && <div className="pa-err">{erro}</div>}
        {dados && <>
          <section className="pa-grid">
            <div className="pa-card"><strong>{dados.volumes.landingViews}</strong><span>Visitas registradas na LP</span></div>
            <div className="pa-card"><strong>{dados.volumes.signupClicks}</strong><span>Cliques em criar conta</span></div>
            <div className="pa-card"><strong>{dados.volumes.usuariosNoPainel}</strong><span>Usuários únicos no painel</span></div>
            <div className="pa-card"><strong>{dados.volumes.contasPagasAtivas}</strong><span>Contas pagas atualmente ativas</span></div>
            <div className="pa-card"><strong>{dados.volumes.criadoresDeGaleria}</strong><span>Fotógrafos que criaram galeria</span></div>
            <div className="pa-card"><strong>{dados.volumes.contasComSelecaoFinalizada}</strong><span>Contas com seleção finalizada por cliente</span></div>
            <div className="pa-card"><strong>{dados.volumes.compartilhamentos}</strong><span>Compartilhamentos instrumentados</span></div>
            <div className="pa-card"><strong>{dados.volumes.visualizacoesGaleriaPublica}</strong><span>Aberturas de galerias públicas</span></div>
          </section>

          <section className="pa-panels">
            <div className="pa-panel">
              <h2>Atividade instrumentada</h2>
              <p className="pa-note">Eventos totais por dia nos últimos 14 dias.</p>
              <div className="pa-bars">
                {dados.ultimos14Dias.map((d) => <div className="pa-bar" key={d.data}><i style={{height:`${Math.max(3,(d.total/maxDia)*100)}%`}}/><b>{new Date(d.data+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</b></div>)}
              </div>
            </div>
            <div className="pa-panel">
              <h2>Origem das visitas</h2>
              <p className="pa-note">Baseado em utm_source; acessos sem marcação aparecem como direto.</p>
              <div className="pa-rows">
                {dados.fontes.length ? dados.fontes.map((f) => <div className="pa-row" key={f.fonte}><span>{f.fonte}</span><strong>{f.total}</strong></div>) : <div className="pa-note">Ainda não há visitas registradas.</div>}
              </div>
            </div>
          </section>

          <section className="pa-panel pa-wide">
            <h2>Eventos do produto</h2>
            <p className="pa-note">Volumes observados; não representam uma coorte fechada de conversão.</p>
            <div className="pa-events">
              {Object.entries(dados.porEvento).sort((a,b)=>b[1]-a[1]).map(([evento,total]) => <div className="pa-event" key={evento}><strong>{total}</strong><span>{NOMES_EVENTOS[evento] ?? evento}</span></div>)}
            </div>
            <div className="pa-session"><b>{sessaoPct}%</b> das sessões da LP registradas que chegaram ao painel fizeram isso na mesma sessão do navegador. Confirmações por e-mail ou retornos em outra sessão podem não entrar nessa medida.</div>
          </section>
          <div className="pa-updated">Atualizado em {new Date(dados.atualizadoEm).toLocaleString("pt-BR")}.</div>
        </>}
      </div>
    </main>
  );
}
