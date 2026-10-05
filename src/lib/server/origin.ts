import "server-only";
import { headers } from "next/headers";

/** Endereço público da aplicação, para montar links de e-mail e de convite. */
export async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const host = rawHost.split(",")[0].trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? process.env.VERCEL_PROJECT_PRODUCTION_URL : "localhost:3000");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (host.startsWith("localhost") ? "http" : "https");
  return host.startsWith("http://") || host.startsWith("https://") ? host : `${proto}://${host}`;
}
