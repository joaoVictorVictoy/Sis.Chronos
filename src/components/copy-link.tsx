"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Mostra um link de acesso pronto para o admin copiar e enviar por onde quiser. */
export function CopyLink({ link, hint }: { link: string; hint?: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback: se o navegador bloquear clipboard, o input com select-all já facilita copiar à mão
    }
  };

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
        <input
          type="text"
          readOnly
          value={link}
          onClick={(e) => {
            e.currentTarget.select();
            void copiar();
          }}
          className="min-w-0 flex-1 rounded border bg-background px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring select-all"
          title="Clique para selecionar e copiar"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={copiado ? "secondary" : "default"}
            onClick={copiar}
            className="shrink-0"
          >
            {copiado ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copiado ? "Copiado" : "Copiar link"}
          </Button>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir link em nova aba"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            <ExternalLinkIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">Abrir</span>
          </a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-normal leading-relaxed break-words">
        {hint ?? "Envie por WhatsApp, Teams ou e-mail. Quem abrir define a senha e já entra na empresa."} O link vale
        por 1 hora e só pode ser usado uma vez.
      </p>
    </div>
  );
}
