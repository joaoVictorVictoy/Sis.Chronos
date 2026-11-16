import { InfoTooltip } from "@/components/info-tooltip";

export function PageHeader({
  title,
  description,
  descriptionAsTooltip = false,
  children,
}: {
  title: string;
  description?: string;
  descriptionAsTooltip?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && descriptionAsTooltip ? <InfoTooltip text={description} side="right" /> : null}
        </div>
        {description && !descriptionAsTooltip ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">{children}</p>;
}
