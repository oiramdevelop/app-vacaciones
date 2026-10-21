import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/errors";
import { addHoliday, createPolicy, createUser, ledgerSum, resetDb, TODAY, YEAR } from "../../../tests/helpers";
import { getYearBalances } from "./queries";
import { cancelOwnRequest, createVacationRequest } from "./request-service";

const req = (startDate: string, endDate: string, reason = "") => ({ startDate, endDate, reason });
const errorsOf = (r: { ok: boolean; errors?: string[] }) => (r.ok ? "" : (r.errors ?? []).join(" | "));

beforeEach(async () => {
  await resetDb();
  await createPolicy();
});

describe("createVacationRequest", () => {
  it("crea una solicitud pendiente excluyendo fines de semana y festivos", async () => {
    await addHoliday("2026-11-03");
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });

    // 2 nov (lun) a 13 nov (vie): 10 laborables, menos el festivo del 3.
    const result = await createVacationRequest(actor, req("2026-11-02", "2026-11-13", "Viaje"), TODAY);
    expect(result.ok).toBe(true);

    const saved = await db.vacationRequest.findFirstOrThrow({ where: { employeeId: actor.id } });
    expect(saved.status).toBe("PENDING");
    expect(saved.totalDays).toBe(9);
    expect(saved.startDate.toISOString().slice(0, 10)).toBe("2026-11-02"); // fecha de calendario, sin desfase
    expect((saved.policySnapshot as { daysByYear: Record<string, number> }).daysByYear).toEqual({ "2026": 9 });
    expect(await db.auditLog.count({ where: { action: "vacation.request.created", actorId: actor.id } })).toBe(1);
  });

  it("no toca el libro mayor mientras está pendiente, pero reserva el saldo", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY);

    expect(await ledgerSum(actor.id)).toBe(22);
    const [balance] = await getYearBalances(db, actor.id, [YEAR], TODAY);
    expect(balance).toMatchObject({ assigned: 22, pending: 5, available: 17 });
  });

  it("rechaza periodos solapados con solicitudes pendientes o aprobadas, y permite los adyacentes", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    expect((await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY)).ok).toBe(true);

    const overlap = await createVacationRequest(actor, req("2026-11-06", "2026-11-10"), TODAY);
    expect(errorsOf(overlap)).toContain("solapa");

    expect((await createVacationRequest(actor, req("2026-11-09", "2026-11-10"), TODAY)).ok).toBe(true);
  });

  it("un periodo cancelado o rechazado ya no bloquea las fechas", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    const first = await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY);
    if (!first.ok) throw new Error("setup");
    await cancelOwnRequest(actor, first.id);

    expect((await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY)).ok).toBe(true);
  });

  it("rechaza si supera el saldo disponible y permite gastarlo exactamente", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 5 });
    expect(errorsOf(await createVacationRequest(actor, req("2026-11-02", "2026-11-09"), TODAY))).toContain("Saldo insuficiente");
    expect((await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY)).ok).toBe(true);
    expect(errorsOf(await createVacationRequest(actor, req("2026-11-09", "2026-11-09"), TODAY))).toContain("Saldo insuficiente");
  });

  it("rechaza fechas pasadas, inversas y periodos sin días computables", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    expect(errorsOf(await createVacationRequest(actor, req("2026-10-01", "2026-10-02"), TODAY))).toContain("pasada");
    expect(errorsOf(await createVacationRequest(actor, req("2026-11-10", "2026-11-02"), TODAY))).toContain("anterior o igual");
    expect(errorsOf(await createVacationRequest(actor, req("2026-11-07", "2026-11-08"), TODAY))).toContain("ningún día computable");
    expect((await createVacationRequest(actor, { startDate: "no-es-fecha", endDate: "2026-11-02", reason: "" }, TODAY)).ok).toBe(false);
    expect(await db.vacationRequest.count()).toBe(0);
  });

  it("valida el saldo de cada año cuando el periodo cruza el fin de año", async () => {
    await addHoliday("2027-01-01");
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });

    // Sin asignación para 2027: el tramo de enero no tiene saldo.
    const without = await createVacationRequest(actor, req("2026-12-28", "2027-01-08"), TODAY);
    expect(errorsOf(without)).toContain("2027");

    await db.ledgerEntry.create({ data: { employeeId: actor.id, year: 2027, type: "ALLOCATION", days: 22 } });
    const withBalance = await createVacationRequest(actor, req("2026-12-28", "2027-01-08"), TODAY);
    expect(withBalance.ok).toBe(true);

    const saved = await db.vacationRequest.findFirstOrThrow({ where: { employeeId: actor.id } });
    expect(saved.totalDays).toBe(9);
    expect((saved.policySnapshot as { daysByYear: Record<string, number> }).daysByYear).toEqual({ "2026": 4, "2027": 5 });

    const [b2026, b2027] = await getYearBalances(db, actor.id, [2026, 2027], TODAY);
    expect(b2026!.pending).toBe(4);
    expect(b2027!.pending).toBe(5);
  });

  it("peticiones simultáneas solapadas: sólo una se crea", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    const results = await Promise.all([
      createVacationRequest(actor, req("2026-11-30", "2026-12-04"), TODAY),
      createVacationRequest(actor, req("2026-12-02", "2026-12-04"), TODAY),
      createVacationRequest(actor, req("2026-12-04", "2026-12-08"), TODAY),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.vacationRequest.count()).toBe(1);
  });

  it("peticiones simultáneas que juntas superan el saldo: no hay sobreventa", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 18 });
    const results = await Promise.all([
      createVacationRequest(actor, req("2026-11-02", "2026-11-13"), TODAY), // 10
      createVacationRequest(actor, req("2026-11-16", "2026-11-27"), TODAY), // 10
      createVacationRequest(actor, req("2026-12-01", "2026-12-04"), TODAY), // 4
    ]);
    const [balance] = await getYearBalances(db, actor.id, [YEAR], TODAY);
    expect(balance!.available).toBeGreaterThanOrEqual(0);
    expect(balance!.pending).toBeLessThanOrEqual(18);
    expect(results.filter((r) => r.ok).length).toBeGreaterThanOrEqual(1);
  });

  it("un administrador no puede solicitar vacaciones", async () => {
    const { actor } = await createUser("ADMIN", "Root");
    await expect(createVacationRequest(actor, req("2026-11-02", "2026-11-03"), TODAY)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("si la política no requiere aprobación, la solicitud nace aprobada y descuenta el saldo", async () => {
    await resetDb();
    await createPolicy({ requiresApproval: false });
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });

    const result = await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY);
    expect(result).toMatchObject({ ok: true, autoApproved: true });
    expect(await ledgerSum(actor.id)).toBe(17);
    expect(await db.auditLog.count({ where: { action: "vacation.request.auto_approved" } })).toBe(1);
  });

  it("cambiar la política no altera las solicitudes ya creadas", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    await createVacationRequest(actor, req("2026-11-02", "2026-11-13"), TODAY); // 10 laborables
    const before = await db.vacationRequest.findFirstOrThrow({ where: { employeeId: actor.id } });

    // Nueva versión: días naturales.
    await createPolicy({ name: "Naturales", calculationType: "CALENDAR_DAYS", effectiveFrom: new Date("2026-10-01T00:00:00Z"), isDefault: false });

    const after = await db.vacationRequest.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.totalDays).toBe(10);
    expect((after.policySnapshot as { calculationType: string }).calculationType).toBe("WORKING_DAYS");

    // La nueva política sí se aplica a solicitudes nuevas.
    const next = await createVacationRequest(actor, req("2026-12-01", "2026-12-07"), TODAY);
    expect(next.ok).toBe(true);
    const created = await db.vacationRequest.findFirstOrThrow({ where: { employeeId: actor.id }, orderBy: { startDate: "desc" } });
    expect(created.totalDays).toBe(7);
  });
});

