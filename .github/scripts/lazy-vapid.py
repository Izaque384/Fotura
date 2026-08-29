from pathlib import Path

p = Path('app/app/api/galeria/selecao/route.ts')
s = p.read_text()

old = '''webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:contato@fotura.com.br",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);
'''
new = '''let webPushConfigurado = false;
function configurarWebPush() {
  if (webPushConfigurado) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:contato@fotura.com.br",
    publicKey,
    privateKey
  );
  webPushConfigurado = true;
  return true;
}
'''
if old not in s:
    raise SystemExit('vapid setup anchor not found')
s = s.replace(old, new, 1)

old_notificar = 'async function notificar(supabase: ReturnType<typeof createServiceClient>, userId: string, titulo: string, qtd: number) {\n'
new_notificar = old_notificar + '  if (!configurarWebPush()) return;\n'
if old_notificar not in s:
    raise SystemExit('notificar anchor not found')
s = s.replace(old_notificar, new_notificar, 1)

p.write_text(s)
