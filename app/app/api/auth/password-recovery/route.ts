import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { consumirRateLimit } from "../../../../lib/rate-limit";
import { requisicaoMesmoOrigin } from "../../../../lib/request-security";
import { registrarErro } from "../../../../lib/observability";
import { normalizeLocale } from "../../../../lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O Supabase emite e valida o token; o Resend entrega o e-mail.
// Não expor links, tokens ou a existência de uma conta nas respostas públicas.
const messages = {
  pt: {
    subject: "Recupere sua senha do Fotura",
    headline: "Redefina sua senha",
    description: "Recebemos uma solicitação de recuperação de acesso à sua conta Fotura.",
    button: "Criar uma nova senha",
    ignore: "Se você não fez essa solicitação, ignore esta mensagem. Sua senha atual permanecerá a mesma.",
    fallback: "Se o botão não funcionar, abra este link:",
  },
  en: {
    subject: "Reset your Fotura password",
    headline: "Reset your password",
    description: "We received a request to reset the password for your Fotura account.",
    button: "Set a new password",
    ignore: "If you did not request this change, ignore this email. Your current password will remain unchanged.",
    fallback: "If the button does not work, open this link:",
  },
  es: {
    subject: "Recupera tu contraseña de Fotura",
    headline: "Restablece tu contraseña",
    description: "Recibimos una solicitud para recuperar el acceso a tu cuenta de Fotura.",
    button: "Crear una nueva contraseña",
    ignore: "Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual seguirá siendo la misma.",
    fallback: "Si el botón no funciona, abre este enlace:",
  },
} as const;

function respostaAceita() {
  return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

function respostaIndisponivel() {
  return NextResponse.json({ error: "Serviço de recuperação temporariamente indisponível." }, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[character] || character;
  });
}

