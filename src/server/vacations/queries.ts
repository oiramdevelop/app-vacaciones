import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { computeYearBalance, type YearBalance } from "@/features/vacations/domain/balance";
import { fromUTCDate, toUTCDate, type ISODate } from "@/features/vacations/domain/dates";
import type { RequestRules } from "@/features/vacations/domain/validate-request";
import type { Company } from "@/features/companies";
import { daysByYearOf } from "./snapshot";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface PolicyView {
  id: string;
  name: string;
  holidayRegion: string | null;
  requiresApproval: boolean;
  annualDays: number;
  rules: RequestRules;
}

/** Política vigente en una fecha: la de `effectiveFrom` más reciente anterior o igual; si no, la marcada por defecto. */
export async function getPolicyForDate(db: DbClient, date: ISODate): Promise<PolicyView> {
  const policy =
    (await db.vacationPolicy.findFirst({ where: { effectiveFrom: { lte: toUTCDate(date) } }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] })) ??
    (await db.vacationPolicy.findFirst({ where: { isDefault: true } }));
  if (!policy) throw new Error("No hay ninguna política de vacaciones configurada");

  return {
    id: policy.id,
    name: policy.name,
    holidayRegion: policy.holidayRegion,
    requiresApproval: policy.requiresApproval,
    annualDays: policy.annualDays,
    rules: {
      calculationType: policy.calculationType,
      workingWeekdays: policy.workingWeekdays,
      excludeHolidays: policy.excludeHolidays,
      allowFutureRequests: policy.allowFutureRequests,
      maxAdvanceDays: policy.maxAdvanceDays,
      minNoticeDays: policy.minNoticeDays,
    },
  };
}

export async function getHolidays(db: DbClient, from: ISODate, to: ISODate, region: string | null) {
  const rows = await db.holiday.findMany({
    where: { date: { gte: toUTCDate(from), lte: toUTCDate(to) }, region: { in: region ? ["", region] : [""] } },
    orderBy: { date: "asc" },
  });
  return rows.map((h) => ({ date: fromUTCDate(h.date), name: h.name }));
}

/** Saldos de varios años de un empleado, calculados siempre desde el libro mayor. */
export async function getYearBalances(db: DbClient, employeeId: string, years: number[], today: ISODate): Promise<YearBalance[]> {
  const [entries, pending] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { employeeId, year: { in: years } },
      select: { year: true, type: true, days: true, request: { select: { startDate: true } } },
    }),
    db.vacationRequest.findMany({ where: { employeeId, status: "PENDING" }, select: { policySnapshot: true, startDate: true, totalDays: true } }),
  ]);

  const pendingByYear = new Map<number, number>();
  for (const p of pending) {
    const byYear = daysByYearOf(p);
    for (const [year, days] of Object.entries(byYear)) pendingByYear.set(Number(year), (pendingByYear.get(Number(year)) ?? 0) + days);
  }

  return years.map((year) =>
    computeYearBalance({
      year,
      today,
      pendingDays: pendingByYear.get(year) ?? 0,
      ledger: entries
        .filter((e) => e.year === year)
        .map((e) => ({ type: e.type, days: e.days, requestStart: e.request ? fromUTCDate(e.request.startDate) : null })),
    }),
  );
}

export interface RequestView {
  id: string;
  start: ISODate;
  end: ISODate;
  totalDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

function toRequestView(r: {
  id: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  status: RequestView["status"];
  reason: string | null;
  rejectionReason: string | null;
  createdAt: Date;
}): RequestView {
  return {
    id: r.id,
    start: fromUTCDate(r.startDate),
    end: fromUTCDate(r.endDate),
    totalDays: r.totalDays,
    status: r.status,
    reason: r.reason,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listOwnRequests(
  db: DbClient,
  employeeId: string,
  filter: { status?: RequestView["status"]; year?: number } = {},
): Promise<RequestView[]> {
  const where: Prisma.VacationRequestWhereInput = { employeeId };
  if (filter.status) where.status = filter.status;
  if (filter.year) {
    // Cualquier solicitud que toque el año, aunque empiece el anterior.
    where.startDate = { lte: toUTCDate(`${filter.year}-12-31`) };
    where.endDate = { gte: toUTCDate(`${filter.year}-01-01`) };
  }
  const rows = await db.vacationRequest.findMany({ where, orderBy: { startDate: "desc" } });
  return rows.map(toRequestView);
}

/** Periodos que bloquean nuevas solicitudes del empleado (pendientes y aprobadas). */
export async function listActiveRanges(db: DbClient, employeeId: string, from: ISODate) {
  const rows = await db.vacationRequest.findMany({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, endDate: { gte: toUTCDate(from) } },
    select: { startDate: true, endDate: true },
  });
  return rows.map((r) => ({ start: fromUTCDate(r.startDate), end: fromUTCDate(r.endDate) }));
}

export interface CalendarEvent {
  id: string;
  employeeName: string;
  department: string | null;
  start: ISODate;
  end: ISODate;
}

/** Vacaciones aprobadas dentro de una ventana. No expone motivos ni datos personales. */
export async function listApprovedAbsences(
  db: DbClient,
  window: { from: ISODate; to: ISODate },
  scope: { company?: Company; departmentId?: string | null; employeeId?: string } = {},
): Promise<CalendarEvent[]> {
  const rows = await db.vacationRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: toUTCDate(window.to) },
      endDate: { gte: toUTCDate(window.from) },
      employee: {
        isActive: true,
        ...(scope.company ? { company: scope.company } : {}),
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      },
      ...(scope.employeeId ? { employeeId: scope.employeeId } : {}),
    },
    select: { id: true, startDate: true, endDate: true, employee: { select: { name: true, department: { select: { name: true } } } } },
    orderBy: { startDate: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    employeeName: r.employee.name,
    department: r.employee.department?.name ?? null,
    start: fromUTCDate(r.startDate),
    end: fromUTCDate(r.endDate),
  }));
}

/** Saldo de un año para varios empleados en dos consultas (listados). */
export async function getBalancesForEmployees(db: DbClient, employeeIds: string[], year: number, today: ISODate): Promise<Map<string, YearBalance>> {
  const [entries, pending] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { employeeId: { in: employeeIds }, year },
      select: { employeeId: true, type: true, days: true, request: { select: { startDate: true } } },
    }),
    db.vacationRequest.findMany({
      where: { employeeId: { in: employeeIds }, status: "PENDING" },
      select: { employeeId: true, policySnapshot: true, startDate: true, totalDays: true },
    }),
  ]);

  const result = new Map<string, YearBalance>();
  for (const id of employeeIds) {
    result.set(
      id,
      computeYearBalance({
        year,
        today,
        pendingDays: pending.filter((p) => p.employeeId === id).reduce((acc, p) => acc + (daysByYearOf(p)[year] ?? 0), 0),
        ledger: entries
          .filter((e) => e.employeeId === id)
          .map((e) => ({ type: e.type, days: e.days, requestStart: e.request ? fromUTCDate(e.request.startDate) : null })),
      }),
    );
  }
  return result;
}
