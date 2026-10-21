import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/layout/page-header";
import { CompanySelect } from "@/features/admin/components/company-filter";
import { VacationCalendar } from "@/features/calendar/components/vacation-calendar";
import { parseCompany } from "@/features/companies";
import { addDays, diffInDays, isValidISODate } from "@/features/vacations/domain/dates";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listDepartments } from "@/server/admin/queries";
import { getHolidays, getPolicyForDate, listApprovedAbsences } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Calendario global" };

const MAX_WINDOW_DAYS = 800;

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; departamento?: string; empleado?: string; desde?: string; hasta?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const company = parseCompany(params.empresa);
  const today = todayISO();

  let from = params.desde && isValidISODate(params.desde) ? params.desde : addDays(today, -60);
  let to = params.hasta && isValidISODate(params.hasta) ? params.hasta : addDays(today, 400);
  if (from > to) [from, to] = [to, from];
  if (diffInDays(from, to) > MAX_WINDOW_DAYS) to = addDays(from, MAX_WINDOW_DAYS);

  const [departments, employees] = await Promise.all([
    listDepartments(db),
    db.user.findMany({ where: { role: "EMPLOYEE", isActive: true, ...(company ? { company } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const departmentId = departments.find((d) => d.id === params.departamento)?.id;
  const employeeId = employees.find((e) => e.id === params.empleado)?.id;

  const policy = await getPolicyForDate(db, today).catch(() => null);
  const [absences, holidays] = await Promise.all([
    listApprovedAbsences(db, { from, to }, { company, departmentId, employeeId }),
    getHolidays(db, from, to, policy?.holidayRegion ?? null),
  ]);

  return (
    <>
      <PageHeader title="Calendario global" description="Ausencias aprobadas de toda la plantilla activa." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
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
        <div className="space-y-1">
          <label htmlFor="empleado" className="text-xs font-medium text-muted-foreground">Empleado</label>
          <Select id="empleado" name="empleado" defaultValue={employeeId ?? ""} className="w-52">
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="desde" className="text-xs font-medium text-muted-foreground">Desde</label>
          <Input id="desde" name="desde" type="date" defaultValue={from} className="w-40" />
        </div>
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Input id="hasta" name="hasta" type="date" defaultValue={to} className="w-40" />
        </div>
        <Button type="submit" variant="outline">Filtrar</Button>
        <Button asChild variant="ghost">
          <Link href="/admin/calendario">Restablecer</Link>
        </Button>
      </form>

      <VacationCalendar absences={absences} holidays={holidays} today={today} showDepartment />
    </>
  );
}
