import { createClient as createSB } from "@supabase/supabase-js";

/** Cliente Supabase server-side com service_role — ignora RLS.
 *  Usar apenas em Route Handlers (app/api/...) que rodam no servidor. */
export function createServiceClient() {
  return createSB(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}