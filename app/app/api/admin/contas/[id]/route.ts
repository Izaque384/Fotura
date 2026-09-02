import { NextRequest, NextResponse } from "next/server";
import { validarAdmin, registrarAdminAuditoria } from "../../../../../lib/admin-server";
import { contextoPlano } from "../../../../../lib/billing-usage";
import { registrarErro } from "../../../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const validacao = await validarAdmin(req, "admin.conta.auth");
  if ("error" in validacao) return validacao.error;
  const { supabase, adminUserId, papel } = validacao;
  const { id } = await params;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id);
    if (authError || !authData.user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

    const [perfilRes, assinaturaRes, suspensaoRes, takedownRes, galeriasRes, clientesRes, auditoriaRes, usoPlano] = await Promise.all([
      supabase.from("perfis").select("nome_estudio,logo_url,cor_hero,hero_galeria_ativo,hero_galeria_estilo,atualizado_em").eq("id", id).maybeSingle(),
      supabase.from("assinaturas").select("plano_codigo,status,provedor,provedor_cliente_id,provedor_assinatura_id,periodo_inicio,periodo_fim,cancelar_no_fim,criado_em,atualizado_em").eq("user_id", id).maybeSingle(),
      supabase.from("admin_suspensoes").select("ativa,motivo,suspenso_por,suspenso_em,reativado_por,reativado_em,atualizado_em").eq("user_id", id).maybeSingle(),
      supabase.from("admin_takedowns_publicos").select("ativo,motivo,criado_por,criado_em,atualizado_por,atualizado_em,removido_por,removido_em").eq("user_id", id).maybeSingle(),
      supabase.from("galerias").select("id,titulo,etapa,prova,criado_em,link_ate,storage_limpo").eq("user_id", id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("clientes").select("id,nome,email,telefone,criado_em").eq("user_id", id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("admin_auditoria").select("id,admin_user_id,admin_papel,acao,entidade,entidade_id,detalhes,criado_em").eq("alvo_user_id", id).order("criado_em", { ascending: false }).limit(50),
      contextoPlano(supabase, id),
    ]);

    if (perfilRes.error) throw perfilRes.error;
    if (assinaturaRes.error) throw assinaturaRes.error;
    if (suspensaoRes.error) throw suspensaoRes.error;
    if (takedownRes.error) throw takedownRes.error;
    if (galeriasRes.error) throw galeriasRes.error;
    if (clientesRes.error) throw clientesRes.error;
    if (auditoriaRes.error) throw auditoriaRes.error;

    await registrarAdminAuditoria({
      supabase,
      req,
      adminUserId,
      papel,
      acao: "conta.visualizar",
      alvoUserId: id,
      entidade: "conta",
      entidadeId: id,
      detalhes: { origem: "admin_detalhe" },
    });

    const user = authData.user;
    return NextResponse.json({
      conta: {
        id: user.id,
        email: user.email ?? "",
        criadoEm: user.created_at ?? null,
        confirmadoEm: user.email_confirmed_at ?? null,
        ultimoLoginEm: user.last_sign_in_at ?? null,
        telefone: user.phone ?? null,
        perfil: perfilRes.data ?? null,
        assinatura: assinaturaRes.data ?? null,
        suspensao: suspensaoRes.data ?? null,
        takedownPublico: takedownRes.data ?? null,
        uso: usoPlano.uso,
        limites: usoPlano.limites,
        planoEfetivo: usoPlano.plano,
        planoPersistido: usoPlano.planoPersistido,
        galerias: galeriasRes.data ?? [],
        clientes: clientesRes.data ?? [],
        auditoria: auditoriaRes.data ?? [],
      },
      papel,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.conta", req, error, { userId: adminUserId, alvoUserId: id });
    return NextResponse.json({ error: "Não foi possível carregar os detalhes da conta." }, { status: 500 });
  }
}
