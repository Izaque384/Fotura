import { NextRequest, NextResponse } from "next/server";
import { contextoPlano } from "../../../../lib/billing-usage";
import { registrarErro } from "../../../../lib/observability";
import { createServiceClient } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const [contexto, mensal] = await Promise.all([contextoPlano(supabase, auth.user.id),supabase.rpc("status_uso_justo_upload_backend",{p_user_id:auth.user.id})]);
    if(mensal.error) throw mensal.error;
    const mes = (mensal.data ?? {}) as {bytes_enviados?:number|string|null;limite_bytes?:number|string|null;reinicia_em?:string|null;bloqueado?:boolean};
    return NextResponse.json({
      plano: { codigo: contexto.plano.codigo, nome: contexto.plano.nome },
      status: contexto.status,
      uso: contexto.uso,
      limites: contexto.limites,
      usoMensalUpload: {bytesEnviados:Number(mes.bytes_enviados??0),limiteBytes:Number(mes.limite_bytes??0),reiniciaEm:mes.reinicia_em??null,bloqueado:Boolean(mes.bloqueado)},
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    registrarErro("billing.usage.lookup", req, error, { userId: auth.user.id });
    return NextResponse.json({ error: "Não foi possível calcular o uso da conta." }, { status: 500 });
  }
}
