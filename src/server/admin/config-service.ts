import "server-only";
import { db } from "@/server/db/client";
import { fail, writeAudit, type ServiceResult } from "@/server/db/tx";
import { ForbiddenError } from "@/server/auth/errors";
import type { CurrentUser } from "@/server/auth/session";
import { toUTCDate } from "@/features/vacations/domain/dates";
import { holidaySchema, idSchema, policySchema } from "@/features/admin/schemas";

function assertAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}
const firstIssue = (e: { issues: { message: string }[] }) => fail(...e.issues.map((i) => i.message));

/**
 * Las políticas no se editan: cada cambio crea una versión nueva con su `effectiveFrom`.
 * Las solicitudes existentes conservan el snapshot con el que se calcularon.
 */
export async function savePolicyVersion(actor: CurrentUser, raw: unknown): Promise<ServiceResult<{ id: string }>> {
  assertAdmin(actor);
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const p = parsed.data;

  return db.$transaction(async (tx) => {
    const created = await tx.vacationPolicy.create({
      data: {
        name: p.name,
        annualDays: p.annualDays,
        calculationType: p.calculationType,
        workingWeekdays: [...p.workingWeekdays].sort(),
        excludeHolidays: p.excludeHolidays,
        allowFutureRequests: p.allowFutureRequests,
        maxAdvanceDays: p.maxAdvanceDays,
        minNoticeDays: p.minNoticeDays,
        requiresApproval: p.requiresApproval,
        holidayRegion: p.holidayRegion || null,
        effectiveFrom: toUTCDate(p.effectiveFrom),
      },
    });
    await writeAudit(tx, { actorId: actor.id, action: "policy.version_created", entityType: "VacationPolicy", entityId: created.id, metadata: { ...p } });
    return { ok: true, id: created.id };
  });
}

export async function addHoliday(actor: CurrentUser, raw: unknown): Promise<ServiceResult> {
  assertAdmin(actor);
  const parsed = holidaySchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const { date, name, region } = parsed.data;

  return db.$transaction(async (tx) => {
    const existing = await tx.holiday.findUnique({ where: { date_region: { date: toUTCDate(date), region } } });
    if (existing) return fail("Ya hay un festivo en esa fecha para esa región.");
    const created = await tx.holiday.create({ data: { date: toUTCDate(date), name, region } });
    await writeAudit(tx, { actorId: actor.id, action: "holiday.created", entityType: "Holiday", entityId: created.id, metadata: { date, name, region } });
    return { ok: true };
  });
}

export async function removeHoliday(actor: CurrentUser, rawId: unknown): Promise<ServiceResult> {
  assertAdmin(actor);
  const id = idSchema.safeParse(rawId);
  if (!id.success) return fail("Festivo no válido.");

  return db.$transaction(async (tx) => {
    const holiday = await tx.holiday.findUnique({ where: { id: id.data } });
    if (!holiday) return fail("El festivo no existe.");
    await tx.holiday.delete({ where: { id: holiday.id } });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "holiday.deleted",
      entityType: "Holiday",
      entityId: holiday.id,
      metadata: { date: holiday.date.toISOString().slice(0, 10), name: holiday.name },
    });
    return { ok: true };
  });
}
