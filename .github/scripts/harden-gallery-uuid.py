from pathlib import Path

changes = {
    "app/app/api/galeria/excluir/route.ts": [
        ('import { createServiceClient } from "../../../../lib/supabase-server";\n', 'import { createServiceClient } from "../../../../lib/supabase-server";\nimport { uuidValido } from "../../../../lib/validation";\n'),
        ('  if (!galeria || galeria.length > 100) {\n', '  if (!uuidValido(galeria)) {\n'),
    ],
    "app/app/api/fotos/signed/route.ts": [
        ('import { consumirRateLimit } from "../../../../lib/rate-limit";\n', 'import { consumirRateLimit } from "../../../../lib/rate-limit";\nimport { uuidValido } from "../../../../lib/validation";\n'),
        ('  if (!galeria) return json({ error: "galeria obrigatória." }, 400);\n', '  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);\n'),
    ],
    "app/app/api/galeria/publica/route.ts": [
        ('import { consumirRateLimit } from "../../../../lib/rate-limit";\n', 'import { consumirRateLimit } from "../../../../lib/rate-limit";\nimport { uuidValido } from "../../../../lib/validation";\n'),
        ('  if (!galeria) return json({ error: "galeria obrigatória." }, 400);\n', '  if (!uuidValido(galeria)) return json({ error: "galeria inválida." }, 400);\n'),
    ],
    "app/app/api/galeria/acesso/route.ts": [
        ('import { consumirRateLimit } from "../../../../lib/rate-limit";\n', 'import { consumirRateLimit } from "../../../../lib/rate-limit";\nimport { uuidValido } from "../../../../lib/validation";\n'),
        ('  if (!galeria || !senha || galeria.length > 100 || senha.length > 256) {\n', '  if (!uuidValido(galeria) || !senha || senha.length > 256) {\n'),
    ],
    "app/app/api/galeria/selecao/route.ts": [
        ('import { consumirRateLimit } from "../../../../lib/rate-limit";\n', 'import { consumirRateLimit } from "../../../../lib/rate-limit";\nimport { uuidValido } from "../../../../lib/validation";\n'),
        ('  if (!galeria || galeria.length > 100) return NextResponse.json({ error: "galeria inválida." }, { status: 400 });\n', '  if (!uuidValido(galeria)) return NextResponse.json({ error: "galeria inválida." }, { status: 400 });\n'),
    ],
}

for file, replacements in changes.items():
    p = Path(file)
    text = p.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"anchor not found in {file}: {old!r}")
        text = text.replace(old, new, 1)
    p.write_text(text)
