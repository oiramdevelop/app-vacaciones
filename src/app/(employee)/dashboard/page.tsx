import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CalendarPlus, Palmtree, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { StatusBadge } from "@/features/vacations/components/status-badge";
import { yearOf } from "@/features/vacations/domain/dates";
import { formatRange } from "@/lib/format";
import { db } from "@/server/db/client";
import { requireRole } from "@/server/auth/session";
import { getYearBalances, listOwnRequests } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

export const metadata: Metadata = { title: "Inicio" };

export default async function EmployeeDashboardPage() {
  const user = await requireRole("EMPLOYEE");
  const today = todayISO();
  const year = yearOf(today);

  const [[balance], requests] = await Promise.all([getYearBalances(db, user.id, [year], today), listOwnRequests(db, user.id)]);
  const b = balance!;

  const next = requests
    .filter((r) => r.status === "APPROVED" && r.end >= today)
    .sort((a, c) => a.start.localeCompare(c.start))[0];
  const inProgress = next ? next.start <= today : false;

  return (
    <>
      <PageHeader
        title={`Hola, ${user.name.split(" ")[0]}`}
        description={`Resumen de tus vacaciones de ${year}.`}
        actions={
          <Button asChild>
            <Link href="/vacaciones/solicitar">
              <CalendarPlus /> Solicitar vacaciones
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Días asignados" value={b.assigned} icon={Palmtree} tone="neutral" />
        <StatCard label="Disfrutados" value={b.used} icon={Sun} tone="primary" />
        <StatCard label="Comprometidos" value={b.committed} hint="Aprobados y aún por disfrutar" icon={CalendarClock} tone="warning" />
        <StatCard
          label="Disponibles"
          value={b.available}
          hint={b.pending > 0 ? `${b.pending} más reservados en solicitudes pendientes` : undefined}
          icon={CalendarCheck}
          tone="success"
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Uso de tus días</CardTitle>
          <CardDescription>
            {b.used + b.committed + b.pending} de {b.assigned} días utilizados, comprometidos o pendientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress
            max={Math.max(b.assigned, 1)}
            segments={[
              { label: "Disfrutados", value: b.used, className: "bg-primary" },
              { label: "Comprometidos", value: b.committed, className: "bg-primary/50" },
              { label: "Pendientes", value: b.pending, className: "bg-warning-soft ring-1 ring-inset ring-warning/40" },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Disfrutados</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/50" />Comprometidos</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning-soft ring-1 ring-warning/40" />Pendientes</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{inProgress ? "Vacaciones en curso" : "Próximas vacaciones"}</CardTitle>
          </CardHeader>
          <CardContent>
            {next ? (
              <>
                <p className="text-lg font-semibold">{formatRange(next.start, next.end)}</p>
                <p className="text-sm text-muted-foreground">{next.totalDays} días computables</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No tienes vacaciones aprobadas próximamente.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Últimas solicitudes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/vacaciones/mis-solicitudes">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no has hecho ninguna solicitud.</p>
            ) : (
              <ul className="divide-y">
                {[...requests]
                  .sort((a, c) => c.createdAt.localeCompare(a.createdAt))
                  .slice(0, 4)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{formatRange(r.start, r.end)}</p>
                        <p className="text-xs text-muted-foreground">{r.totalDays} días</p>
                      </div>
                      <StatusBadge status={r.status} />
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
