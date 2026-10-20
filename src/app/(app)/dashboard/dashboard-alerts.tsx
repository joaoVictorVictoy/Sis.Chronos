"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  OctagonAlertIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Alert, AlertLevel } from "@/lib/alerts";

const ALERT_ICON: Record<AlertLevel, React.ComponentType<{ className?: string }>> = {
  critico: OctagonAlertIcon,
  atencao: AlertTriangleIcon,
  info: InfoIcon,
};

const ALERT_COLOR: Record<AlertLevel, string> = {
  critico: "text-[--viz-critical]",
  atencao: "text-[#8a6200] dark:text-[--viz-warning]",
  info: "text-muted-foreground",
};

export function DashboardAlerts({ alerts }: { alerts: Alert[] }) {
  const [isHidden, setIsHidden] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dashboard_alerts_hidden");
      if (stored === "true") {
        setIsHidden(true);
      }
    } catch {
      // Silencia caso localStorage não esteja acessível
    }
  }, []);

  const toggleHidden = () => {
    setIsHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dashboard_alerts_hidden", String(next));
      } catch {
        // Silencia caso localStorage não esteja acessível
      }
      return next;
    });
  };

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter((a) => a.level === "critico").length;

  return (
    <Card className="transition-all shadow-xs">
      <CardHeader className="py-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Alertas</CardTitle>
              <Badge
                variant={criticalCount > 0 ? "destructive" : "secondary"}
                className="text-xs tabular-nums"
              >
                {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
              </Badge>
            </div>
            {!isHidden && (
              <CardDescription className="text-xs mt-0.5">
                O que precisa de atenção agora.
              </CardDescription>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleHidden}
            className="h-7 text-xs gap-1.5 shadow-2xs cursor-pointer"
            title={isHidden ? "Exibir os alertas do dashboard" : "Ocultar os alertas do dashboard"}
          >
            {isHidden ? (
              <>
                <EyeIcon className="size-3.5" />
                Mostrar alertas ({alerts.length})
              </>
            ) : (
              <>
                <EyeOffIcon className="size-3.5" />
                Ocultar alertas
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {!isHidden && (
        <CardContent className="grid gap-2 pt-0 px-4 pb-4">
          {alerts.slice(0, 8).map((alert) => {
            const Icon = ALERT_ICON[alert.level];
            const content = (
              <div className="flex items-start gap-2 rounded-lg border px-3 py-2 bg-card/60 hover:bg-card hover:border-primary/40 transition-colors">
                <Icon className={`mt-0.5 size-4 shrink-0 ${ALERT_COLOR[alert.level]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
            );
            return alert.href ? (
              <Link key={alert.id} href={alert.href} className="block transition-colors rounded-lg">
                {content}
              </Link>
            ) : (
              <div key={alert.id}>{content}</div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
