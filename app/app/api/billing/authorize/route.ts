import { NextRequest, NextResponse } from "next/server";
import { contextoPlano, podeAdicionarFotos } from "../../../../lib/billing-usage";
import { registrarErro } from "../../../../lib/observability";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { createServiceClient } from "../../../../lib/supabase-server";
import { uuidValido } from "../../../../lib/validation";

export const dynamic = "force-dynamic";
const GIB = 1024 * 1024 * 1024;

type Acao = "criar_galeria" | "criar_cliente" | "upload";
type Body = {
  acao?: Acao;
  galeria?: string;
  quantidadeFotos?: number;
  bytesNovos?: number;
  criarCliente?: boolean;
};

function respostaLimite(codigo: string, mensagem: string, detalhes?: Record<string, unknown>) {
  return NextResponse.json({ autorizado: false, codigo, error: mensagem, ...detalhes }, {
    status: 409,
    headers: { "Cache-Control": "no-store, private" },
  });
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  if (!body.acao || !["criar_galeria", "criar_cliente", "upload"].includes(body.acao)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  try {
    const contexto = await contextoPlano(supabase, auth.user.id);
    if (contexto.plano.codigo === "legacy") {
      return NextResponse.json({ autorizado: true, plano: contexto.plano.codigo }, { headers: { "Cache-Control": "no-store, private" } });
    }

    if (body.acao === "criar_galeria") {
      if (contexto.limites.galeriasAtivas.excedido) {
        return respostaLimite("galerias_ativas", `Seu plano permite até ${contexto.limites.galeriasAtivas.limite} galerias ativas.`, { limite: contexto.limites.galeriasAtivas });
      }
      if (body.criarCliente && contexto.limites.clientes.excedido) {
        return respostaLimite("clientes", `Seu plano permite até ${contexto.limites.clientes.limite} clientes.`, { limite: contexto.limites.clientes });
      }
      return NextResponse.json({ autorizado: true, plano: contexto.plano.codigo }, { headers: { "Cache-Control": "no-store, private" } });
    }

    if (body.acao === "criar_cliente") {
      if (contexto.limites.clientes.excedido) {
        return respostaLimite("clientes", `Seu plano permite até ${contexto.limites.clientes.limite} clientes.`, { limite: contexto.limites.clientes });
      }
      return NextResponse.json({ autorizado: true, plano: contexto.plano.codigo }, { headers: { "Cache-Control": "no-store, private" } });
    }

    const galeria = body.galeria?.trim();
    const quantidadeFotos = Number(body.quantidadeFotos ?? 0);
    const bytesNovos = Number(body.bytesNovos ?? 0);
    if (!uuidValido(galeria) || !Number.isInteger(quantidadeFotos) || quantidadeFotos <= 0 || !Number.isFinite(bytesNovos) || bytesNovos <= 0) {
      return NextResponse.json({ error: "Dados de upload inválidos." }, { status: 400 });
    }

    const { data: g, error: galeriaError } = await supabase
      .from("galerias")
      .select("id")
      .eq("id", galeria)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (galeriaError) throw galeriaError;
    if (!g) return NextResponse.json({ error: "Galeria não encontrada." }, { status: 404 });

    const { data: galeriaUso, error: usoGaleriaError } = await supabase.rpc("billing_gallery_usage_backend", {
      p_user_id: auth.user.id,
      p_galeria_id: galeria,
    });
    if (usoGaleriaError) throw usoGaleriaError;
    const usoRow = Array.isArray(galeriaUso) ? galeriaUso[0] : galeriaUso;
    const fotosAtuais = Number(usoRow?.fotos ?? 0);

    if (!podeAdicionarFotos(contexto.plano, fotosAtuais, quantidadeFotos)) {
      return respostaLimite("fotos_por_galeria", `Seu plano permite até ${contexto.plano.limites.fotosPorGaleria} fotos por galeria.`, {
        fotosAtuais,
        quantidadeNova: quantidadeFotos,
        limite: contexto.plano.limites.fotosPorGaleria,
      });
    }

    const limiteGb = contexto.plano.limites.armazenamentoGb;
    if (limiteGb !== null && contexto.uso.armazenamentoBytes + bytesNovos > limiteGb * GIB) {
      return respostaLimite("armazenamento", `O lote ultrapassa o limite de ${limiteGb} GB do seu plano.`, {
        usadoBytes: contexto.uso.armazenamentoBytes,
        bytesNovos,
        limiteGb,
      });
    }

    return NextResponse.json({
      autorizado: true,
      plano: contexto.plano.codigo,
      fotosAtuais,
      armazenamentoBytes: contexto.uso.armazenamentoBytes,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("billing.authorize", req, error, { userId: auth.user.id, acao: body.acao });
    return NextResponse.json({ error: "Não foi possível validar os limites do plano." }, { status: 500 });
  }
}
