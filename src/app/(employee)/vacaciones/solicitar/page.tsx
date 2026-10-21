import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RequestForm } from "@/features/vacations/components/request-form";
import { addDays, yearOf } from "@/features/vacations/domain/dates";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { getHolidays, getPolicyForDate, getYearBalances, listActiveRanges } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Solicitar vacaciones" };

export default async function RequestVacationPage() {
  const user = await requireRole("EMPLOYEE");
  const today = todayISO();
  const year = yearOf(today);

  const policy = await getPolicyForDate(db, today);
  const [holidays, blockedRanges, balances] = await Promise.all([
    getHolidays(db, today, addDays(today, 730), policy.holidayRegion),
    listActiveRanges(db, user.id, today),
    getYearBalances(db, user.id, [year, year + 1], today),
  ]);

  return (
    <>
      <PageHeader title="Solicitar vacaciones" description="Elige las fechas de inicio y fin de tu periodo." />
      <RequestForm
        today={today}
        rules={policy.rules}
        holidays={holidays.map((h) => h.date)}
        blockedRanges={blockedRanges}
        availableByYear={Object.fromEntries(balances.map((b) => [b.year, b.available]))}
      />
    </>
  );
}
