import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ClockIcon,
  MailIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
  UserCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Assinatura Suspensa | Sis.Chronos" };

export default async function AssinaturaSuspensaPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  // Se a assinatura estiver ativa e não for suspensão, volta para o início
  if (ctx.subscription.isActive) {
    redirect("/inicio");
  }

  const { tenant, profile, subscription, isSuperAdmin } = ctx;
  const isCompanyAdmin = profile.role === "admin";
  const isSuspended = subscription.status === "suspended";
  const isTrialExpired = subscription.isTrial && !subscription.isActive;

  // Busca dados do administrador da empresa (caso o usuário seja colaborador/gestor)
  const supabase = await createClient();
  const { data: tenantAdmin } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("tenant_id", tenant.id)
    .eq("role", "admin")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Contato com o suporte/admin geral da plataforma
  const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "5511999999999";
  const whatsappMsg = encodeURIComponent(
    `Olá! Sou da empresa *${tenant.name}* e gostaria de resolver a liberação/renovação do nosso acesso ao Sis.Chronos.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${whatsappMsg}`;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4">
      {/* Botão de escape rápido caso seja o Super Admin testando */}
      {isSuperAdmin && (
        <div className="mb-4">
          <Link href="/super-admin">
            <Button variant="outline" size="sm" className="gap-2 text-xs bg-background shadow-xs">
              <ArrowLeftIcon className="size-3.5" />
              Voltar ao Painel do Super Admin
            </Button>
          </Link>
        </div>
      )}

      <Card className="w-full max-w-lg shadow-xl border-destructive/20 bg-card overflow-hidden">
        <div className="h-2 w-full bg-destructive" />

        <CardHeader className="text-center pb-3 pt-6">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-xs">
            {isSuspended ? (
              <ShieldAlertIcon className="size-7" />
            ) : isTrialExpired ? (
              <ClockIcon className="size-7" />
            ) : (
              <AlertTriangleIcon className="size-7" />
            )}
          </div>

          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {isSuspended
              ? "Plano Suspenso Temporariamente"
              : isTrialExpired
              ? "Período de Teste Finalizado"
              : "Assinatura Pendente de Regularização"}
          </CardTitle>

          <CardDescription className="text-sm font-medium text-foreground/80 mt-1">
            Empresa: <strong className="text-foreground">{tenant.name}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-6">
          {/* Mensagem Principal Solicitando Contato com o Administrador */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-relaxed text-foreground">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">
                  Acesso temporariamente bloqueado
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isCompanyAdmin
                    ? "O plano contratado da sua empresa está suspenso ou finalizado. Para reativar o acesso de todos os colaboradores e retomar os lançamentos, entre em contato com a administração da plataforma para resolução."
                    : "O plano da sua empresa precisa de regularização ou renovação. Por favor, entre em contato com o administrador da sua empresa para resolução e liberação do seu acesso."}
                </p>
              </div>
            </div>
          </div>

          {/* Dados do Administrador para Contato */}
          {!isCompanyAdmin ? (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administrador Responsável pela Empresa
              </p>
              {tenantAdmin ? (
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <UserCheckIcon className="size-4 text-primary" />
                    <span>{tenantAdmin.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MailIcon className="size-3.5" />
                    <a
                      href={`mailto:${tenantAdmin.email}?subject=Acesso suspenso no Sis.Chronos (${tenant.name})`}
                      className="hover:underline text-primary"
                    >
                      {tenantAdmin.email}
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Fale com a gerência ou com quem contratou o sistema na sua empresa para solicitar a reativação.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Como resolver e reativar a empresa
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você é o administrador cadastrado desta empresa. Fale diretamente com nossa equipe comercial/suporte via WhatsApp ou e-mail para renovar o plano, liberar via Pix ou prorrogar seu acesso.
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="space-y-2.5 pt-1">
            {isCompanyAdmin ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 gap-2 transition-colors shadow-sm"
              >
                <MessageCircleIcon className="size-4.5" />
                Falar com o Administrador via WhatsApp
              </a>
            ) : tenantAdmin ? (
              <a
                href={`mailto:${tenantAdmin.email}?subject=Acesso suspenso no Sis.Chronos (${tenant.name})&body=Olá ${tenantAdmin.full_name}, nosso acesso ao Sis.Chronos da empresa ${tenant.name} está suspenso por vencimento de plano. Poderia verificar para resolução?`}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 gap-2 transition-colors shadow-sm"
              >
                <MailIcon className="size-4" />
                Enviar E-mail para o Administrador ({tenantAdmin.full_name})
              </a>
            ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 gap-2 transition-colors shadow-sm"
              >
                <MessageCircleIcon className="size-4.5" />
                Falar com o Suporte Sis.Chronos via WhatsApp
              </a>
            )}

            <div className="pt-1 flex justify-center">
              <SignOutButton
                variant="ghost"
                className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
