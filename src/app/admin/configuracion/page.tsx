import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { AnnualAllocation } from "@/features/admin/components/annual-allocation";
import { HolidayManager } from "@/features/admin/components/holiday-manager";
import { PolicyForm } from "@/features/admin/components/policy-form";
import { yearOf } from "@/features/vacations/domain/dates";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { listHolidaysForYear, listPolicies } from "@/server/admin/queries";
import { getPolicyForDate } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Configuración" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requireRole("ADMIN");
  const today = todayISO();
  const currentYear = yearOf(today);
  const requested = Number((await searchParams).anio);
  const holidayYear = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentYear;

  const [policies, holidays, active] = await Promise.all([
    listPolicies(db),
    listHolidaysForYear(db, holidayYear),
    getPolicyForDate(db, today),
  ]);
  const current = policies.find((p) => p.id === active.id) ?? policies[0]!;

  return (
    <>
      <PageHeader title="Configuración" description="Políticas de vacaciones, festivos y asignación anual." />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Política de vacaciones</CardTitle>
            <CardDescription>
              Vigente hoy: <strong>{current.name}</strong> (desde {formatDate(current.effectiveFrom)}). Guardar crea una versión nueva; las solicitudes ya
              creadas no cambian.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyForm
              today={today}
              initial={{
                name: current.name,
                annualDays: current.annualDays,
                calculationType: current.calculationType,
                workingWeekdays: current.workingWeekdays,
                excludeHolidays: current.excludeHolidays,
                allowFutureRequests: current.allowFutureRequests,
                maxAdvanceDays: current.maxAdvanceDays,
                minNoticeDays: current.minNoticeDays,
                requiresApproval: current.requiresApproval,
                holidayRegion: current.holidayRegion ?? "",
                effectiveFrom: today,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de versiones</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {policies.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      desde {formatDate(p.effectiveFrom)} · {p.annualDays} días · {p.calculationType === "WORKING_DAYS" ? "laborables" : "naturales"}
                      {p.requiresApproval ? "" : " · aprobación automática"}
                    </span>
                  </span>
                  {p.id === active.id ? <Badge variant="success">Vigente</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Festivos {holidayYear}</CardTitle>
              <CardDescription>Se excluyen del cómputo si la política lo indica.</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/configuracion?anio=${holidayYear - 1}`}>{holidayYear - 1}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/configuracion?anio=${holidayYear + 1}`}>{holidayYear + 1}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <HolidayManager year={holidayYear} holidays={holidays} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asignación anual</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnualAllocation year={currentYear + 1} annualDays={active.annualDays} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
