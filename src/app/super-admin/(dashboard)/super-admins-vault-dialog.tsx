"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  KeyRoundIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addSuperAdminAction,
  removeSuperAdminAction,
  type SuperAdminMember,
} from "./actions";

export function SuperAdminsVaultTrigger({
  superAdmins,
  currentUserEmail,
}: {
  superAdmins: SuperAdminMember[];
  currentUserEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Contador de cliques rápidos no escudo (3 cliques em até 900ms abre o cofre oculto)
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretShieldClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      setConfirmRemoveId(null);
      setOpen(true);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 800);
  };

  // Atalho de teclado oculto: Ctrl + Shift + A (ou Ctrl + Shift + S)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a" || e.key === "S" || e.key === "s")) {
        e.preventDefault();
        setConfirmRemoveId(null);
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const dbAdminsCount = superAdmins.filter((a) => a.source === "db").length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const res = await addSuperAdminAction(trimmed);
      if (res.ok) {
        toast.success(res.message);
        setNewEmail("");
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const res = await removeSuperAdminAction(id);
      if (res.ok) {
        toast.success(res.message);
        setConfirmRemoveId(null);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <span
        onClick={handleSecretShieldClick}
        className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 select-none"
      >
        <ShieldCheckIcon className="size-4" />
      </span>

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg p-6 flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-5 text-indigo-500" />
              Cofre de Super Admins (Acesso Master)
            </DialogTitle>
            <DialogDescription>
              Gerencie quem possui acesso irrestrito ao painel <code>/super-admin</code>. Alterações
              entram em vigor imediatamente.
            </DialogDescription>
          </DialogHeader>

          {/* Formulário para adicionar novo Super Admin */}
          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
            <Input
              type="email"
              placeholder="novo.admin@empresa.com.br"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={isPending}
              required
              className="h-9 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !newEmail.trim()}
              className="h-9 gap-1.5 shrink-0 cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              Adicionar
            </Button>
          </form>

          {/* Lista de Super Admins ativos */}
          <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
            {superAdmins.map((item) => {
              const isSelf =
                item.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase();
              const isConfirming = confirmRemoveId === item.id;
              const isLastDbAdmin = item.source === "db" && dbAdminsCount <= 1;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card/70 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground truncate" title={item.email}>
                        {item.email}
                      </span>
                      {isSelf ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Você
                        </Badge>
                      ) : null}
                      {item.source === "env" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Variável Vercel
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.source === "db"
                        ? `Autorizado no banco · ${new Date(item.createdAt).toLocaleDateString("pt-BR")}`
                        : "Definido via SUPER_ADMIN_EMAILS na Vercel"}
                    </p>
                  </div>

                  {item.source === "db" ? (
                    isConfirming ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2.5 text-xs cursor-pointer"
                          disabled={isPending}
                          onClick={() => handleRemove(item.id)}
                        >
                          {isPending ? "Removendo..." : "Confirmar"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending || isLastDbAdmin}
                        onClick={() => setConfirmRemoveId(item.id)}
                        className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/20 shrink-0 cursor-pointer"
                        title={
                          isLastDbAdmin
                            ? "Não é possível remover o último Super Admin"
                            : `Remover acesso de ${item.email}`
                        }
                      >
                        <Trash2Icon className="size-3.5" />
                        Remover
                      </Button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldAlertIcon className="size-3.5 text-amber-500 shrink-0" />
              O novo e-mail também precisa ter usuário criado em Authentication no Supabase.
            </span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
