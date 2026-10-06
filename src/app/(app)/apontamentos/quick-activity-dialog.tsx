"use client";

import { useMemo, useState } from "react";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { Field, FormAlert } from "@/components/form";
import { initialActionState, type ActionState } from "@/lib/actions";
import { createActivityAction } from "@/app/(app)/cadastros/atividades/actions";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption } from "./page";

export function QuickActivityDialog({
  clients,
  areas,
  clientAreas,
  initialClientId = "",
  initialAreaId = "",
  onActivityCreated,
  disabled = false,
}: {
  clients: ClientOption[];
  areas: AreaOption[];
  clientAreas: ClientAreaOption[];
  initialClientId?: string;
  initialAreaId?: string;
  onActivityCreated: (activity: ActivityOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(initialClientId);
  const [areaId, setAreaId] = useState(initialAreaId);
  const [activityName, setActivityName] = useState("");
  const [billable, setBillable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<ActionState>(initialActionState);

  // Sincroniza os valores quando o modal é aberto
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setClientId(initialClientId);
      setAreaId(initialAreaId);
      setActivityName("");
      setBillable(true);
      setState(initialActionState);
    }
    setOpen(nextOpen);
  };

  // Áreas disponíveis para o cliente selecionado
  const availableAreas = useMemo(() => {
    if (!clientId) return areas;
    const directAreaIds = clientAreas.filter((ca) => ca.clientId === clientId).map((ca) => ca.areaId);
    if (directAreaIds.length > 0) {
      const filtered = areas.filter((a) => directAreaIds.includes(a.id));
      if (filtered.length > 0) return filtered;
    }
    return areas;
  }, [clientId, clientAreas, areas]);

  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    if (newClientId) {
      const directIds = clientAreas.filter((ca) => ca.clientId === newClientId).map((ca) => ca.areaId);
      if (directIds.length > 0) {
        const filtered = areas.filter((a) => directIds.includes(a.id));
        if (filtered.length > 0 && !filtered.some((a) => a.id === areaId)) {
          setAreaId(filtered[0].id);
          return;
        }
      }
    }
    if (!areaId && availableAreas[0]) {
      setAreaId(availableAreas[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setState(initialActionState);

    const formData = new FormData();
    formData.append("name", activityName.trim());
    formData.append("areaId", areaId);
    if (clientId) formData.append("clientId", clientId);
    if (billable) formData.append("billable", "on");

    try {
      const result = await createActivityAction(initialActionState, formData);
      if (result.createdActivity) {
        onActivityCreated({
          id: result.createdActivity.id,
          name: result.createdActivity.name,
          billable: result.createdActivity.billable,
          area_id: result.createdActivity.area_id,
          client_id: result.createdActivity.client_id,
        });
        setOpen(false);
      } else {
        setState(result);
      }
    } catch {
      setState({ error: "Ocorreu um erro ao cadastrar a atividade." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="inline-flex items-center gap-1 h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground leading-none cursor-pointer"
            title="Criar nova atividade"
          >
            <PlusIcon className="size-3" />
            Nova atividade
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nova atividade</DialogTitle>
            <DialogDescription>
              Cadastre uma nova atividade. Ela ficará imediatamente selecionada e disponível para apontamentos.
            </DialogDescription>
          </DialogHeader>

          {state.error ? <FormAlert state={state} /> : null}

          <div className="grid gap-3">
            <Field label="Cliente" htmlFor="quick-client">
              <NativeSelect
                id="quick-client"
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                disabled={submitting}
              >
                <option value="">Geral (sem cliente)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Área de atuação" htmlFor="quick-area">
              <NativeSelect
                id="quick-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="" disabled>
                  {availableAreas.length === 0 ? "Nenhuma área disponível" : "Selecione a área"}
                </option>
                {availableAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Nome da atividade" htmlFor="quick-name" errors={state.fieldErrors?.name}>
              <Input
                id="quick-name"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Ex.: Elaboração de relatório gerencial"
                required
                disabled={submitting}
                autoFocus
              >
              </Input>
            </Field>

            <label className="flex items-center gap-2 pt-1 text-sm">
              <NativeCheckbox
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                disabled={submitting}
              />
              Faturável
            </label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={submitting} />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={submitting || !activityName.trim() || !areaId}>
              {submitting ? <Loader2Icon className="mr-1 size-4 animate-spin" /> : null}
              Cadastrar atividade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
