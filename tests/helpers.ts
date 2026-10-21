import { db } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { toUTCDate } from "@/features/vacations/domain/dates";

/** Fecha "hoy" fija para que los tests no dependan del reloj. */
export const TODAY = "2026-10-08";
export const YEAR = 2026;

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "LedgerEntry", "VacationRequest", "Holiday", "VacationPolicy", "User", "Department", "LoginThrottle" RESTART IDENTITY CASCADE',
  );
}

export async function createPolicy(overrides: Partial<Parameters<typeof db.vacationPolicy.create>[0]["data"]> = {}) {
  return db.vacationPolicy.create({
    data: {
      name: "Política de test",
      annualDays: 22,
      calculationType: "WORKING_DAYS",
      workingWeekdays: [1, 2, 3, 4, 5],
      excludeHolidays: true,
      effectiveFrom: toUTCDate("2020-01-01"),
      isDefault: true,
      ...overrides,
    },
  });
}

export async function createUser(role: "EMPLOYEE" | "ADMIN", name: string, opts: { allocate?: number; year?: number; departmentId?: string } = {}) {
  const user = await db.user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@test.local`,
      passwordHash: "x",
      role,
      hireDate: toUTCDate("2020-01-01"),
      departmentId: opts.departmentId,
    },
  });
  if (opts.allocate) {
    await db.ledgerEntry.create({ data: { employeeId: user.id, year: opts.year ?? YEAR, type: "ALLOCATION", days: opts.allocate } });
  }
  return { user, actor: toActor(user) };
}

export function toActor(u: Pick<CurrentUser, "id" | "name" | "email" | "role" | "company" | "departmentId">): CurrentUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, company: u.company, departmentId: u.departmentId };
}

export async function addHoliday(date: string, name = "Festivo") {
  return db.holiday.create({ data: { date: toUTCDate(date), name, region: "" } });
}

/** Suma del libro mayor de un empleado y año (el saldo "contable"). */
export async function ledgerSum(employeeId: string, year = YEAR) {
  const r = await db.ledgerEntry.aggregate({ where: { employeeId, year }, _sum: { days: true } });
  return r._sum.days ?? 0;
}
