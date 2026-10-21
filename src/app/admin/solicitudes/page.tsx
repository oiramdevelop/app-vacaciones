import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/layout/page-header";
import { CompanySelect } from "@/features/admin/components/company-filter";
import { RequestActions } from "@/features/admin/components/request-actions";
import { COMPANY_LABELS, parseCompany } from "@/features/companies";
import { StatusBadge } from "@/features/vacations/components/status-badge";
import { requestStatusSchema } from "@/features/vacations/schemas";
import { formatDate, formatRange } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listAllRequests, listDepartments } from "@/server/admin/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Solicitudes" };

const STATUS_LABELS = { PENDING: "Pendientes", APPROVED: "Aprobadas", REJECTED: "Rechazadas", CANCELLED: "Canceladas" } as const;

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ estado?: string; empresa?: string; departamento?: string }> }) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const company = parseCompany(params.empresa);
  // Por defecto se muestran las pendientes: es lo que requiere acción.
  const status = params.estado === "todas" ? undefined : (requestStatusSchema.safeParse(params.estado ?? "PENDING").data ?? "PENDING");

  const departments = await listDepartments(db);
  const departmentId = departments.some((d) => d.id === params.departamento) ? params.departamento : undefined;
  const requests = await listAllRequests(db, { status, company, departmentId }, todayISO());

  return (
    <>
      <PageHeader title="Solicitudes" description="Aprueba o rechaza las solicitudes del equipo." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="estado" className="text-xs font-medium text-muted-foreground">Estado</label>
          <Select id="estado" name="estado" defaultValue={status ?? "todas"} className="w-44">
            <option value="todas">Todos</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <CompanySelect current={company} />
        <div className="space-y-1">
          <label htmlFor="departamento" className="text-xs font-medium text-muted-foreground">Departamento</label>
          <Select id="departamento" name="departamento" defaultValue={departmentId ?? ""} className="w-48">
            <option value="">Todos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">Filtrar</Button>
        <Button asChild variant="ghost">
          <Link href="/admin/solicitudes">Restablecer</Link>
        </Button>
      </form>

      <Card className="overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No hay solicitudes con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Empleado</th>
                  <th className="px-4 py-3 font-medium">Fechas</th>
                  <th className="px-4 py-3 font-medium">Días</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.employee}</p>
                      <p className="text-xs text-muted-foreground">
                        {COMPANY_LABELS[r.company]} · {r.department ?? "Sin departamento"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{formatRange(r.start, r.end)}</p>
                      {r.reason ? <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground" title={r.reason}>“{r.reason}”</p> : null}
                    </td>
                    <td className="px-4 py-3">{r.totalDays}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === "REJECTED" && r.rejectionReason ? (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Motivo: {r.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt.slice(0, 10))}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RequestActions
                          requestId={r.id}
                          status={r.status}
                          cancellable={r.cancellable}
                          summary={`${r.employee}, ${formatRange(r.start, r.end)}`}
                        />
                      </div>
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
