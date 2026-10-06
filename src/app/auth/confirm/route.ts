import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getOrigin } from "@/lib/server/origin";

/** Destino dos links de confirmação de e-mail e de redefinição de senha. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = await getOrigin();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");
  const errorCode = searchParams.get("error_code");

  // Se o provedor ou Supabase redirecionou com erro na query string
  if (errorParam || errorCode) {
    const msg =
      errorCode === "otp_expired"
        ? "O link expirou ou já foi usado. Solicite um novo link de recuperação."
        : errorParam?.replace(/\+/g, " ") ?? "O link do e-mail é inválido ou já expirou.";
    return NextResponse.redirect(new URL(`/login?erro=${encodeURIComponent(msg)}`, origin));
  }

  const nextParam = searchParams.get("next") ?? "/inicio";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inicio";

  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

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
    console.error("[auth/confirm] Falha ao verificar token:", {
      type,
      tokenHashPrefix: tokenHash.slice(0, 10),
      message: error.message,
      code: error.code,
      status: error.status,
    });
    return NextResponse.redirect(
      new URL(
        `/login?erro=${encodeURIComponent("O link expirou ou já foi usado. Solicite um novo link de recuperação.")}`,
        origin,
      ),
    );
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    console.error("[auth/confirm] Falha ao trocar código por sessão:", {
      codePrefix: code.slice(0, 10),
      message: error.message,
      status: error.status,
    });
    return NextResponse.redirect(
      new URL(
        `/login?erro=${encodeURIComponent("O link expirou ou já foi usado. Solicite um novo link de recuperação.")}`,
        origin,
      ),
    );
  } else {
    // Quando o Supabase redireciona com tokens na hash (#access_token=...),
    // o servidor não recebe esses dados no HTTP GET. Redirecionamos para
    // a página de destino (ex: /redefinir-senha) para que o cliente (AuthHashHandler)
    // processe os tokens na hash do navegador.
    return response;
  }
}


