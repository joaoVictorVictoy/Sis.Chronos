"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarOffIcon,
  CheckIcon,
  Loader2Icon,
  PalmtreeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  updateEmployeeLeaveAction,
  type LeaveType,
} from "./actions";

export type LeaveRecord = {
  id: string;
  start_date: string;
  end_date: string;
  type: string;
  notes?: string | null;
  employee_id?: string;
};

interface LeavesDialogProps {
  currentLeaves: LeaveRecord[];
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  triggerText?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerClassName?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPE_OPTIONS: { value: LeaveType; label: string; icon: string }[] = [
  { value: "ferias", label: "Férias", icon: "🏖️" },
  { value: "recesso", label: "Recesso", icon: "🎉" },
  { value: "falta", label: "Falta / Ausência", icon: "❌" },
  { value: "atestado", label: "Atestado médico", icon: "🏥" },
  { value: "folga", label: "Folga", icon: "☕" },
  { value: "outro", label: "Outro", icon: "📋" },
];

const TYPE_LABELS: Record<string, string> = {
  ferias: "Férias",
  recesso: "Recesso",
  falta: "Falta",
  atestado: "Atestado médico",
  folga: "Folga",
  outro: "Outro",
};

export function LeavesDialog({
  currentLeaves,
  targetEmployeeId,
  targetEmployeeName,
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

  // Modo de edição de período existente
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setType("ferias");
    setStartDate(initialStartDate ?? "");
    setEndDate(initialEndDate ?? initialStartDate ?? "");
    setNotes("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    setOpen(newOpen);
  };

  const handleStartEdit = (leave: LeaveRecord) => {
    setEditingId(leave.id);
    setType((leave.type as LeaveType) || "ferias");
    setStartDate(leave.start_date);
    setEndDate(leave.end_date);
    setNotes(leave.notes || "");
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (editingId) {
        // Atualização de período existente
        const res = await updateEmployeeLeaveAction({
          leaveId: editingId,
          startDate,
          endDate,
          type,
          notes,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Período atualizado com sucesso!");
          resetForm();
        }
      } else {
        // Criação de novo período
        const res = await createEmployeeLeaveAction({
          startDate,
          endDate,
          type,
          notes,
          targetEmployeeId,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(
            `${TYPE_LABELS[type] ?? "Período"} registrado com sucesso!`,
          );
          resetForm();
          setOpen(false);
        }
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
        toast.success("Período excluído com sucesso.");
        if (editingId === id) {
          resetForm();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover registro.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatPeriodDisplay = (start: string, end: string) => {
    try {
      const s = parseISO(start);
      const e = parseISO(end);
      if (start === end) {
        return format(s, "dd/MM/yyyy", { locale: ptBR });
      }
      return `${format(s, "dd/MM/yyyy", { locale: ptBR })} até ${format(e, "dd/MM/yyyy", { locale: ptBR })}`;
    } catch {
      return `${start} até ${end}`;
    }
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
            {editingId ? "Editar Férias / Recesso" : "Férias e Recesso"}
          </DialogTitle>
          <DialogDescription>
            {targetEmployeeName
              ? `Gerenciando ausências para ${targetEmployeeName}.`
              : "Informe períodos de férias, recessos ou folgas para não constarem como faltas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Seletor de Tipo em Botões/Pills (corrige o fundo branco nativo do Windows) */}
          <div className="space-y-1.5">
            <Label>Tipo de Ausência</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all cursor-pointer",
                    type === item.value
                      ? "border-orange-500 bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold shadow-xs ring-1 ring-orange-500/40"
                      : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="truncate w-full text-center">{item.label}</span>
                </button>
              ))}
            </div>
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
              placeholder="Ex.: Férias regulamentares, recesso coletivo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancelar Edição
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "font-medium text-white",
                editingId ? "flex-1 bg-blue-600 hover:bg-blue-700" : "w-full bg-orange-600 hover:bg-orange-700",
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingId ? (
                <>
                  <CheckIcon className="size-4 mr-1.5" />
                  Salvar Alterações
                </>
              ) : (
                <>
                  <PlusIcon className="size-4 mr-1.5" />
                  Salvar Férias / Recesso
                </>
              )}
            </Button>
          </div>
        </form>

        {currentLeaves.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Períodos Registrados ({currentLeaves.length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {currentLeaves.map((leave) => {
                const isSelectedForEdit = editingId === leave.id;
                return (
                  <div
                    key={leave.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
                      isSelectedForEdit
                        ? "border-blue-500 bg-blue-500/10 text-foreground ring-1 ring-blue-500/30"
                        : "border-border/60 bg-muted/30 text-foreground hover:bg-muted/50",
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="capitalize text-orange-600 dark:text-orange-400 font-semibold">
                          {TYPE_LABELS[leave.type] ?? leave.type}
                        </span>
                        <span>·</span>
                        <span>{formatPeriodDisplay(leave.start_date, leave.end_date)}</span>
                      </div>
                      {leave.notes && (
                        <p className="text-muted-foreground line-clamp-1">{leave.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isSubmitting || deletingId === leave.id}
                        onClick={() => handleStartEdit(leave)}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Editar período de férias"
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
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
                  </div>
                );
              })}
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
