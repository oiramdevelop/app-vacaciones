import "server-only";
import { db } from "@/server/db/client";
import { fail, lockEmployee, writeAudit, type ServiceResult, type Tx } from "@/server/db/tx";
import { ForbiddenError } from "@/server/auth/errors";
import { hashPassword } from "@/server/auth/password";
import type { CurrentUser } from "@/server/auth/session";
import { toUTCDate, yearOf, type ISODate } from "@/features/vacations/domain/dates";
import { adjustBalanceSchema, employeeCreateSchema, employeeUpdateSchema, idSchema, yearSchema } from "@/features/admin/schemas";
import { getYearBalances } from "@/server/vacations/queries";
import { todayISO } from "@/server/vacations/today";

function assertAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

const firstIssue = (e: { issues: { message: string }[] }) => fail(...e.issues.map((i) => i.message));

/** Evita dejar la aplicación sin ningún administrador activo. */
async function otherActiveAdmins(tx: Tx, excludeId: string) {
  return tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: excludeId } } });
}

export async function createEmployee(actor: CurrentUser, raw: unknown, today: ISODate = todayISO()): Promise<ServiceResult<{ id: string }>> {
  assertAdmin(actor);
  const parsed = employeeCreateSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;
  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: input.email }, select: { id: true } })) return fail("Ya existe un usuario con ese email.");

    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        hireDate: toUTCDate(input.hireDate),
      },
    });
    if (input.initialDays > 0) {
      await tx.ledgerEntry.create({
        data: { employeeId: user.id, year: yearOf(today), type: "ALLOCATION", days: input.initialDays, reason: "Asignación inicial", createdById: actor.id },
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "employee.created",
      entityType: "User",
      entityId: user.id,
      metadata: { email: input.email, role: input.role, initialDays: input.initialDays },
    });
    return { ok: true, id: user.id };
  });
}

export async function updateEmployee(actor: CurrentUser, raw: unknown): Promise<ServiceResult> {
  assertAdmin(actor);
  const parsed = employeeUpdateSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const { id, newPassword, ...input } = parsed.data;
  const passwordHash = newPassword ? await hashPassword(newPassword) : undefined;

  return db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id } });
    if (!current) return fail("El empleado no existe.");

    if (input.email !== current.email && (await tx.user.findUnique({ where: { email: input.email }, select: { id: true } }))) {
      return fail("Ya existe un usuario con ese email.");
    }

    if (current.role === "ADMIN" && input.role !== "ADMIN") {
      if (id === actor.id) return fail("No puedes quitarte a ti mismo el rol de administrador.");
      if (current.isActive && (await otherActiveAdmins(tx, id)) === 0) return fail("Debe quedar al menos un administrador activo.");
    }

    const changedFields = [
      input.name !== current.name && "name",
      input.email !== current.email && "email",
      input.role !== current.role && "role",
      input.hireDate !== current.hireDate.toISOString().slice(0, 10) && "hireDate",
    ].filter(Boolean);

    await tx.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        hireDate: toUTCDate(input.hireDate),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "employee.updated",
      entityType: "User",
      entityId: id,
      metadata: { changed: changedFields, passwordReset: Boolean(passwordHash) },
    });
    return { ok: true };
  });
}

export async function setEmployeeActive(actor: CurrentUser, rawId: unknown, active: boolean): Promise<ServiceResult> {
  assertAdmin(actor);
  const id = idSchema.safeParse(rawId);
  if (!id.success) return fail("Empleado no válido.");

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: id.data } });
    if (!user) return fail("El empleado no existe.");
    if (!active) {
      if (user.id === actor.id) return fail("No puedes desactivarte a ti mismo.");
      if (user.role === "ADMIN" && user.isActive && (await otherActiveAdmins(tx, user.id)) === 0) return fail("Debe quedar al menos un administrador activo.");
    }
    await tx.user.update({ where: { id: user.id }, data: { isActive: active } });
    await writeAudit(tx, { actorId: actor.id, action: active ? "employee.activated" : "employee.deactivated", entityType: "User", entityId: user.id });
    return { ok: true };
  });
}

/** Ajuste manual (+/-) del saldo de un año. Nunca deja el saldo ya consumido en negativo. */
export async function adjustBalance(actor: CurrentUser, raw: unknown, today: ISODate = todayISO()): Promise<ServiceResult> {
  assertAdmin(actor);
  const parsed = adjustBalanceSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const { employeeId, year, days, reason } = parsed.data;

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);
    if (!(await tx.user.count({ where: { id: employeeId } }))) return fail("El empleado no existe.");

    const [balance] = await getYearBalances(tx, employeeId, [year], today);
    if (days < 0 && balance!.available + days < 0) {
      return fail(`El ajuste dejaría el saldo de ${year} en ${balance!.available + days}. Hay ${balance!.available} días disponibles.`);
    }
    const entry = await tx.ledgerEntry.create({ data: { employeeId, year, type: "ADJUSTMENT", days, reason, createdById: actor.id } });
    await writeAudit(tx, { actorId: actor.id, action: "balance.adjusted", entityType: "User", entityId: employeeId, metadata: { year, days, reason, ledgerEntryId: entry.id } });
    return { ok: true };
  });
}

/** Crea la asignación anual de la política vigente a todos los empleados activos que aún no la tienen. */
export async function allocateAnnualDays(actor: CurrentUser, rawYear: unknown): Promise<ServiceResult<{ created: number }>> {
  assertAdmin(actor);
  const year = yearSchema.safeParse(rawYear);
  if (!year.success) return fail("Año no válido.");

  return db.$transaction(async (tx) => {
    const policy = await tx.vacationPolicy.findFirst({
      where: { effectiveFrom: { lte: toUTCDate(`${year.data}-12-31`) } },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    if (!policy) return fail("No hay ninguna política vigente para ese año.");

    const employees = await tx.user.findMany({
      where: { role: "EMPLOYEE", isActive: true, ledgerEntries: { none: { year: year.data, type: "ALLOCATION" } } },
      select: { id: true },
    });
    if (employees.length > 0) {
      await tx.ledgerEntry.createMany({
        data: employees.map((e) => ({
          employeeId: e.id,
          year: year.data,
          type: "ALLOCATION" as const,
          days: policy.annualDays,
          reason: `Asignación anual ${year.data} (${policy.name})`,
          createdById: actor.id,
        })),
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "balance.annual_allocation",
      entityType: "VacationPolicy",
      entityId: policy.id,
      metadata: { year: year.data, employees: employees.length, annualDays: policy.annualDays },
    });
    return { ok: true, created: employees.length };
  });
}
