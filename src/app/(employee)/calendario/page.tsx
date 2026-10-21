import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { VacationCalendar } from "@/features/calendar/components/vacation-calendar";
import { addDays } from "@/features/vacations/domain/dates";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { getHolidays, getPolicyForDate, listApprovedAbsences } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Calendario del equipo" };

export default async function TeamCalendarPage() {
  await requireRole("EMPLOYEE");
  const today = todayISO();
  const window = { from: addDays(today, -400), to: addDays(today, 800) };

  const policy = await getPolicyForDate(db, today);
  const [absences, holidays] = await Promise.all([
    listApprovedAbsences(db, window),
    getHolidays(db, window.from, window.to, policy.holidayRegion),
  ]);

  return (
    <>
      <PageHeader title="Calendario del equipo" description="Vacaciones aprobadas de tus compañeros. No se muestran motivos ni datos personales." />
      <VacationCalendar absences={absences} holidays={holidays} today={today} />
    </>
  );
}
