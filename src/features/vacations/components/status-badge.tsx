import { Badge } from "@/components/ui/badge";

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

const CONFIG: Record<RequestStatus, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "Pendiente", variant: "warning" },
  APPROVED: { label: "Aprobada", variant: "success" },
  REJECTED: { label: "Rechazada", variant: "danger" },
  CANCELLED: { label: "Cancelada", variant: "neutral" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, variant } = CONFIG[status];
  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
