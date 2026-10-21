import { cn } from "@/lib/utils";

interface ProgressProps {
  /** Segmentos en días, pintados en orden; su suma no debería superar `max`. */
  segments: { value: number; className: string; label: string }[];
  max: number;
  className?: string;
}

export function Progress({ segments, max, className }: ProgressProps) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={total}
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      {segments.map((s) => (
        <div key={s.label} className={s.className} style={{ width: `${max > 0 ? (s.value / max) * 100 : 0}%` }} />
      ))}
    </div>
  );
}
