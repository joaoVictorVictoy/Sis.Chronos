"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mostra um link de acesso pronto para o admin copiar e enviar por onde quiser. */
export function CopyLink({ link, hint }: { link: string; hint?: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o link continua visível para copiar à mão
    }
  };

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 p-3 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 w-full min-w-0">
        <code
          className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono select-all"
          title={link}
        >
          {link}
        </code>
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
      </div>
      <p className="text-xs text-muted-foreground whitespace-normal leading-relaxed break-words">
        {hint ?? "Envie por WhatsApp, Teams ou e-mail. Quem abrir define a senha e já entra na empresa."} O link vale
        por 1 hora.
      </p>
    </div>
  );
}
