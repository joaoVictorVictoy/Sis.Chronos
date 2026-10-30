"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDaysIcon,
  CheckIcon,
  Loader2Icon,
  PalmtreeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { businessDaysBetween } from "@/lib/time";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "../minhas-analises/actions";
import type { LeaveRecord } from "../minhas-analises/leaves-dialog";

interface EmployeeLeavesManagerProps {
  /** Lista de colaboradores disponíveis para o gestor selecionar */
  employees: { id: string; full_name: string; active?: boolean }[];
  /** Todos os registros de férias da empresa */
  leaves: LeaveRecord[];
  /** Colaborador pré-selecionado (ex: na página /colaboradores/[id]) */
  defaultEmployeeId?: string;
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

export function EmployeeLeavesManager({
  employees,
  leaves,
  defaultEmployeeId,
}: EmployeeLeavesManagerProps) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    defaultEmployeeId || "all",
  );
  const [formEmployeeId, setFormEmployeeId] = useState<string>(
    defaultEmployeeId || (employees[0]?.id || "all"),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);

  const [type, setType] = useState<LeaveType>("ferias");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const employeesMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active !== false),
    [employees],
  );

  const activeEmployeeIds = useMemo(
    () => new Set(activeEmployees.map((e) => e.id)),
    [activeEmployees],
  );

  const selectedEmployee = useMemo(
    () => (selectedEmpId === "all" ? null : employeesMap.get(selectedEmpId)),
    [employeesMap, selectedEmpId],
  );

  // Filtra as férias do colaborador selecionado ou mostra todas dos colaboradores ativos
  const employeeLeaves = useMemo(
    () => {
      const filtered =
        selectedEmpId === "all"
          ? leaves.filter((l) => !l.employee_id || activeEmployeeIds.has(l.employee_id))
          : leaves.filter((l) => l.employee_id === selectedEmpId);
      return [...filtered].sort((a, b) => b.start_date.localeCompare(a.start_date));
    },
    [leaves, selectedEmpId, activeEmployeeIds],
  );

  const resetForm = () => {
    setEditingLeave(null);
    setType("ferias");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setFormEmployeeId(selectedEmpId === "all" ? (employees[0]?.id || "") : selectedEmpId);
  };

  const handleOpenNew = () => {
    resetForm();
    setFormEmployeeId(selectedEmpId === "all" ? "all" : selectedEmpId);
    setDialogOpen(true);
  };

  const handleOpenEdit = (leave: LeaveRecord) => {
    setEditingLeave(leave);
    setFormEmployeeId(leave.employee_id || "");
    setType((leave.type as LeaveType) || "ferias");
    setStartDate(leave.start_date);
    setEndDate(leave.end_date);
    setNotes(leave.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) {
      toast.error("Selecione um colaborador.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Preencha as datas de início e término.");
      return;
    }
    if (startDate > endDate) {
      toast.error("A data de início deve ser anterior ou igual à data de término.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingLeave) {
        const res = await updateEmployeeLeaveAction({
          leaveId: editingLeave.id,
          startDate,
          endDate,
          type,
          notes,
        });

        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Período atualizado com sucesso!");
          setDialogOpen(false);
          resetForm();
        }
      } else {
        if (formEmployeeId === "all") {
          const activeEmployees = employees.filter((e) => e.active !== false);
          const targetEmployeeIds = (activeEmployees.length > 0 ? activeEmployees : employees).map((e) => e.id);

          if (targetEmployeeIds.length === 0) {
            toast.error("Nenhum colaborador encontrado para registrar.");
            return;
          }

          const res = await createEmployeeLeaveAction({
            startDate,
            endDate,
            type,
            notes,
            targetEmployeeIds,
          });

          if (res.error) {
            toast.error(res.error);
          } else {
            toast.success(
              `${TYPE_LABELS[type]} registrado para toda a equipe (${targetEmployeeIds.length} colaboradores)!`,
            );
            setDialogOpen(false);
            resetForm();
          }
        } else {
          const res = await createEmployeeLeaveAction({
            startDate,
            endDate,
            type,
            notes,
            targetEmployeeId: formEmployeeId,
          });

          if (res.error) {
            toast.error(res.error);
          } else {
            const empName = employeesMap.get(formEmployeeId)?.full_name || "o colaborador";
            toast.success(
              `${TYPE_LABELS[type]} registrado para ${empName}!`,
            );
            setDialogOpen(false);
            resetForm();
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar período.");
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
        if (editingLeave?.id === id) {
          setDialogOpen(false);
          resetForm();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir período.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatPeriodDisplay = (start: string, end: string) => {
    try {
      const s = parseISO(start);
      const e = parseISO(end);
      const bDays = businessDaysBetween(start, end);
      const daysText = `${bDays} ${bDays === 1 ? "dia útil" : "dias úteis"}`;
      if (start === end) {
        return `${format(s, "dd/MM/yyyy", { locale: ptBR })} (${daysText})`;
      }
      return `${format(s, "dd/MM/yyyy", { locale: ptBR })} até ${format(e, "dd/MM/yyyy", { locale: ptBR })} (${daysText})`;
    } catch {
      return `${start} até ${end}`;
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PalmtreeIcon className="size-5 text-orange-500" />
            Férias e Recessos da Equipe
          </CardTitle>
          <CardDescription>
            Cadastre, altere ou exclua períodos de férias e recessos dos colaboradores.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Colaborador (quando há mais de um ativo) */}
          {activeEmployees.length > 1 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="select-emp" className="sr-only">
                Colaborador
              </Label>
              <select
                id="select-emp"
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background text-foreground px-2.5 py-1 text-xs font-medium shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                style={{ colorScheme: "dark light" }}
              >
                <option value="all">Todos os colaboradores</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            type="button"
            onClick={handleOpenNew}
            className="h-8 px-3 text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-xs"
          >
            <PlusIcon className="size-3.5 mr-1.5" />
            Adicionar Férias / Recesso
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {employeeLeaves.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            <PalmtreeIcon className="size-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-medium text-foreground">
              {selectedEmpId === "all" ? (
                "Nenhum período de férias ou recesso registrado para a equipe."
              ) : (
                <>
                  Nenhum período de férias ou recesso registrado para{" "}
                  <strong>{selectedEmployee?.full_name || "este colaborador"}</strong>.
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em &quot;Adicionar Férias / Recesso&quot; acima para registrar ausências.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
              <span>
                {selectedEmpId === "all" ? (
                  <>
                    Mostrando {employeeLeaves.length}{" "}
                    {employeeLeaves.length === 1 ? "período registrado" : "períodos registrados"} de{" "}
                    <strong className="text-foreground">toda a equipe</strong>
                  </>
                ) : (
                  <>
                    Mostrando {employeeLeaves.length}{" "}
                    {employeeLeaves.length === 1 ? "período registrado" : "períodos registrados"} para{" "}
                    <strong className="text-foreground">{selectedEmployee?.full_name}</strong>
                  </>
                )}
              </span>
            </div>

            <div className="divide-y divide-border/50 rounded-lg border border-border/60 overflow-hidden">
              {employeeLeaves.map((leave) => {
                const isDeleting = deletingId === leave.id;
                const emp = employeesMap.get(leave.employee_id || "");
                return (
                  <div
                    key={leave.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 text-sm bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedEmpId === "all" && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground border border-border/40">
                            <UsersIcon className="size-3 text-muted-foreground" />
                            {emp?.full_name || "Colaborador"}
                            {emp?.active === false && (
                              <span className="text-[10px] text-muted-foreground font-normal">(Inativo)</span>
                            )}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                          {leave.type === "ferias" && "🏖️"}
                          {leave.type === "recesso" && "🎉"}
                          {leave.type === "folga" && "☕"}
                          {leave.type === "falta" && "❌"}
                          {leave.type === "atestado" && "🏥"}
                          {leave.type === "outro" && "📋"}
                          {TYPE_LABELS[leave.type] ?? leave.type}
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatPeriodDisplay(leave.start_date, leave.end_date)}
                        </span>
                      </div>
                      {leave.notes && (
                        <p className="text-xs text-muted-foreground pl-0.5">
                          Observação: {leave.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(leave)}
                        disabled={isDeleting}
                        className="h-8 gap-1 text-xs"
                      >
                        <PencilIcon className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(leave.id)}
                        disabled={isDeleting}
                        className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {isDeleting ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                        Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialog para Adicionar ou Editar Férias */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PalmtreeIcon className="size-5 text-orange-500" />
              {editingLeave ? "Alterar Férias / Recesso" : "Registrar Férias / Recesso"}
            </DialogTitle>
            <DialogDescription>
              {editingLeave ? (
                <>
                  Colaborador:{" "}
                  <strong>{employeesMap.get(editingLeave.employee_id || "")?.full_name || "Colaborador"}</strong>
                </>
              ) : formEmployeeId === "all" ? (
                "O período será aplicado para todos os colaboradores ativos da equipe."
              ) : (
                `Colaborador: ${employeesMap.get(formEmployeeId)?.full_name || "Selecione o colaborador"}`
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Seletor de Colaborador no Dialog (quando não estiver editando e houver mais de um ativo) */}
            {!editingLeave && activeEmployees.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="dialog-emp-select">Colaborador</Label>
                <select
                  id="dialog-emp-select"
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-xs font-medium shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  style={{ colorScheme: "dark light" }}
                >
                  <option value="all">🌟 Toda a equipe (todos os colaboradores ativos)</option>
                  <optgroup label="Colaborador individual">
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
            {/* Seletor de Tipo em Botões/Pills (sem problemas de fundo branco) */}
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
                <Label htmlFor="manager-leave-start">Data de Início</Label>
                <Input
                  id="manager-leave-start"
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
                <Label htmlFor="manager-leave-end">Data de Fim</Label>
                <Input
                  id="manager-leave-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-leave-notes">Observação (opcional)</Label>
              <Input
                id="manager-leave-notes"
                type="text"
                placeholder="Ex.: Férias regulamentares de 15 dias..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <DialogClose
                render={
                  <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                    Cancelar
                  </Button>
                }
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className={cn(
                  "font-medium text-white",
                  editingLeave ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700",
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : editingLeave ? (
                  <>
                    <CheckIcon className="size-4 mr-1.5" />
                    Salvar Alterações
                  </>
                ) : (
                  <>
                    <PlusIcon className="size-4 mr-1.5" />
                    Registrar Período
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