describe("cancelOwnRequest", () => {
  it("cancela una solicitud propia pendiente y libera el saldo reservado", async () => {
    const { actor } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    const created = await createVacationRequest(actor, req("2026-11-02", "2026-11-06"), TODAY);
    if (!created.ok) throw new Error("setup");

    expect((await cancelOwnRequest(actor, created.id)).ok).toBe(true);
    const [balance] = await getYearBalances(db, actor.id, [YEAR], TODAY);
    expect(balance).toMatchObject({ pending: 0, available: 22 });
    expect(await db.auditLog.count({ where: { action: "vacation.request.cancelled" } })).toBe(1);
  });

  it("no permite cancelar solicitudes de otro empleado, ya canceladas o aprobadas", async () => {
    const { actor: ana } = await createUser("EMPLOYEE", "Ana", { allocate: 22 });
    const { actor: luis } = await createUser("EMPLOYEE", "Luis", { allocate: 22 });
    const created = await createVacationRequest(ana, req("2026-11-02", "2026-11-06"), TODAY);
    if (!created.ok) throw new Error("setup");

    expect((await cancelOwnRequest(luis, created.id)).ok).toBe(false);
    expect((await db.vacationRequest.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("PENDING");

    expect((await cancelOwnRequest(ana, created.id)).ok).toBe(true);
    expect((await cancelOwnRequest(ana, created.id)).ok).toBe(false);

    const approved = await db.vacationRequest.create({
      data: {
        employeeId: ana.id,
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-02T00:00:00Z"),
        totalDays: 2,
        status: "APPROVED",
        policyId: (await db.vacationPolicy.findFirstOrThrow()).id,
        policySnapshot: {},
      },
    });
    expect((await cancelOwnRequest(ana, approved.id)).ok).toBe(false);
  });

  it("un administrador no puede usar la cancelación de empleado", async () => {
    const { actor } = await createUser("ADMIN", "Root");
    await expect(cancelOwnRequest(actor, "cualquiera")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
