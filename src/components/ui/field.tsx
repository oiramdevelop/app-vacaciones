import * as React from "react";
import { cn } from "@/lib/utils";

/** Etiqueta + control + mensaje de error. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectClass, className)} {...props} />;
}

export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}
