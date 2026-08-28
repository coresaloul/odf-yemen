import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/80 pb-3.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 sm:pb-4">
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <div className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{description}</div>}
      </div>
      {action && (
        <div className="no-print flex flex-wrap items-center gap-1.5 sm:gap-2 [&>button]:flex-1 sm:[&>button]:flex-none [&>a]:flex-1 sm:[&>a]:flex-none">
          {action}
        </div>
      )}
    </div>
  );
}
