"use client";

import { useActionState, useState } from "react";
import { MegaphoneIcon } from "lucide-react";
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
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { saveAnnouncementAction } from "./actions";

export type AnnouncementData = {
  id?: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
} | null;

export function BroadcastDialog({
  initialAnnouncement,
}: {
  initialAnnouncement: AnnouncementData;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveAnnouncementAction, initialActionState);

  const isActive = initialAnnouncement?.is_active ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2 shrink-0">
            <MegaphoneIcon className={`size-4 ${isActive ? "text-amber-500 fill-amber-500" : ""}`} />
            <span>Comunicado Global</span>
            {isActive && (
              <span className="flex size-2 rounded-full bg-emerald-500" title="Ativo no ar" />
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg p-6 sm:p-7 gap-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MegaphoneIcon className="size-5 text-primary" />
            Comunicado Global do Sistema
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Exiba um banner no topo da tela para todos os usuários do sistema (ex: manutenções,
            novidades ou avisos importantes).
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await formAction(formData);
          }}
          className="space-y-4 pt-2"
        >
          <FormAlert state={state} />

          <Field label="Título do Aviso" htmlFor="announcementTitle">
            <Input
              id="announcementTitle"
              name="title"
              defaultValue={initialAnnouncement?.title ?? "Aviso do Sistema"}
              placeholder="Ex: Manutenção Programada ou Novidade no Sis.Chronos"
            />
          </Field>

          <Field label="Mensagem" htmlFor="announcementMessage">
            <Textarea
              id="announcementMessage"
              name="message"
              defaultValue={initialAnnouncement?.message ?? ""}
              placeholder="Digite o texto que será exibido aos clientes..."
              rows={3}
            />
          </Field>

          <Field label="Estilo Visual do Banner" htmlFor="announcementType">
            <NativeSelect id="announcementType" name="type" defaultValue={initialAnnouncement?.type ?? "info"}>
              <option value="info">Informativo (Azul suave)</option>
              <option value="warning">Atenção / Manutenção (Âmbar / Laranja)</option>
              <option value="success">Novidade / Sucesso (Verde)</option>
            </NativeSelect>
          </Field>

          <div className="flex items-center gap-2 pt-1 pb-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              defaultChecked={initialAnnouncement?.is_active ?? false}
              className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isActive" className="text-xs font-medium cursor-pointer">
              Ativar e exibir este comunicado imediatamente na tela de todos os usuários
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Fechar
            </Button>
            <SubmitButton>Salvar Comunicado</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
