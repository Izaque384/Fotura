"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import { registrarEventoProduto } from "../../lib/product-analytics";

type Acao = {
  id: string;
  titulo: string;
  descricao: string;
  botao: string;
  rota: string;
  tom: "purple" | "blue" | "amber" | "green";
};

type UsageResponse = {
  plano?: { codigo?: string; nome?: string };
  limites?: { armazenamento?: { usadoGb?: number; limiteGb?: number | null } };
};

type GaleriaResumo = {
  id: string;
  titulo: string;
  etapa: string;
  link_ate: string | null;
};

export default function DashboardActionCenter() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [plano, setPlano] = useState<string | null>(null);
  const [storagePercent, setStoragePercent] = useState<number | null>(null);
  const upgradeVisto = useRef(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth.session;
      if (!session) return;

      registrarEventoProduto("dashboard_view", {
        token: session.access_token,
        rota: "/dashboard",
      });

      const userId = session.user.id;
      try {
        const [{ data: galerias }, { data: vendas }, usageRes] = await Promise.all([
          supabase
            .from("galerias")
            .select("id,titulo,etapa,link_ate")
            .eq("user_id", userId),
          supabase
            .from("vendas_fotos")
            .select("id,status,criado_em")
            .eq("fotografo_id", userId)
            .eq("status", "pendente")
            .limit(50),
          fetch("/api/billing/usage", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
          }),
        ]);
        if (!ativo) return;

        const lista = (galerias ?? []) as GaleriaResumo[];
        const ids = lista.map((g) => g.id);
        let finalizadasPorSelecao = new Set<string>();
        if (ids.length) {
          const { data: selecoes } = await supabase
            .from("selecoes")
            .select("galeria,finalizada")
            .in("galeria", ids)
            .eq("finalizada", true);
          finalizadasPorSelecao = new Set((selecoes ?? []).map((s) => String(s.galeria)));
        }
        if (!ativo) return;

        const finalizadas = lista.filter(
          (g) =>
            g.etapa === "selecao_finalizada" ||
            (finalizadasPorSelecao.has(g.id) && !["preparando_entrega", "entrega"].includes(g.etapa)),
        );
        const preparando = lista.filter((g) => g.etapa === "preparando_entrega");
        const agora = Date.now();
        const limite = agora + 7 * 86_400_000;
        const expirando = lista.filter((g) => {
          if (!g.link_ate) return false;
          const expira = new Date(`${g.link_ate}T23:59:59`).getTime();
          return expira > agora && expira <= limite;
        });
        const pendentes = vendas?.length ?? 0;

        const proximas: Acao[] = [];
        if (finalizadas.length) {
          proximas.push({
            id: "selecoes-finalizadas",
            titulo: `${finalizadas.length} seleção${finalizadas.length === 1 ? "" : "ões"} pronta${finalizadas.length === 1 ? "" : "s"} para entrega`,
            descricao: "O cliente já terminou a escolha. Prepare e publique os arquivos finais.",
            botao: finalizadas.length === 1 ? "Preparar entrega" : "Ver seleções",
            rota: "/dashboard/selecoes?filtro=finalizada",
            tom: "purple",
          });
        }
        if (preparando.length) {
          proximas.push({
            id: "entregas",
            titulo: `${preparando.length} entrega${preparando.length === 1 ? "" : "s"} em preparação`,
            descricao: "Há galerias com a etapa final iniciada e ainda não publicada.",
            botao: "Continuar entrega",
            rota: "/dashboard/selecoes?filtro=preparando_entrega",
            tom: "blue",
          });
        }
        if (expirando.length) {
          proximas.push({
            id: "expirando",
            titulo: `${expirando.length} galeria${expirando.length === 1 ? "" : "s"} expira${expirando.length === 1 ? "" : "m"} em até 7 dias`,
            descricao: "Revise a validade dos links para evitar interrupções para seus clientes.",
            botao: "Revisar galerias",
            rota: "/dashboard/galerias",
            tom: "amber",
          });
        }
        if (pendentes) {
          proximas.push({
            id: "pagamentos",
            titulo: `${pendentes} pagamento${pendentes === 1 ? "" : "s"} aguardando confirmação`,
            descricao: "Acompanhe compras de fotos extras que ainda não foram concluídas.",
            botao: "Ver vendas",
            rota: "/dashboard/vendas?filtro=pendente",
            tom: "green",
          });
        }

        if (usageRes.ok) {
          const usage = await usageRes.json() as UsageResponse;
          const codigo = usage.plano?.codigo ?? null;
          const armazenamento = usage.limites?.armazenamento;
          const usado = Number(armazenamento?.usadoGb ?? 0);
          const maximo = armazenamento?.limiteGb ?? null;
          const percentual = maximo && maximo > 0
            ? Math.min(100, Math.round((usado / maximo) * 100))
            : null;
          setPlano(codigo);
          setStoragePercent(percentual);

          if (
            codigo === "gratis" &&
            percentual !== null &&
            percentual >= 50 &&
            !upgradeVisto.current
          ) {
            upgradeVisto.current = true;
            registrarEventoProduto("upgrade_prompt_view", {
              token: session.access_token,
              rota: "/dashboard",
              detalhes: {
                plano: "gratis",
                armazenamento_percentual: percentual,
                origem: "action_center",
              },
            });
          }
        }

        setAcoes(proximas.slice(0, 4));
      } catch {
        // O centro de ações é auxiliar; o restante do painel continua disponível.
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [supabase]);

  async function abrir(acao: Acao) {
    router.push(acao.rota);
  }

  async function upgrade() {
    const { data } = await supabase.auth.getSession();
    registrarEventoProduto("upgrade_prompt_clicked", {
      token: data.session?.access_token,
      rota: "/dashboard",
      detalhes: {
        plano: plano ?? "gratis",
        armazenamento_percentual: storagePercent ?? 0,
        origem: "action_center",
      },
    });
    router.push("/dashboard/assinatura");
  }

  const mostrarUpgrade = plano === "gratis" && storagePercent !== null && storagePercent >= 50;

  return (
    <section className="action-center" aria-label="Próximas ações">
      <div className="action-center-head">
        <div>
          <div className="action-center-eyebrow">PRÓXIMAS AÇÕES</div>
          <h2>O que merece sua atenção</h2>
        </div>
        {!carregando && <span>{acoes.length ? `${acoes.length} prioridade${acoes.length === 1 ? "" : "s"}` : "Tudo em dia"}</span>}
      </div>

      {carregando ? (
        <div className="action-center-loading">Organizando suas prioridades…</div>
      ) : (
        <>
          <div className="action-center-grid">
            {acoes.length === 0 ? (
              <div className="action-center-clear">
                <strong>Nenhuma pendência importante agora.</strong>
                <span>Suas galerias, seleções e vendas estão sem ações urgentes.</span>
              </div>
            ) : acoes.map((acao) => (
              <article className={`action-item ${acao.tom}`} key={acao.id}>
                <div className="action-item-copy">
                  <strong>{acao.titulo}</strong>
                  <p>{acao.descricao}</p>
                </div>
                <button type="button" onClick={() => void abrir(acao)}>{acao.botao} →</button>
              </article>
            ))}
          </div>

          {mostrarUpgrade && (
            <div className="upgrade-context">
              <div>
                <span>PLANO GRÁTIS</span>
                <strong>Seu armazenamento está em {storagePercent}%.</strong>
                <p>O Essencial amplia de 1 GB para 10 GB sem limitar galerias, clientes ou fotos por galeria.</p>
              </div>
              <button type="button" onClick={() => void upgrade()}>Ver planos</button>
            </div>
          )}
        </>
      )}

      <style>{`
        .action-center{margin:0 0 18px;padding:20px 22px;border:1px solid #DCD6EE;border-radius:16px;background:#FAF8FD;box-shadow:0 8px 24px rgba(65,52,111,.045)}
        .action-center-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}
        .action-center-eyebrow{font-size:9px;letter-spacing:1.45px;font-weight:800;color:#7062B5}
        .action-center h2{margin:5px 0 0;font-size:18px;letter-spacing:-.25px;color:#252A41}
        .action-center-head>span{font-size:10px;font-weight:700;color:#7A7D92}
        .action-center-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .action-item{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;border:1px solid #E0DBEA;border-radius:13px;background:#F7F4FB}
        .action-item.purple{border-left:3px solid #8069D8}.action-item.blue{border-left:3px solid #489EEA}.action-item.amber{border-left:3px solid #D4A43F}.action-item.green{border-left:3px solid #58A879}
        .action-item-copy{min-width:0}.action-item strong{display:block;color:#2A2F46;font-size:12px;line-height:1.35}.action-item p{margin:4px 0 0;color:#777A90;font-size:9.5px;line-height:1.45}
        .action-item button,.upgrade-context button{flex:none;border:1px solid #CEC6E1;border-radius:9px;background:#FEFDFE;color:#515772;padding:9px 10px;font:750 9.5px inherit;cursor:pointer;white-space:nowrap}
        .action-item button:hover,.upgrade-context button:hover{border-color:#AFA3D2;background:#F0EBF8}
        .action-center-clear{grid-column:1/-1;padding:17px;border:1px dashed #D8D1E7;border-radius:12px;text-align:center}.action-center-clear strong{display:block;color:#3A4058;font-size:12px}.action-center-clear span{display:block;margin-top:5px;color:#818399;font-size:10px}
        .action-center-loading{padding:22px;text-align:center;color:#818399;font-size:10px}
        .upgrade-context{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:11px;padding:14px 15px;border:1px solid #D5CBEA;border-radius:13px;background:linear-gradient(90deg,#F0ECFA,#EEF5FC)}
        .upgrade-context span{display:block;color:#6859B2;font-size:8px;font-weight:850;letter-spacing:1.2px}.upgrade-context strong{display:block;margin-top:4px;color:#292E45;font-size:12px}.upgrade-context p{margin:4px 0 0;color:#73778D;font-size:9.5px;line-height:1.45}
        .upgrade-context button{background:linear-gradient(90deg,#1196FC,#5D0DFA);border:0;color:#fff;padding:10px 13px}
        @media(max-width:850px){.action-center-grid{grid-template-columns:1fr}}
        @media(max-width:640px){.action-center{padding:14px;margin-bottom:14px;border-radius:13px}.action-center-head{align-items:flex-start}.action-center h2{font-size:16px!important}.action-center-head>span{font-size:9px}.action-item{align-items:flex-start;flex-direction:column;padding:13px}.action-item button{width:100%;min-height:42px}.action-item strong{font-size:11px}.action-item p{font-size:9.5px!important}.upgrade-context{align-items:flex-start;flex-direction:column}.upgrade-context button{width:100%;min-height:44px}}
      `}</style>
    </section>
  );
}
