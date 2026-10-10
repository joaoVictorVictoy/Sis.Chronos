import { CheckCircle2Icon, CreditCardIcon, MessageCircleIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { DangerZoneCard } from "./danger-zone-card";

export const metadata = { title: "Assinatura e Plano | Apontamento" };

export default async function AssinaturaPage() {
  const { tenant, subscription, isSuperAdmin } = await requireRole(["admin"]);

  const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";
  const whatsappMsg = encodeURIComponent(
    `Olá! Sou administrador da empresa ${tenant.name} e gostaria de informações sobre a assinatura/renovação do plano.`
  );
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${whatsappMsg}`
    : null;

  const isManual = subscription.billingMode === "manual";

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Assinatura e Plano</h1>
        <p className="text-muted-foreground">
          Acompanhe o status do seu plano, período de vigência e formas de pagamento da sua empresa.
        </p>
      </header>

      {/* Card do Status Atual */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="size-5 text-primary" />
              Status da Assinatura
            </CardTitle>
            <CardDescription>Informações sobre o plano contratado e validade</CardDescription>
          </div>
          <Badge
            variant={subscription.isActive ? "default" : "destructive"}
            className="text-xs px-2.5 py-0.5 capitalize"
          >
            {subscription.statusLabel}
          </Badge>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-3 pt-2">
          <div className="rounded-lg border bg-muted/40 p-4">
            <span className="text-xs text-muted-foreground block mb-1">Plano Atual</span>
            <span className="text-lg font-bold capitalize">{tenant.plan_tier || "Plano Pro"}</span>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <span className="text-xs text-muted-foreground block mb-1">Modelo de Cobrança</span>
            <span className="text-lg font-semibold">
              {isManual ? "Faturado / Pix Direto" : "Automático (Stripe)"}
            </span>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <span className="text-xs text-muted-foreground block mb-1">
              {subscription.isTrial ? "Término do Teste" : "Vencimento / Renovação"}
            </span>
            <span className="text-lg font-semibold">
              {subscription.formattedExpiration || "Sem data limite"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card de Informações e Regularização */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações de Cobrança & Suporte</CardTitle>
          <CardDescription>
            {isManual
              ? "Sua empresa possui um contrato faturado diretamente com nosso time comercial."
              : "Gerenciamento de faturas e cartões."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isManual ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                As cobranças do seu plano são gerenciadas diretamente por nossa equipe via{" "}
                <strong>Pix ou boleto bancário</strong>. Caso deseje renovar antecipadamente, alterar
                a quantidade de colaboradores ou obter uma segunda via da fatura, entre em contato
                conosco.
              </p>

              {whatsappUrl && (
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 gap-2 transition-colors"
                  >
                    <MessageCircleIcon className="size-4" />
                    Falar com o Comercial via WhatsApp
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A cobrança da sua assinatura é processada de forma automática.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card de Recursos Inclusos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Recursos inclusos no seu plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2.5 sm:grid-cols-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Apontamento de horas diário e semanal com cronômetro</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Custo real hora-homem e margem de contribuição</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Painel executivo de rentabilidade por contrato</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Exportação completa de relatórios em Excel e PDF</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Isolamento seguro de dados (Row Level Security)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span>Controle de aprovação e fechamento de períodos</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Zona de Perigo / Exclusão e Cancelamento */}
      <DangerZoneCard
        tenantName={tenant.name}
        tenantId={tenant.id}
        isSuperAdmin={isSuperAdmin}
        supportWhatsappUrl={whatsappUrl}
      />
    </div>
  );
}
