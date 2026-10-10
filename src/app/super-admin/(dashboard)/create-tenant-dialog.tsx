"use client";

import { useActionState, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { CopyLink } from "@/components/copy-link";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { createTenantByAdminAction, type CreateTenantResultState } from "./actions";

export function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CreateTenantResultState, FormData>(
    createTenantByAdminAction,
    initialActionState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <PlusIcon className="size-4" />
            Cadastrar Empresa
          </Button>
        }
      />

      <DialogContent className="sm:max-w-xl p-6 sm:p-7 gap-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-1">
          <DialogTitle className="text-lg">Cadastrar Nova Empresa</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Crie a empresa cliente manualmente e defina o status inicial da assinatura.
          </DialogDescription>
        </DialogHeader>

        {state.accessLink ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-200">
              <p className="font-semibold">{state.success}</p>
              <p className="text-xs mt-1">
                Copie o link abaixo e envie diretamente ao cliente (via WhatsApp ou e-mail) para ele
                definir a senha e acessar o sistema.
              </p>
            </div>

            <CopyLink link={state.accessLink} hint="Link direto para o primeiro acesso do cliente." />

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="grid gap-4 py-2">
            <FormAlert state={state} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nome da empresa"
                htmlFor="companyName"
                errors={state.fieldErrors?.companyName}
              >
                <Input id="companyName" name="companyName" required placeholder="Ex: Studio Alpha" />
              </Field>

              <Field label="CNPJ (opcional)" htmlFor="cnpj" errors={state.fieldErrors?.cnpj}>
                <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nome do responsável"
                htmlFor="ownerName"
                errors={state.fieldErrors?.ownerName}
              >
                <Input id="ownerName" name="ownerName" required placeholder="Nome do cliente" />
              </Field>

              <Field
                label="E-mail do responsável"
                htmlFor="ownerEmail"
                errors={state.fieldErrors?.ownerEmail}
              >
                <Input
                  id="ownerEmail"
                  name="ownerEmail"
                  type="email"
                  required
                  placeholder="cliente@empresa.com"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Status da assinatura"
                htmlFor="subscriptionStatus"
                errors={state.fieldErrors?.subscriptionStatus}
              >
                <NativeSelect
                  id="subscriptionStatus"
                  name="subscriptionStatus"
                  defaultValue="manual_active"
                >
                  <option value="manual_active">Ativa Manualmente (Liberada)</option>
                  <option value="trialing">Em Teste (14 dias grátis)</option>
                  <option value="suspended">Suspensa (Bloqueada)</option>
                </NativeSelect>
              </Field>

              <Field label="Plano" htmlFor="planTier" errors={state.fieldErrors?.planTier}>
                <NativeSelect id="planTier" name="planTier" defaultValue="pro">
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </NativeSelect>
              </Field>
            </div>

            <Field
              label="Vencimento da mensalidade (opcional)"
              htmlFor="currentPeriodEnd"
              hint="Se preenchido, o acesso vence nesta data."
              errors={state.fieldErrors?.currentPeriodEnd}
            >
              <Input id="currentPeriodEnd" name="currentPeriodEnd" type="date" />
            </Field>

            <Field
              label="Observações internas (opcional)"
              htmlFor="manualNotes"
              hint="Apenas você vê. Ex: Pix mensal R$ 350 - Vencimento dia 10."
              errors={state.fieldErrors?.manualNotes}
            >
              <Textarea
                id="manualNotes"
                name="manualNotes"
                rows={2}
                placeholder="Ex: Contrato fechado via WhatsApp. Pagamento Pix confirmado."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton>Criar Empresa</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
