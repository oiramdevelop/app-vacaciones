import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "neutral";
}) {
  const tones = {
    primary: "bg-accent text-accent-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    neutral: "bg-secondary text-secondary-foreground",
  };
  return (
    <Card className="flex items-start justify-between gap-3 p-5">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", tones[tone])}>
        <Icon className="size-5" />
      </span>
    </Card>
  );
}
