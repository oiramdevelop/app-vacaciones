import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { CancelRequestButton } from "@/features/vacations/components/cancel-request-button";
import { StatusBadge } from "@/features/vacations/components/status-badge";
import { requestStatusSchema } from "@/features/vacations/schemas";
import { yearOf } from "@/features/vacations/domain/dates";
import { formatDate, formatRange } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listOwnRequests } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Mis solicitudes" };

const STATUS_LABELS = { PENDING: "Pendientes", APPROVED: "Aprobadas", REJECTED: "Rechazadas", CANCELLED: "Canceladas" } as const;
const selectClass =
  "h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; anio?: string; creada?: string }>;
}) {
  const user = await requireRole("EMPLOYEE");
  const params = await searchParams;

  const status = requestStatusSchema.safeParse(params.estado).data;
  const yearParam = Number(params.anio);
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : undefined;

  const requests = await listOwnRequests(db, user.id, { status, year });
  const currentYear = yearOf(todayISO());
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  return (
    <>
      <PageHeader
        title="Mis solicitudes"
        description="Consulta el estado y el historial de tus solicitudes."
        actions={
          <Button asChild>
            <Link href="/vacaciones/solicitar">
              <CalendarPlus /> Nueva solicitud
            </Link>
          </Button>
        }
      />

      {params.creada ? (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" /> Solicitud enviada. Quedará pendiente hasta que un administrador la revise.
        </p>
      ) : null}

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label htmlFor="estado" className="text-xs font-medium text-muted-foreground">Estado</label>
          <select id="estado" name="estado" defaultValue={status ?? ""} className={`${selectClass} block`}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="anio" className="text-xs font-medium text-muted-foreground">Año</label>
          <select id="anio" name="anio" defaultValue={year ?? ""} className={`${selectClass} block`}>
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">Filtrar</Button>
        {status || year ? (
          <Button asChild variant="ghost">
            <Link href="/vacaciones/mis-solicitudes">Limpiar</Link>
          </Button>
        ) : null}
      </form>

      <Card className="overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No hay solicitudes con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Periodo</th>
                  <th className="px-4 py-3 font-medium">Días</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Solicitada</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{formatRange(r.start, r.end)}</p>
                      {r.reason ? <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground" title={r.reason}>{r.reason}</p> : null}
                    </td>
                    <td className="px-4 py-3">{r.totalDays}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === "REJECTED" && r.rejectionReason ? (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Motivo: {r.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt.slice(0, 10))}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "PENDING" ? <CancelRequestButton requestId={r.id} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
