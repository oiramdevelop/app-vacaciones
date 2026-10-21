import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ClipboardList, Palmtree, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { RequestActions } from "@/features/admin/components/request-actions";
import { VacationsByMonthChart } from "@/features/admin/components/vacations-by-month-chart";
import { yearOf } from "@/features/vacations/domain/dates";
import { formatRange } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { getAdminDashboard } from "@/server/admin/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Panel de administración" };

export default async function AdminDashboardPage() {
  await requireRole("ADMIN");
  const today = todayISO();
  const { stats, perMonth, pending, upcoming } = await getAdminDashboard(db, today);

  return (
    <>
      <PageHeader title="Panel de administración" description="Vista general de la plantilla y las solicitudes." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Empleados activos" value={stats.activeEmployees} icon={Users} tone="primary" />
        <StatCard label="De vacaciones hoy" value={stats.onVacationNow} icon={Palmtree} tone="success" />
        <StatCard label="Solicitudes pendientes" value={stats.pendingCount} icon={ClipboardList} tone="warning" />
        <StatCard label="Recibidas esta semana" value={stats.receivedThisWeek} icon={CalendarClock} tone="neutral" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Vacaciones por mes</CardTitle>
          <CardDescription>Días computables aprobados en {yearOf(today)}</CardDescription>
        </CardHeader>
        <CardContent>
          <VacationsByMonthChart data={perMonth} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Requieren aprobación</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/solicitudes">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
            ) : (
              <ul className="divide-y">
                {pending.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.employee}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRange(r.start, r.end)} · {r.totalDays} días
                      </p>
                    </div>
                    <RequestActions
                      requestId={r.id}
                      status="PENDING"
                      cancellable={false}
                      summary={`${r.employee}, ${formatRange(r.start, r.end)}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Próximas ausencias</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ausencias aprobadas próximamente.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((r) => (
                  <li key={r.id} className="py-3">
                    <p className="text-sm font-medium">{r.employee}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRange(r.start, r.end)} · {r.totalDays} días
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