export async function POST(req: NextRequest) {
  if (!requisicaoMesmoOrigin(req)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = normalizeLocale(body.locale);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  // Falha de infraestrutura é uniforme para todas as contas (sem enumeração).
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    registrarErro("auth.recovery.configuration", req, new Error("Configuração de envio ou Auth ausente"));
    return respostaIndisponivel();
  }

  try {
    const supabase = createServiceClient();

    // Limites persistentes em Postgres, independentes da instância serverless.
    // Até 12 solicitações/hora por IP e 3 por endereço/hora, sem armazenar e-mails em texto.
    const allowedIp = await consumirRateLimit(req, "password_recovery_ip", "all", 3600, 12);
    const emailHash = createHash("sha256").update(email).digest("hex");
    const { data: allowedEmail, error: limitError } = await supabase.rpc("consume_api_rate_limit", {
      p_scope: "password_recovery_email",
      p_key_hash: emailHash,
      p_window_seconds: 3600,
      p_limit: 3,
    });
    if (limitError) {
      registrarErro("auth.recovery.rate_limit", req, new Error("Falha no controle de tentativas"));
      return respostaIndisponivel();
    }
    if (!allowedIp || allowedEmail !== true) {
      return NextResponse.json({ error: "Muitas solicitações. Aguarde antes de tentar novamente." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
      });
    }

    const origin = ["localhost", "127.0.0.1"].includes(req.nextUrl.hostname)
      ? req.nextUrl.origin
      : "https://foturax.com.br";
    const redirectTo = origin + "/" + locale + "/redefinir-senha?recovery=1";

    // Gera um link de uso único sem acionar o SMTP limitado do Supabase.
    // Para contas ainda não confirmadas, o link de acesso por e-mail
    // confirma a posse da caixa postal antes de permitir escolher a senha.
    const recovery = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    let linkData = recovery.data;
    let linkError = recovery.error;
    let verifyType: "recovery" | "magiclink" = "recovery";

    if ((linkData?.user && !linkData.user.email_confirmed_at) || linkError?.code === "email_not_confirmed") {
      const verification = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      linkData = verification.data;
      linkError = verification.error;
      verifyType = "magiclink";
    }

    if (linkError || !linkData?.properties?.action_link) {
      if (linkError && (linkError.status || 0) >= 500) {
        registrarErro("auth.recovery.generate", req, new Error("Serviço de geração de link indisponível"));
        return respostaIndisponivel();
      }
      // Usuários não cadastrados e outros resultados não devem ser distinguíveis.
      return respostaAceita();
    }

    const actionLink = linkData.properties.action_link;
    // Confirme que o token foi criado pelo projeto Auth do Fotura.
    // Não coloque o action_link do Supabase no e-mail: verificadores automáticos
    // podem abrir um GET em /auth/v1/verify e consumir o token antes do usuário.
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
    const actionUrl = new URL(actionLink);
    if (actionUrl.origin !== expectedOrigin || !actionUrl.pathname.endsWith("/auth/v1/verify")) {
      registrarErro("auth.recovery.link_validation", req, new Error("Link de recuperação fora da origem esperada"));
      return respostaIndisponivel();
    }
    const tokenHash = linkData.properties.hashed_token || actionUrl.searchParams.get("token");
    if (!tokenHash || !/^[A-Za-z0-9_-]{20,200}$/.test(tokenHash)) {
      registrarErro("auth.recovery.token_format", req, new Error("Token de verificação ausente ou inválido"));
      return respostaIndisponivel();
    }

    // A URL do Fotura não verifica nada por GET. O token fica no fragmento
    // (não é enviado ao servidor no carregamento) e só é consumido após
    // o usuário acionar o botão "Continuar" na página de redefinição.
    const confirmationLink = origin + "/" + locale +
      "/redefinir-senha#token_hash=" + encodeURIComponent(tokenHash) + "&type=" + verifyType;

    const copy = messages[locale];
    const safeLink = escapeHtml(confirmationLink);
    const html = '<!doctype html><html lang="' + locale + '"><body style="margin:0;padding:32px 16px;background:#f7f4ee;font-family:Arial,sans-serif;color:#25243b">' +
      '<div style="max-width:510px;margin:0 auto;padding:36px 30px;background:#fff;border:1px solid #e3dff0;border-radius:16px">' +
      '<div style="font-size:18px;font-weight:bold;letter-spacing:.15em;color:#292743">FOTURA</div>' +
      '<h1 style="font-size:28px;line-height:1.2;margin:34px 0 14px;color:#24243c">' + escapeHtml(copy.headline) + '</h1>' +
      '<p style="font-size:15px;line-height:1.7;color:#66637c">' + escapeHtml(copy.description) + '</p>' +
      '<a href="' + safeLink + '" style="display:inline-block;padding:15px 22px;margin:20px 0;background:#292743;border-radius:9px;text-decoration:none;color:#fff;font-weight:bold">' +
      escapeHtml(copy.button) + '</a>' +
      '<p style="font-size:12px;line-height:1.6;color:#737086">' + escapeHtml(copy.ignore) + '</p>' +
      '<p style="font-size:12px;line-height:1.6;color:#737086">' +
      escapeHtml(locale === "en" ? "Use the most recent email if you requested more than one link." :
        locale === "es" ? "Si solicitaste varios enlaces, utiliza el correo más reciente." :
        "Se você solicitou mais de um link, utilize o e-mail mais recente.") + '</p>' +
      '<p style="font-size:11px;line-height:1.6;color:#737086;overflow-wrap:anywhere">' + escapeHtml(copy.fallback) +
      ' <a href="' + safeLink + '" style="color:#5049a4">' + safeLink + '</a></p>' +
      '</div></body></html>';

    const sender = process.env.FOTURA_EMAIL_FROM?.trim() || "Fotura <galerias@foturax.com.br>";
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject: copy.subject,
        html,
        text: copy.description + "\n\n" + copy.button + ":\n" + confirmationLink + "\n\n" + copy.ignore,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!result.ok) {
      // Não colocar destinatário ou o link/token em logs.
      registrarErro("auth.recovery.delivery", req, new Error("Provedor de e-mail HTTP " + result.status));
      // Resposta idêntica à de conta inexistente, evitando enumeração.
      return respostaAceita();
    }
    return respostaAceita();
  } catch {
    registrarErro("auth.recovery.unexpected", req, new Error("Falha inesperada no fluxo de recuperação"));
    return respostaIndisponivel();
  }
}
