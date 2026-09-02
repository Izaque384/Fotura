import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { registrarErro } from "../../../../lib/observability";

export const dynamic = "force-dynamic";

async function validarAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };

  const { data: admin, error: adminError } = await supabase.from("admin_usuarios").select("papel").eq("user_id", auth.user.id).maybeSingle();
  if (adminError) {
    registrarErro("admin.contas.auth", req, adminError, { userId: auth.user.id });
    return { error: NextResponse.json({ error: "Não foi possível validar o acesso administrativo." }, { status: 500 }) };
  }
  if (!admin) return { error: NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 403 }) };

  return { supabase, userId: auth.user.id, papel: String(admin.papel ?? "admin") };
}

export async function GET(req: NextRequest) {
  const validacao = await validarAdmin(req);
  if ("error" in validacao) return validacao.error;
  const { supabase, userId, papel } = validacao;

  try {
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (usersError) throw usersError;
    const users = usersData.users ?? [];
    const ids = users.map(u => u.id);

    const [perfisRes, assinaturasRes, suspensoesRes, takedownsRes, galeriasRes, clientesRes] = await Promise.all([
      ids.length ? supabase.from("perfis").select("id,nome_estudio").in("id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("assinaturas").select("user_id,plano_codigo,status,provedor,provedor_assinatura_id,periodo_fim,cancelar_no_fim").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("admin_suspensoes").select("user_id,ativa,motivo,suspenso_em").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("admin_takedowns_publicos").select("user_id,ativo,motivo,atualizado_em,criado_em").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("galerias").select("user_id").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("clientes").select("user_id").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);

    if (perfisRes.error) throw perfisRes.error;
    if (assinaturasRes.error) throw assinaturasRes.error;
    if (suspensoesRes.error) throw suspensoesRes.error;
    if (takedownsRes.error) throw takedownsRes.error;
    if (galeriasRes.error) throw galeriasRes.error;
    if (clientesRes.error) throw clientesRes.error;

    const perfis = new Map((perfisRes.data ?? []).map(p => [String(p.id), String(p.nome_estudio ?? "")]));
    const assinaturas = new Map((assinaturasRes.data ?? []).map(a => [String(a.user_id), a]));
    const suspensoes = new Map((suspensoesRes.data ?? []).map(s => [String(s.user_id), s]));
    const takedowns = new Map((takedownsRes.data ?? []).map(t => [String(t.user_id), t]));
    const galerias = new Map<string, number>();
    const clientes = new Map<string, number>();
    for (const g of galeriasRes.data ?? []) galerias.set(String(g.user_id), (galerias.get(String(g.user_id)) ?? 0) + 1);
    for (const c of clientesRes.data ?? []) clientes.set(String(c.user_id), (clientes.get(String(c.user_id)) ?? 0) + 1);

    const contas = users.map(u => {
      const a = assinaturas.get(u.id);
      const s = suspensoes.get(u.id);
      const t = takedowns.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        criadoEm: u.created_at ?? null,
        confirmadoEm: u.email_confirmed_at ?? null,
        ultimoLoginEm: u.last_sign_in_at ?? null,
        nomeEstudio: perfis.get(u.id) ?? "",
        plano: String(a?.plano_codigo ?? "sem_plano"),
        status: String(a?.status ?? "unknown"),
        provedor: a?.provedor ?? null,
        temAssinatura: Boolean(a?.provedor_assinatura_id),
        periodoFim: a?.periodo_fim ?? null,
        cancelarNoFim: Boolean(a?.cancelar_no_fim),
        suspensa: Boolean(s?.ativa),
        suspensaoMotivo: s?.ativa ? String(s.motivo ?? "") : null,
        suspensaEm: s?.ativa ? s.suspenso_em ?? null : null,
        takedownPublico: Boolean(t?.ativo),
        takedownMotivo: t?.ativo ? String(t.motivo ?? "") : null,
        takedownEm: t?.ativo ? (t.atualizado_em ?? t.criado_em ?? null) : null,
        galerias: galerias.get(u.id) ?? 0,
        clientes: clientes.get(u.id) ?? 0,
      };
    }).sort((a, b) => {
      const riscoA = Number(a.suspensa) * 2 + Number(a.takedownPublico);
      const riscoB = Number(b.suspensa) * 2 + Number(b.takedownPublico);
      if (riscoA !== riscoB) return riscoB - riscoA;
      return String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? ""));
    });

    return NextResponse.json({ papel, contas }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("admin.contas", req, error, { userId });
    return NextResponse.json({ error: "Não foi possível carregar as contas." }, { status: 500 });
  }
}
