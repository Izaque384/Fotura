import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ admin: false }, { status: 401 });

  const supabase = createServiceClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ admin: false }, { status: 401 });

  const { data: admin, error } = await supabase
    .from("admin_usuarios")
    .select("papel")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ admin: false }, { status: 500 });

  return NextResponse.json({ admin: Boolean(admin), papel: admin?.papel ?? null }, {
    headers: { "Cache-Control": "no-store, private" },
  });
}
