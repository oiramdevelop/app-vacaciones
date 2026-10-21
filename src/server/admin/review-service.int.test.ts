import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/errors";
import { getYearBalances } from "@/server/vacations/queries";
import { createVacationRequest } from "@/server/vacations/request-service";
import { createPolicy, createUser, ledgerSum, resetDb, TODAY, YEAR } from "../../../tests/helpers";
import { approveRequest, cancelApprovedRequest, rejectRequest } from "./review-service";

const req = (startDate: string, endDate: string) => ({ startDate, endDate, reason: "" });

async function pendingRequest(actor: Parameters<typeof createVacationRequest>[0], start: string, end: string) {
  const r = await createVacationRequest(actor, req(start, end), TODAY);
  if (!r.ok) throw new Error(`setup: ${r.errors.join(",")}`);
  return r.id;
}

let admin: Awaited<ReturnType<typeof createUser>>["actor"];
let ana: Awaited<ReturnType<typeof createUser>>["actor"];

beforeEach(async () => {
  await resetDb();
  await createPolicy();
  admin = (await createUser("ADMIN", "Root")).actor;
  ana = (await createUser("EMPLOYEE", "Ana", { allocate: 22 })).actor;
});

describe("approveRequest", () => {
  it("aprueba, descuenta el saldo y deja auditoría", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    expect((await approveRequest(admin, id, TODAY)).ok).toBe(true);

    const request = await db.vacationRequest.findUniqueOrThrow({ where: { id } });
    expect(request).toMatchObject({ status: "APPROVED", reviewedById: admin.id });
    expect(request.reviewedAt).not.toBeNull();
    expect(await ledgerSum(ana.id)).toBe(17);

    const [balance] = await getYearBalances(db, ana.id, [YEAR], TODAY);
    expect(balance).toMatchObject({ pending: 0, committed: 5, available: 17 });
    expect(await db.auditLog.count({ where: { action: "vacation.request.approved", entityId: id } })).toBe(1);
  });

  it("aprobaciones simultáneas de la misma solicitud: un solo descuento", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    const results = await Promise.all([1, 2, 3, 4].map(() => approveRequest(admin, id, TODAY)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.ledgerEntry.count({ where: { requestId: id, type: "CONSUMPTION" } })).toBe(1);
    expect(await ledgerSum(ana.id)).toBe(17);
  });

  it("aprobar y rechazar a la vez: gana uno y el libro es coherente", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    const results = await Promise.all([approveRequest(admin, id, TODAY), rejectRequest(admin, id, "No es posible")]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const { status } = await db.vacationRequest.findUniqueOrThrow({ where: { id } });
    const consumptions = await db.ledgerEntry.count({ where: { requestId: id, type: "CONSUMPTION" } });
    expect(consumptions).toBe(status === "APPROVED" ? 1 : 0);
    expect(await ledgerSum(ana.id)).toBe(status === "APPROVED" ? 17 : 22);
  });

  it("aprobar varias solicitudes del mismo empleado a la vez respeta el saldo", async () => {
    const a = await pendingRequest(ana, "2026-11-02", "2026-11-13"); // 10
    const b = await pendingRequest(ana, "2026-11-16", "2026-11-27"); // 10
    const results = await Promise.all([approveRequest(admin, a, TODAY), approveRequest(admin, b, TODAY)]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await ledgerSum(ana.id)).toBe(2);
  });

  it("no aprueba si el saldo del empleado ha quedado negativo", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-13"); // 10 de 22
    await db.ledgerEntry.create({ data: { employeeId: ana.id, year: YEAR, type: "ADJUSTMENT", days: -15 } }); // 22-15=7 < 10

    const result = await approveRequest(admin, id, TODAY);
    expect(result).toMatchObject({ ok: false });
    expect((await db.vacationRequest.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  });

  it("reparte el consumo por año cuando el periodo cruza el fin de año", async () => {
    await db.ledgerEntry.create({ data: { employeeId: ana.id, year: 2027, type: "ALLOCATION", days: 22 } });
    const id = await pendingRequest(ana, "2026-12-28", "2027-01-08"); // 4 + 6 (sin festivos en este test)
    expect((await approveRequest(admin, id, TODAY)).ok).toBe(true);

    const entries = await db.ledgerEntry.findMany({ where: { requestId: id }, orderBy: { year: "asc" } });
    expect(entries.map((e) => [e.year, e.days])).toEqual([
      [2026, -4],
      [2027, -6],
    ]);
  });

  it("no aprueba solicitudes inexistentes ni ya resueltas", async () => {
    expect((await approveRequest(admin, "no-existe", TODAY)).ok).toBe(false);
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await rejectRequest(admin, id, "Motivo");
    expect((await approveRequest(admin, id, TODAY)).ok).toBe(false);
  });

  it("sólo un administrador puede aprobar", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await expect(approveRequest(ana, id, TODAY)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.vacationRequest.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  });
});

