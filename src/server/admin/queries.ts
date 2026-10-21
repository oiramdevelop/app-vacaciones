import "server-only";
import { addDays, fromUTCDate, toUTCDate, type ISODate } from "@/features/vacations/domain/dates";
import { countComputableDays, type CountingRules } from "@/features/vacations/domain/calculate-days";
import type { YearBalance } from "@/features/vacations/domain/balance";
import type { Company } from "@/features/companies";
import { getBalancesForEmployees, type DbClient } from "@/server/vacations/queries";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function weekStart(today: ISODate): ISODate {
  const d = toUTCDate(today);
  const offset = (d.getUTCDay() + 6) % 7; // lunes = 0
  return addDays(today, -offset);
}

/** `company` undefined = las dos empresas. */
export async function getAdminDashboard(db: DbClient, today: ISODate, company?: Company) {
  const year = Number(today.slice(0, 4));
  const todayDate = toUTCDate(today);
  const byCompany = company ? { company } : {};

  const [activeEmployees, onVacationNow, pendingCount, receivedThisWeek, pending, upcoming, approvedInYear, holidays] = await Promise.all([
    db.user.count({ where: { isActive: true, role: "EMPLOYEE", ...byCompany } }),
    db.vacationRequest.count({ where: { status: "APPROVED", startDate: { lte: todayDate }, endDate: { gte: todayDate }, employee: { isActive: true, ...byCompany } } }),
    db.vacationRequest.count({ where: { status: "PENDING", employee: byCompany } }),
    db.vacationRequest.count({ where: { createdAt: { gte: toUTCDate(weekStart(today)) }, employee: byCompany } }),
    db.vacationRequest.findMany({
      where: { status: "PENDING", employee: byCompany },
      orderBy: { createdAt: "asc" },
      take: 5,
      include: { employee: { select: { name: true, company: true, department: { select: { name: true } } } } },
    }),
    db.vacationRequest.findMany({
      where: { status: "APPROVED", endDate: { gte: todayDate }, employee: { isActive: true, ...byCompany } },
      orderBy: { startDate: "asc" },
      take: 6,
      include: { employee: { select: { name: true, company: true } } },
    }),
    db.vacationRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: toUTCDate(`${year}-12-31`) }, endDate: { gte: toUTCDate(`${year}-01-01`) }, employee: byCompany },
      select: { startDate: true, endDate: true, policySnapshot: true },
    }),
    db.holiday.findMany({ where: { date: { gte: toUTCDate(`${year}-01-01`), lte: toUTCDate(`${year}-12-31`) } }, select: { date: true } }),
  ]);

  // Días computables aprobados por mes, con las reglas con las que se calculó cada solicitud.
  const holidaySet = new Set(holidays.map((h) => fromUTCDate(h.date)));
  const perMonth = MONTHS.map((month) => ({ month, days: 0 }));
  for (const r of approvedInYear) {
    const rules = r.policySnapshot as unknown as CountingRules;
    const start = fromUTCDate(r.startDate);
    const end = fromUTCDate(r.endDate);
    for (let m = 0; m < 12; m++) {
      const monthStart = `${year}-${String(m + 1).padStart(2, "0")}-01`;
      const monthEnd = fromUTCDate(new Date(Date.UTC(year, m + 1, 0)));
      const from = start > monthStart ? start : monthStart;
      const to = end < monthEnd ? end : monthEnd;
      if (from <= to) perMonth[m]!.days += countComputableDays(from, to, rules, holidaySet).total;
    }
  }

  return {
    stats: { activeEmployees, onVacationNow, pendingCount, receivedThisWeek },
    perMonth,
    pending: pending.map((r) => ({
      id: r.id,
      employee: r.employee.name,
      company: r.employee.company,
      department: r.employee.department?.name ?? null,
      start: fromUTCDate(r.startDate),
      end: fromUTCDate(r.endDate),
      totalDays: r.totalDays,
    })),
    upcoming: upcoming.map((r) => ({
      id: r.id,
      employee: r.employee.name,
      company: r.employee.company,
      start: fromUTCDate(r.startDate),
      end: fromUTCDate(r.endDate),
      totalDays: r.totalDays,
    })),
  };
}

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "ADMIN";
  company: Company;
  departmentId: string | null;
  department: string | null;
  hireDate: ISODate;
  isActive: boolean;
  balance: YearBalance;
}

export async function listEmployees(db: DbClient, year: number, today: ISODate, company?: Company): Promise<EmployeeRow[]> {
  const users = await db.user.findMany({
    where: company ? { company } : {},
    include: { department: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const balances = await getBalancesForEmployees(db, users.map((u) => u.id), year, today);
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    departmentId: u.departmentId,
    department: u.department?.name ?? null,
    hireDate: fromUTCDate(u.hireDate),
    isActive: u.isActive,
    balance: balances.get(u.id)!,
  }));
}

export interface AdminRequestRow {
  id: string;
  employee: string;
  company: Company;
  department: string | null;
  start: ISODate;
  end: ISODate;
  totalDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  /** Una aprobada que aún no ha terminado puede cancelarse (con devolución de días). */
  cancellable: boolean;
}

export async function listAllRequests(
  db: DbClient,
  filter: { status?: AdminRequestRow["status"]; company?: Company; departmentId?: string; employeeId?: string },
  today: ISODate,
): Promise<AdminRequestRow[]> {
  const rows = await db.vacationRequest.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      employee: {
        ...(filter.company ? { company: filter.company } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      },
    },
    include: { employee: { select: { name: true, company: true, department: { select: { name: true } } } } },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    employee: r.employee.name,
    company: r.employee.company,
    department: r.employee.department?.name ?? null,
    start: fromUTCDate(r.startDate),
    end: fromUTCDate(r.endDate),
    totalDays: r.totalDays,
    status: r.status,
    reason: r.reason,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    cancellable: r.status === "APPROVED" && fromUTCDate(r.endDate) >= today,
  }));
}

export async function listAuditLog(db: DbClient, take = 150) {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { actor: { select: { name: true } } } });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor?.name ?? "Sistema",
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
  }));
}

export async function listPolicies(db: DbClient) {
  const rows = await db.vacationPolicy.findMany({ orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] });
  return rows.map((p) => ({ ...p, effectiveFrom: fromUTCDate(p.effectiveFrom), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() }));
}

export async function listHolidaysForYear(db: DbClient, year: number) {
  const rows = await db.holiday.findMany({
    where: { date: { gte: toUTCDate(`${year}-01-01`), lte: toUTCDate(`${year}-12-31`) } },
    orderBy: { date: "asc" },
  });
  return rows.map((h) => ({ id: h.id, date: fromUTCDate(h.date), name: h.name, region: h.region }));
}

export async function listDepartments(db: DbClient) {
  const rows = await db.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  return rows.map((d) => ({ id: d.id, name: d.name, employees: d._count.users }));
}
