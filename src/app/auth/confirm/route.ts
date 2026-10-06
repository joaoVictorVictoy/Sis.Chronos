import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Destino dos links de confirmação de e-mail e de redefinição de senha. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
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
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    console.error("[auth/confirm] Falha ao trocar código por sessão:", {
      codePrefix: code.slice(0, 10),
      message: error.message,
      status: error.status,
    });
  } else {
    // Quando o Supabase redireciona com tokens na hash (#access_token=...),
    // o servidor não recebe esses dados no HTTP GET. Redirecionamos para
    // a página de destino (ex: /redefinir-senha) para que o cliente (AuthHashHandler)
    // processe os tokens na hash do navegador.
    return response;
  }

  return NextResponse.redirect(new URL("/login?erro=link-invalido", origin));
}