describe("rejectRequest", () => {
  it("rechaza guardando el motivo y sin tocar el libro", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    expect((await rejectRequest(admin, id, "Cierre de trimestre")).ok).toBe(true);

    const request = await db.vacationRequest.findUniqueOrThrow({ where: { id } });
    expect(request).toMatchObject({ status: "REJECTED", rejectionReason: "Cierre de trimestre", reviewedById: admin.id });
    expect(await ledgerSum(ana.id)).toBe(22);
  });

  it("libera las fechas y el saldo reservado", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await rejectRequest(admin, id, "No");
    const [balance] = await getYearBalances(db, ana.id, [YEAR], TODAY);
    expect(balance!.available).toBe(22);
    expect((await createVacationRequest(ana, req("2026-11-02", "2026-11-06"), TODAY)).ok).toBe(true);
  });

  it("no rechaza dos veces ni solicitudes aprobadas, y sólo un admin puede hacerlo", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await approveRequest(admin, id, TODAY);
    expect((await rejectRequest(admin, id, "Tarde")).ok).toBe(false);
    await expect(rejectRequest(ana, id, "Yo mismo")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("cancelApprovedRequest", () => {
  it("devuelve los días con movimientos REFUND y es idempotente", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await approveRequest(admin, id, TODAY);
    expect(await ledgerSum(ana.id)).toBe(17);

    expect((await cancelApprovedRequest(admin, id, TODAY)).ok).toBe(true);
    expect(await ledgerSum(ana.id)).toBe(22);
    expect(await db.ledgerEntry.count({ where: { requestId: id, type: "REFUND" } })).toBe(1);

    expect((await cancelApprovedRequest(admin, id, TODAY)).ok).toBe(false);
    expect(await ledgerSum(ana.id)).toBe(22);
  });

  it("cancelaciones simultáneas devuelven los días una sola vez", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await approveRequest(admin, id, TODAY);
    const results = await Promise.all([1, 2, 3].map(() => cancelApprovedRequest(admin, id, TODAY)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await ledgerSum(ana.id)).toBe(22);
  });

  it("devuelve cada año por separado en periodos que cruzan el fin de año", async () => {
    await db.ledgerEntry.create({ data: { employeeId: ana.id, year: 2027, type: "ALLOCATION", days: 22 } });
    const id = await pendingRequest(ana, "2026-12-28", "2027-01-08");
    await approveRequest(admin, id, TODAY);
    await cancelApprovedRequest(admin, id, TODAY);

    expect(await ledgerSum(ana.id, 2026)).toBe(22);
    expect(await ledgerSum(ana.id, 2027)).toBe(22);
  });

  it("no cancela vacaciones ya terminadas ni solicitudes no aprobadas, y exige ser admin", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    expect((await cancelApprovedRequest(admin, id, TODAY)).ok).toBe(false); // sigue pendiente
    await approveRequest(admin, id, TODAY);
    expect((await cancelApprovedRequest(admin, id, "2026-12-01")).ok).toBe(false); // ya terminó
    await expect(cancelApprovedRequest(ana, id, TODAY)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("garantías a nivel de base de datos", () => {
  it("el índice único impide un segundo descuento del mismo año para una solicitud", async () => {
    const id = await pendingRequest(ana, "2026-11-02", "2026-11-06");
    await approveRequest(admin, id, TODAY);

    await expect(
      db.ledgerEntry.create({ data: { employeeId: ana.id, year: YEAR, type: "CONSUMPTION", days: -5, requestId: id } }),
    ).rejects.toThrow();
    expect(await ledgerSum(ana.id)).toBe(17);
  });

  it("la restricción de exclusión impide solapes PENDING/APPROVED aunque se salte el servicio", async () => {
    const policy = await db.vacationPolicy.findFirstOrThrow();
    const base = { employeeId: ana.id, totalDays: 3, policyId: policy.id, policySnapshot: {} };
    await db.vacationRequest.create({ data: { ...base, startDate: new Date("2026-11-02T00:00:00Z"), endDate: new Date("2026-11-04T00:00:00Z") } });

    await expect(
      db.vacationRequest.create({ data: { ...base, startDate: new Date("2026-11-04T00:00:00Z"), endDate: new Date("2026-11-06T00:00:00Z") } }),
    ).rejects.toThrow();

    // Una solicitud cancelada no bloquea.
    await db.vacationRequest.create({
      data: { ...base, status: "CANCELLED", startDate: new Date("2026-11-03T00:00:00Z"), endDate: new Date("2026-11-03T00:00:00Z") },
    });
  });

  it("la BD rechaza fechas invertidas", async () => {
    const policy = await db.vacationPolicy.findFirstOrThrow();
    await expect(
      db.vacationRequest.create({
        data: { employeeId: ana.id, totalDays: 1, policyId: policy.id, policySnapshot: {}, startDate: new Date("2026-11-06T00:00:00Z"), endDate: new Date("2026-11-02T00:00:00Z") },
      }),
    ).rejects.toThrow();
  });
});
