import "server-only";
import { createServiceClient } from "./supabase-server";

type UsuarioAuthBasico = {
  id: string;
  email?: string | null;
};

export async function listarUsuariosAuthBasicos(supabase: ReturnType<typeof createServiceClient>) {
  const perPage = 100;
  const users: UsuarioAuthBasico[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const lote = data.users ?? [];
    users.push(...lote.map(user => ({ id: user.id, email: user.email ?? null })));

    if (lote.length < perPage) break;
    if (page >= 1000) throw new Error("Paginação de usuários excedeu o limite de segurança");
  }

  return users;
}
