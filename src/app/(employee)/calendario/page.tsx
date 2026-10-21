import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { VacationCalendar } from "@/features/calendar/components/vacation-calendar";
import { addDays } from "@/features/vacations/domain/dates";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { getHolidays, getPolicyForDate, listApprovedAbsences } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Calendario del equipo" };

export default async function TeamCalendarPage({ searchParams }: { searchParams: Promise<{ ambito?: string }> }) {
  const user = await requireRole("EMPLOYEE");
  const { ambito } = await searchParams;

  // Privacidad: por defecto sólo el propio departamento; "empresa" muestra a la plantilla activa de su empresa.
  const wholeCompany = ambito === "empresa" || !user.departmentId;
  const today = todayISO();
  const window = { from: addDays(today, -400), to: addDays(today, 800) };

  const policy = await getPolicyForDate(db, today);
  const [absences, holidays] = await Promise.all([
    listApprovedAbsences(db, window, wholeCompany ? { company: user.company } : { company: user.company, departmentId: user.departmentId }),
    getHolidays(db, window.from, window.to, policy.holidayRegion),
  ]);

  return (
    <>
      <PageHeader
        title="Calendario del equipo"
        description="Vacaciones aprobadas de tus compañeros. No se muestran motivos ni datos personales."
        actions={
          user.departmentId ? (
            <div role="group" aria-label="Ámbito" className="inline-flex rounded-md border bg-card p-0.5 text-sm">
              <Button asChild variant={wholeCompany ? "ghost" : "default"} size="sm">
                <Link href="/calendario">Mi departamento</Link>
              </Button>
              <Button asChild variant={wholeCompany ? "default" : "ghost"} size="sm">
                <Link href="/calendario?ambito=empresa">Toda la empresa</Link>
              </Button>
            </div>
          ) : null
        }
      />
      <VacationCalendar absences={absences} holidays={holidays} today={today} showDepartment={wholeCompany} />
    </>
  );
}
