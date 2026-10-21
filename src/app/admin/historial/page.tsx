import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listAuditLog } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Historial de cambios" };

const ACTION_LABELS: Record<string, string> = {
  "vacation.request.created": "Solicitud creada",
  "vacation.request.auto_approved": "Solicitud aprobada automáticamente",
  "vacation.request.cancelled": "Solicitud cancelada por el empleado",
  "vacation.request.approved": "Solicitud aprobada",
  "vacation.request.rejected": "Solicitud rechazada",
  "vacation.request.approved_cancelled": "Solicitud aprobada cancelada (días devueltos)",
  "employee.created": "Empleado creado",
  "employee.updated": "Empleado modificado",
  "employee.activated": "Empleado activado",
  "employee.deactivated": "Empleado desactivado",
  "balance.adjusted": "Ajuste manual de saldo",
  "balance.annual_allocation": "Asignación anual",
  "policy.version_created": "Nueva versión de política",
  "holiday.created": "Festivo añadido",
  "holiday.deleted": "Festivo eliminado",
};

export default async function AuditPage() {
  await requireRole("ADMIN");
  const entries = await listAuditLog(db);

  return (
    <>
      <PageHeader title="Historial de cambios" description="Últimas 150 acciones registradas." />
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Europe/Madrid" }).format(new Date(e.createdAt))}
                    </td>
                    <td className="px-4 py-3">{e.actor}</td>
                    <td className="px-4 py-3 font-medium">{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td className="max-w-md px-4 py-3 text-xs text-muted-foreground">
                      <p className="truncate font-mono" title={JSON.stringify(e.metadata)}>
                        {e.metadata ? JSON.stringify(e.metadata) : "—"}
                      </p>
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
