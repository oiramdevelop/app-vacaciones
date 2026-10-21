import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { CompanyTabs } from "@/features/admin/components/company-filter";
import { EmployeeDialog } from "@/features/admin/components/employee-dialog";
import { EmployeeRowActions } from "@/features/admin/components/employee-row-actions";
import { COMPANY_LABELS, parseCompany } from "@/features/companies";
import { yearOf } from "@/features/vacations/domain/dates";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listDepartments, listEmployees } from "@/server/admin/queries";
import { getPolicyForDate } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Empleados" };

export default async function AdminEmployeesPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const admin = await requireRole("ADMIN");
  const company = parseCompany((await searchParams).empresa);
  const today = todayISO();
  const year = yearOf(today);

  const [employees, departments] = await Promise.all([listEmployees(db, year, today, company), listDepartments(db)]);
  const policy = await getPolicyForDate(db, today).catch(() => null);
  const options = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <PageHeader
        title="Empleados"
        description={`Altas, edición y saldos de vacaciones de ${year}.`}
        actions={
          <EmployeeDialog
            departments={options}
            defaultDays={policy?.annualDays ?? 0}
            trigger={
              <Button>
                <Plus /> Nuevo empleado
              </Button>
            }
          />
        }
      />

      <div className="mb-4">
        <CompanyTabs basePath="/admin/empleados" current={company} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[62rem] text-sm">
            <thead className="border-b bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Departamento</th>
                <th className="px-4 py-3 font-medium">Incorporación</th>
                <th className="px-4 py-3 text-right font-medium">Asignados</th>
                <th className="px-4 py-3 text-right font-medium">Disponibles</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((e) => (
                <tr key={e.id} className={e.isActive ? "" : "bg-secondary/40 text-muted-foreground"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {e.name} {e.role === "ADMIN" ? <Badge className="ml-1">Admin</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{e.email}</p>
                  </td>
                  <td className="px-4 py-3">{COMPANY_LABELS[e.company]}</td>
                  <td className="px-4 py-3">{e.department ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(e.hireDate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{e.balance.assigned}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    {e.balance.available}
                    {e.balance.pending > 0 ? <span className="ml-1 text-xs font-normal text-muted-foreground">({e.balance.pending} pend.)</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={e.isActive ? "success" : "neutral"}>{e.isActive ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeRowActions
                      employee={{ id: e.id, name: e.name, email: e.email, role: e.role, company: e.company, departmentId: e.departmentId, hireDate: e.hireDate }}
                      departments={options}
                      isActive={e.isActive}
                      isSelf={e.id === admin.id}
                      year={year}
                      available={e.balance.available}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
