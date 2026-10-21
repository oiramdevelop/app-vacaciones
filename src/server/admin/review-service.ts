import "server-only";
import { db } from "@/server/db/client";
import { fail, lockEmployee, writeAudit, type ServiceResult } from "@/server/db/tx";
import { ForbiddenError } from "@/server/auth/errors";
import type { CurrentUser } from "@/server/auth/session";
import { fromUTCDate, type ISODate } from "@/features/vacations/domain/dates";
import { getYearBalances } from "@/server/vacations/queries";
import { daysByYearOf } from "@/server/vacations/snapshot";
import { todayISO } from "@/server/vacations/today";

const STATUS_LABEL = { PENDING: "pendiente", APPROVED: "aprobada", REJECTED: "rechazada", CANCELLED: "cancelada" } as const;

function assertAdmin(actor: CurrentUser) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
}

async function employeeOf(requestId: string): Promise<string | null> {
  const r = await db.vacationRequest.findUnique({ where: { id: requestId }, select: { employeeId: true } });
  return r?.employeeId ?? null;
}

/**
 * Aprobar: transacción que bloquea al empleado, relee el estado y descuenta el saldo.
 * Garantías: (1) sólo transita PENDING → APPROVED una vez (updateMany condicionado),
 * (2) el índice único del libro (requestId, type, year) impide un doble descuento,
 * (3) no se aprueba si el saldo del empleado ha quedado en negativo.
 */
export async function approveRequest(actor: CurrentUser, requestId: string, today: ISODate = todayISO()): Promise<ServiceResult> {
  assertAdmin(actor);
  const employeeId = await employeeOf(requestId);
  if (!employeeId) return fail("La solicitud no existe.");

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);

    const request = await tx.vacationRequest.findUnique({ where: { id: requestId } });
    if (!request) return fail("La solicitud no existe.");
    if (request.status !== "PENDING") return fail(`La solicitud ya no está pendiente (estado actual: ${STATUS_LABEL[request.status]}).`);

    const byYear = daysByYearOf(request);
    const balances = await getYearBalances(tx, employeeId, Object.keys(byYear).map(Number), today);
    // Los días de esta solicitud ya figuran como pendientes, por lo que "disponible" ya los descuenta:
    // si es negativo, el empleado está sobrecomprometido (p. ej. tras un ajuste a la baja).
    const overbooked = balances.find((b) => b.available < 0);
    if (overbooked) return fail(`Saldo insuficiente en ${overbooked.year}: faltan ${-overbooked.available} días para aprobarla.`);

    const { count } = await tx.vacationRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: null },
    });
    if (count === 0) return fail("La solicitud ha cambiado de estado mientras se procesaba.");

    await tx.ledgerEntry.createMany({
      data: Object.entries(byYear).map(([year, days]) => ({
        employeeId,
        year: Number(year),
        type: "CONSUMPTION" as const,
        days: -days,
        requestId,
        reason: "Solicitud aprobada",
        createdById: actor.id,
      })),
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "vacation.request.approved",
      entityType: "VacationRequest",
      entityId: requestId,
      metadata: { employeeId, totalDays: request.totalDays, daysByYear: byYear },
    });
    return { ok: true };
  });
}

export async function rejectRequest(actor: CurrentUser, requestId: string, reason: string): Promise<ServiceResult> {
  assertAdmin(actor);
  const employeeId = await employeeOf(requestId);
  if (!employeeId) return fail("La solicitud no existe.");

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);

    const { count } = await tx.vacationRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: reason },
    });
    if (count === 0) {
      const current = await tx.vacationRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      return fail(`La solicitud ya no está pendiente (estado actual: ${current ? STATUS_LABEL[current.status] : "inexistente"}).`);
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "vacation.request.rejected",
      entityType: "VacationRequest",
      entityId: requestId,
      metadata: { employeeId, reason },
    });
    return { ok: true };
  });
}

/** Cancela una solicitud aprobada que no ha terminado y devuelve los días con movimientos REFUND. */
export async function cancelApprovedRequest(actor: CurrentUser, requestId: string, today: ISODate = todayISO()): Promise<ServiceResult> {
  assertAdmin(actor);
  const employeeId = await employeeOf(requestId);
  if (!employeeId) return fail("La solicitud no existe.");

  return db.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);

    const request = await tx.vacationRequest.findUnique({ where: { id: requestId }, include: { ledgerEntries: true } });
    if (!request) return fail("La solicitud no existe.");
    if (request.status !== "APPROVED") return fail("Sólo se pueden cancelar solicitudes aprobadas.");
    if (fromUTCDate(request.endDate) < today) return fail("No se puede cancelar unas vacaciones que ya han terminado.");

    const { count } = await tx.vacationRequest.updateMany({ where: { id: requestId, status: "APPROVED" }, data: { status: "CANCELLED" } });
    if (count === 0) return fail("La solicitud ha cambiado de estado mientras se procesaba.");

    const consumptions = request.ledgerEntries.filter((e) => e.type === "CONSUMPTION");
    if (consumptions.length > 0) {
      await tx.ledgerEntry.createMany({
        data: consumptions.map((e) => ({
          employeeId,
          year: e.year,
          type: "REFUND" as const,
          days: -e.days,
          requestId,
          reason: "Cancelación de solicitud aprobada",
          createdById: actor.id,
        })),
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "vacation.request.approved_cancelled",
      entityType: "VacationRequest",
      entityId: requestId,
      metadata: { employeeId, refundedDays: consumptions.reduce((a, e) => a - e.days, 0) },
    });
    return { ok: true };
  });
}
