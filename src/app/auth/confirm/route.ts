import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getOrigin } from "@/lib/server/origin";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Destino dos links de confirmação de e-mail e de redefinição de senha. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = await getOrigin();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");
  const errorCode = searchParams.get("error_code");

  // Se o provedor ou Supabase redirecionou com erro na query string (ex: otp_expired)
  if (errorParam || errorCode) {
    const msg =
      errorCode === "otp_expired"
        ? "O link expirou ou já foi usado. Solicite um novo link de recuperação."
        : errorParam?.replace(/\+/g, " ") ?? "O link do e-mail é inválido ou já expirou.";
    return NextResponse.redirect(new URL(`/login?erro=${encodeURIComponent(msg)}`, origin));
  }

  const nextParam = searchParams.get("next") ?? "/inicio";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  // Proteção contra leitura prévia do Outlook (Microsoft Defender / SafeLinks):
  // Leitores automáticos fazem requisições GET para escanear links de e-mail.
  // Se validarmos o token no primeiro GET, o robô consome o token de uso único antes
  // que o usuário clique. Exibindo uma tela de confirmação com botão (que submete POST),
  // garantimos que apenas o clique do usuário execute a validação.
  if ((tokenHash && type) || code) {
    const isRecovery = type === "recovery" || next.includes("redefinir-senha");
    const isInvite = type === "invite" || next.includes("convite");
    const title = isInvite ? "Bem-vindo ao Chronos" : isRecovery ? "Recuperação de Senha" : "Confirmar Acesso";
    const description = isInvite
      ? "Clique no botão abaixo para confirmar seu acesso e criar sua senha."
      : isRecovery
        ? "Clique no botão abaixo para prosseguir com a definição da sua nova senha."
        : "Clique no botão abaixo para confirmar seu acesso.";
    const buttonText = isInvite ? "Criar minha senha" : isRecovery ? "Redefinir minha senha" : "Confirmar e entrar";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Sis.Chronos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      color: #09090b;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      max-width: 24rem;
      width: 100%;
      padding: 2rem 1.75rem;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      background: #18181b;
      color: #fafafa;
      border-radius: 0.625rem;
      margin-bottom: 1.25rem;
      font-size: 1.35rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #09090b;
      margin-bottom: 0.5rem;
    }
    p {
      font-size: 0.875rem;
      color: #71717a;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: #18181b;
      color: #fafafa;
      border: none;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }
    .btn:hover {
      background: #27272a;
    }
    .footer {
      margin-top: 1.25rem;
      font-size: 0.75rem;
      color: #a1a1aa;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">⏱</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <form method="POST" action="/auth/confirm">
      ${tokenHash ? `<input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}">` : ""}
      ${type ? `<input type="hidden" name="type" value="${escapeHtml(type)}">` : ""}
      ${code ? `<input type="hidden" name="code" value="${escapeHtml(code)}">` : ""}
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <button type="submit" class="btn">${escapeHtml(buttonText)}</button>
    </form>
    <div class="footer">Sis.Chronos · Apontamento de Horas</div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Quando o Supabase redireciona com tokens na hash (#access_token=...),
  // o servidor não recebe esses dados no HTTP GET. Redirecionamos para
  // a página de destino (ex: /redefinir-senha) para que o cliente (AuthHashHandler)
  // processe os tokens na hash do navegador.
  const redirectUrl = new URL(next, origin);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const origin = await getOrigin();

  const tokenHash = formData.get("token_hash") as string | null;
  const type = formData.get("type") as EmailOtpType | null;
  const code = formData.get("code") as string | null;
  const nextParam = (formData.get("next") as string | null) ?? "/inicio";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return response;
    console.error("[auth/confirm POST] Falha ao verificar token:", {
      type,
      message: error.message,
      code: error.code,
      status: error.status,
    });
    return NextResponse.redirect(
      new URL(
        `/login?erro=${encodeURIComponent("O link expirou ou já foi usado. Solicite um novo link de recuperação.")}`,
        origin,
      ),
      { status: 303 },
    );
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    console.error("[auth/confirm POST] Falha ao trocar código por sessão:", {
      message: error.message,
      status: error.status,
    });
    return NextResponse.redirect(
      new URL(
        `/login?erro=${encodeURIComponent("O link expirou ou já foi usado. Solicite um novo link de recuperação.")}`,
        origin,
      ),
      { status: 303 },
    );
  }

  return NextResponse.redirect(new URL("/login?erro=link-invalido", origin), { status: 303 });
}


