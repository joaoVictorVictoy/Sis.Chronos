"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarOffIcon,
  Loader2Icon,
  PalmtreeIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import {
  createEmployeeLeaveAction,
  deleteEmployeeLeaveAction,
  type LeaveType,
} from "./actions";

export type LeaveRecord = {
  id: string;
  start_date: string;
  end_date: string;
  type: string;
  notes?: string | null;
};

interface LeavesDialogProps {
  currentLeaves: LeaveRecord[];
  triggerText?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerClassName?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPE_LABELS: Record<string, string> = {
  ferias: "Férias",
  recesso: "Recesso",
  folga: "Folga",
  outro: "Outro",
};

export function LeavesDialog({
  currentLeaves,
  triggerText = "Informar férias / recesso",
  triggerVariant = "outline",
  triggerClassName,
  initialStartDate,
  initialEndDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: LeavesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [type, setType] = useState<LeaveType>("ferias");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? initialStartDate ?? "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (initialStartDate) {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate ?? initialStartDate);
      }
    }
    setOpen(newOpen);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Preencha as datas de início e fim.");
      return;
    }
    if (startDate > endDate) {
      toast.error("A data de início deve ser anterior ou igual à data de término.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createEmployeeLeaveAction({
        startDate,
        endDate,
        type,
        notes,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          `${TYPE_LABELS[type] ?? "Período"} registrado com sucesso! Os dias não constarão como faltantes.`,
        );
        setNotes("");
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deleteEmployeeLeaveAction(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Registro removido com sucesso.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover registro.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatPeriodDisplay = (start: string, end: string) => {
    const s = parseISO(start);
    const e = parseISO(end);
    if (start === end) {
      return format(s, "dd/MM/yyyy", { locale: ptBR });
    }
    return `${format(s, "dd/MM/yyyy", { locale: ptBR })} até ${format(e, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={triggerVariant}
            size="sm"
            className={triggerClassName}
          >
            <PalmtreeIcon className="size-4 mr-1.5" />
            {triggerText}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PalmtreeIcon className="size-5 text-orange-500" />
            Férias e Recesso
          </DialogTitle>
          <DialogDescription>
            Informe períodos de férias, recessos ou folgas para não constarem como
            dias sem apontamento e não gerarem cobrança indevida de horas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="leave-type">Tipo de Ausência</Label>
            <select
              id="leave-type"
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ferias">🏖️ Férias</option>
              <option value="recesso">🎉 Recesso</option>
              <option value="folga">☕ Folga</option>
              <option value="outro">📋 Outro</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="leave-start">Data de Início</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-end">Data de Fim</Label>
              <Input
                id="leave-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-notes">Observação (opcional)</Label>
            <Input
              id="leave-notes"
              type="text"
              placeholder="Ex.: Férias coletivas, recesso de fim de ano..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <PlusIcon className="size-4 mr-1.5" />
                Salvar Férias / Recesso
              </>
            )}
          </Button>
        </form>

        {currentLeaves.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Períodos Registrados ({currentLeaves.length})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {currentLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="capitalize text-orange-600 dark:text-orange-400">
                        {TYPE_LABELS[leave.type] ?? leave.type}
                      </span>
                      <span>·</span>
                      <span>{formatPeriodDisplay(leave.start_date, leave.end_date)}</span>
                    </div>
                    {leave.notes && (
                      <p className="text-muted-foreground">{leave.notes}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={deletingId === leave.id}
                    onClick={() => handleDelete(leave.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Excluir período"
                  >
                    {deletingId === leave.id ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-end">
          <DialogClose
            render={
              <Button type="button" variant="outline" size="sm">
                Fechar
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
