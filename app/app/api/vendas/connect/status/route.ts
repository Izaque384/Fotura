import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../../lib/supabase-server";
import { obterContaFotografo, recebimentosAtivos } from "../../../../../lib/stripe-connect";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest) {
  return req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [{ data: perfil }, { data: assinatura }] = await Promise.all([
    supabase.from("perfis").select("stripe_conta_id,stripe_recebimentos_ativo").eq("id", auth.user.id).maybeSingle(),
    supabase.from("assinaturas").select("plano_codigo,status").eq("user_id", auth.user.id).maybeSingle(),
  ]);

  const elegivel = Boolean(
    assinatura &&
    ["active","trialing","past_due"].includes(String(assinatura.status)) &&
    ["legacy","essencial","profissional","studio"].includes(String(assinatura.plano_codigo))
  );
  const accountId = (perfil?.stripe_conta_id as string | null) ?? null;
  if (!accountId) return NextResponse.json({ conectado:false, ativo:false, elegivel });

  try {
    const account = await obterContaFotografo(accountId);
    const ativo = recebimentosAtivos(account);
    await supabase.from("perfis").update({
      stripe_recebimentos_ativo: ativo,
      stripe_recebimentos_atualizado_em: new Date().toISOString(),
    }).eq("id", auth.user.id);
    return NextResponse.json({ conectado:true, ativo, elegivel, accountId });
  } catch {
    return NextResponse.json({
      conectado:true,
      ativo:Boolean(perfil?.stripe_recebimentos_ativo),
      elegivel,
      accountId,
    });
  }
}
