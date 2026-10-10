"use client";

import { useState } from "react";
import { SlidersIcon } from "lucide-react";
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
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { useActionState } from "react";
import { initialActionState } from "@/lib/actions";
import { updatePlatformSettingsAction } from "./actions";
import type { PlatformSettings } from "./platform-settings";

export function PlatformSettingsDialog({
  initialSettings,
}: {
  initialSettings: PlatformSettings;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updatePlatformSettingsAction, initialActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersIcon className="size-4" />
            <span>Configurações SaaS</span>
          </Button>
        }
      />

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersIcon className="size-5 text-primary" />
            Configurações Globais da Plataforma
          </DialogTitle>
          <DialogDescription>
            Defina canais oficiais de suporte, prazos de avaliação e parâmetros gerais para todas as empresas.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await formAction(formData);
          }}
          className="space-y-4 pt-2"
        >
          <FormAlert state={state} />

          <Field
            label="WhatsApp Oficial de Suporte / Comercial"
            htmlFor="supportWhatsapp"
            hint="Número com DDI e DDD (ex: 5511999999999). Usado nos botões de contato e mensagens de suspensão."
          >
            <Input
              id="supportWhatsapp"
              name="supportWhatsapp"
              defaultValue={initialSettings.supportWhatsapp}
              placeholder="Ex: 5511999999999"
            />
          </Field>

          <Field
            label="E-mail Oficial de Suporte"
            htmlFor="supportEmail"
            hint="E-mail exibido para resolução de bloqueios e dúvidas."
          >
            <Input
              id="supportEmail"
              name="supportEmail"
              type="email"
              defaultValue={initialSettings.supportEmail}
              placeholder="Ex: suporte@suaempresa.com.br"
            />
          </Field>

          <Field
            label="Período Padrão de Teste Gratuito (Dias)"
            htmlFor="defaultTrialDays"
            hint="Duração inicial do trial para novas empresas que se cadastrarem."
          >
            <Input
              id="defaultTrialDays"
              name="defaultTrialDays"
              type="number"
              min="1"
              max="90"
              defaultValue={initialSettings.defaultTrialDays}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Permitir Cadastro Público</p>
              <p className="text-xs text-muted-foreground">
                Novos usuários podem criar novas empresas pelo site.
              </p>
            </div>
            <input
              type="checkbox"
              id="allowPublicSignup"
              name="allowPublicSignup"
              defaultChecked={initialSettings.allowPublicSignup}
              className="size-4 rounded border-input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton>Salvar Parâmetros</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
