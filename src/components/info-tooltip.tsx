"use client";

import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function InfoTooltip({
  text,
  side = "top",
  className,
}: {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={text}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-help align-middle",
            className,
          )}
        >
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side={side}>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
