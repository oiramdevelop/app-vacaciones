import "server-only";
import { db } from "@/server/db/client";
import { fail, lockEmployee, writeAudit, type ServiceResult } from "@/server/db/tx";
import { ForbiddenError } from "@/server/auth/errors";
import type { CurrentUser } from "@/server/auth/session";
import { fromUTCDate, toUTCDate, yearsBetween, type ISODate } from "@/features/vacations/domain/dates";
import { validateRequest } from "@/features/vacations/domain/validate-request";
import { requestInputSchema } from "@/features/vacations/schemas";
import { getHolidays, getPolicyForDate, getYearBalances } from "./queries";
import { todayISO } from "./today";

export type { ServiceResult };

export async function createVacationRequest(
  actor: CurrentUser,
  rawInput: unknown,
  today: ISODate = todayISO(),
): Promise<ServiceResult<{ id: string; autoApproved: boolean }>> {
  if (actor.role !== "EMPLOYEE") throw new ForbiddenError();

  const parsed = requestInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(...parsed.error.issues.map((i) => i.message));
  const { startDate, endDate, reason } = parsed.data;

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, actor.id);

    const policy = await getPolicyForDate(tx, startDate);
    const years = yearsBetween(startDate, endDate);
    const [holidays, active, balances] = await Promise.all([
      getHolidays(tx, startDate, endDate, policy.holidayRegion),
      tx.vacationRequest.findMany({
        where: {
          employeeId: actor.id,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lte: toUTCDate(endDate) },
          endDate: { gte: toUTCDate(startDate) },
        },
        select: { startDate: true, endDate: true },
      }),
      getYearBalances(tx, actor.id, years, today),
    ]);

    const result = validateRequest({
      startDate,
      endDate,
      today,
      rules: policy.rules,
      holidays: new Set(holidays.map((h) => h.date)),
      blockedRanges: active.map((r) => ({ start: fromUTCDate(r.startDate), end: fromUTCDate(r.endDate) })),
      availableByYear: Object.fromEntries(balances.map((b) => [b.year, b.available])),
    });
    if (!result.ok) return fail(...result.errors);

    // Si la política no exige aprobación, la solicitud nace aprobada y descuenta saldo al instante.
    const autoApproved = !policy.requiresApproval;
    const created = await tx.vacationRequest.create({
      data: {
        employeeId: actor.id,
        startDate: toUTCDate(startDate),
        endDate: toUTCDate(endDate),
        totalDays: result.totalDays,
        reason: reason || null,
        policyId: policy.id,
        status: autoApproved ? "APPROVED" : "PENDING",
        reviewedAt: autoApproved ? new Date() : null,
        // Copia de las reglas aplicadas y reparto por año: la solicitud conserva su significado
        // aunque la política cambie después.
        policySnapshot: { ...policy.rules, policyName: policy.name, daysByYear: result.daysByYear },
      },
    });
    if (autoApproved) {
      await tx.ledgerEntry.createMany({
        data: Object.entries(result.daysByYear).map(([year, days]) => ({
          employeeId: actor.id,
          year: Number(year),
          type: "CONSUMPTION" as const,
          days: -days,
          requestId: created.id,
          reason: "Aprobación automática según la política",
          createdById: actor.id,
        })),
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: autoApproved ? "vacation.request.auto_approved" : "vacation.request.created",
      entityType: "VacationRequest",
      entityId: created.id,
      metadata: { startDate, endDate, totalDays: result.totalDays },
    });
    return { ok: true, id: created.id, autoApproved };
  });
}

/** El empleado sólo puede cancelar sus propias solicitudes y sólo mientras están pendientes. */
export async function cancelOwnRequest(actor: CurrentUser, requestId: string): Promise<ServiceResult> {
  if (actor.role !== "EMPLOYEE") throw new ForbiddenError();

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, actor.id);

    // El filtro por estado hace la transición atómica: si un admin la aprueba a la vez, no se cancela.
    const { count } = await tx.vacationRequest.updateMany({
      where: { id: requestId, employeeId: actor.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (count === 0) return fail("No se puede cancelar: la solicitud no existe o ya no está pendiente.");

    await writeAudit(tx, { actorId: actor.id, action: "vacation.request.cancelled", entityType: "VacationRequest", entityId: requestId });
    return { ok: true };
  });
}
