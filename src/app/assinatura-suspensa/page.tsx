import { redirect } from "next/navigation";
import { AlertTriangleIcon, MessageCircleIcon, ShieldAlertIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { getAppContext } from "@/lib/auth/session";

export const metadata = { title: "Assinatura Suspensa | Apontamento" };

export default async function AssinaturaSuspensaPage() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");

  // Se a assinatura estiver ativa ou o usuário for super admin, pode voltar pro app
  if (ctx.isSuperAdmin || ctx.subscription.isActive) {
    redirect("/inicio");
  }

  const { tenant, profile, subscription } = ctx;
  const isCompanyAdmin = profile.role === "admin";
  const isTrialExpired = subscription.isTrial && !subscription.isActive;

  const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";
  const whatsappMsg = encodeURIComponent(
    `Olá! Gostaria de falar sobre a assinatura da empresa ${tenant.name} no sistema Apontamento.`
  );
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${whatsappMsg}`
    : null;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg shadow-lg border-destructive/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {isTrialExpired ? (
              <AlertTriangleIcon className="size-6" />
            ) : (
              <ShieldAlertIcon className="size-6" />
            )}
          </div>
          <CardTitle className="text-xl">
            {isTrialExpired ? "Período de teste expirado" : "Acesso da empresa suspenso"}
          </CardTitle>
          <CardDescription className="text-base text-foreground font-medium mt-1">
            {tenant.name}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
            {isTrialExpired ? (
              <p>
                Os 14 dias de teste gratuito da sua empresa chegaram ao fim. Para continuar
                aproveitando o controle de horas, custos reais e rentabilidade de contratos, é
                necessário ativar sua assinatura.
              </p>
            ) : (
              <p>
                O acesso desta empresa ao sistema está temporariamente suspenso. Se você já efetuou o
                pagamento ou precisa de auxílio comercial, entre em contato para reativar o acesso da
                sua equipe.
              </p>
            )}
          </div>

          {isCompanyAdmin ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold block mb-0.5">Aviso para o Administrador:</span>
              Você é o administrador desta conta. Fale conosco para regularizar o plano ou liberar o
              acesso via Pix/Contrato.
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Você faz parte da equipe de <strong>{tenant.name}</strong>. Por favor, comunique o
              administrador da sua empresa para regularizar o acesso.
            </p>
          )}

          <div className="grid gap-2 pt-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 gap-2 transition-colors"
              >
                <MessageCircleIcon className="size-4" />
                Falar no WhatsApp
              </a>
            )}

            <SignOutButton variant="outline" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
