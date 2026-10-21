import { beforeEach, describe, expect, it, vi } from "vitest";

// Sólo se simula la sesión de Auth.js (el JWT); el usuario y su rol se leen de la BD real.
const sessionMock = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: string } } }));
vi.mock("@/auth", () => ({ auth: async () => sessionMock.current }));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

import { db } from "@/server/db/client";
import { ForbiddenError } from "@/server/auth/errors";
import { assertRole, getCurrentUser } from "@/server/auth/session";
import { createPolicy, createUser, resetDb } from "../../tests/helpers";
import * as adminActions from "@/features/admin/actions";
import * as vacationActions from "@/features/vacations/actions";

let admin: Awaited<ReturnType<typeof createUser>>["user"];
let ana: Awaited<ReturnType<typeof createUser>>["user"];
let requestId: string;

const signInAs = (user: { id: string; role: string } | null) => {
  sessionMock.current = user ? { user: { id: user.id, role: user.role } } : null;
};

/** Todas las acciones de administración con argumentos válidos de forma, para comprobar que ninguna se ejecuta. */
const adminCalls = () => ({
  approve: () => adminActions.approveRequestAction(requestId),
  reject: () => adminActions.rejectRequestAction({ requestId, reason: "Motivo" }),
  cancelApproved: () => adminActions.cancelApprovedRequestAction(requestId),
  createEmployee: () =>
    adminActions.createEmployeeAction({ name: "Intruso", email: "intruso@test.local", hireDate: "2026-01-01", role: "ADMIN", password: "contraseña-larga-1", initialDays: 99 }),
  updateEmployee: () =>
    adminActions.updateEmployeeAction({ id: ana.id, name: "X", email: ana.email, hireDate: "2020-01-01", role: "ADMIN", newPassword: "" }),
  setActive: () => adminActions.setEmployeeActiveAction(admin.id, false),
  adjust: () => adminActions.adjustBalanceAction({ employeeId: ana.id, year: 2026, days: 50, reason: "Intruso" }),
  allocate: () => adminActions.allocateAnnualDaysAction(2027),
  savePolicy: () =>
    adminActions.savePolicyAction({
      name: "Hack", annualDays: 365, calculationType: "CALENDAR_DAYS", workingWeekdays: [1], excludeHolidays: false,
      allowFutureRequests: true, maxAdvanceDays: null, minNoticeDays: 0, requiresApproval: false, holidayRegion: "", effectiveFrom: "2026-01-01",
    }),
  addHoliday: () => adminActions.addHolidayAction({ date: "2026-12-26", name: "X", region: "" }),
  removeHoliday: () => adminActions.removeHolidayAction("x"),
});

async function snapshotState() {
  const [users, requests, ledger, policies, audit] = await Promise.all([
    db.user.findMany({ orderBy: { id: "asc" } }),
    db.vacationRequest.findMany({ orderBy: { id: "asc" } }),
    db.ledgerEntry.count(),
    db.vacationPolicy.count(),
    db.auditLog.count(),
  ]);
  return JSON.stringify({ users, requests, ledger, policies, audit, holidays: await db.holiday.count() });
}

beforeEach(async () => {
  await resetDb();
  revalidate.mockClear();
  await createPolicy();
  admin = (await createUser("ADMIN", "Root")).user;
  ana = (await createUser("EMPLOYEE", "Ana", { allocate: 22 })).user;
  const created = await db.vacationRequest.create({
    data: {
      employeeId: ana.id,
      startDate: new Date("2026-11-02T00:00:00Z"),
      endDate: new Date("2026-11-06T00:00:00Z"),
      totalDays: 5,
      policyId: (await db.vacationPolicy.findFirstOrThrow()).id,
      policySnapshot: { daysByYear: { "2026": 5 } },
    },
  });
  requestId = created.id;
  signInAs(null);
});

describe("acceso no autorizado a acciones de administración", () => {
  it.each(Object.keys(adminCalls()))("sin sesión: %s es rechazada y no cambia nada", async (name) => {
    const before = await snapshotState();
    await expect(adminCalls()[name as keyof ReturnType<typeof adminCalls>]()).rejects.toBeInstanceOf(ForbiddenError);
    expect(await snapshotState()).toBe(before);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it.each(Object.keys(adminCalls()))("como empleado: %s es rechazada y no cambia nada", async (name) => {
    signInAs(ana);
    const before = await snapshotState();
    await expect(adminCalls()[name as keyof ReturnType<typeof adminCalls>]()).rejects.toBeInstanceOf(ForbiddenError);
    expect(await snapshotState()).toBe(before);
  });

  it("el rol se lee de la BD, no del JWT: un empleado con un token que dice ADMIN sigue sin poder", async () => {
    signInAs({ id: ana.id, role: "ADMIN" }); // JWT manipulado o desfasado
    expect(await getCurrentUser()).toMatchObject({ id: ana.id, role: "EMPLOYEE" });
    await expect(adminActions.approveRequestAction(requestId)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.vacationRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("PENDING");
  });

  it("un admin desactivado pierde el acceso aunque conserve un JWT válido", async () => {
    const { user: second } = await createUser("ADMIN", "Segundo");
    signInAs(second);
    expect((await adminActions.approveRequestAction(requestId)).ok).toBe(true);

    await db.user.update({ where: { id: second.id }, data: { isActive: false } });
    expect(await getCurrentUser()).toBeNull();
    await expect(adminActions.addHolidayAction({ date: "2026-12-26", name: "Tras desactivar", region: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("un usuario eliminado con JWT vigente no tiene acceso", async () => {
    const { user: ghost } = await createUser("ADMIN", "Fantasma");
    signInAs(ghost);
    await db.user.delete({ where: { id: ghost.id } });
    await expect(assertRole("ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("un administrador autenticado sí puede, y se refrescan las pantallas afectadas", async () => {
    signInAs(admin);
    expect((await adminActions.approveRequestAction(requestId)).ok).toBe(true);
    expect(revalidate).toHaveBeenCalledWith("/admin/solicitudes");
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("una acción fallida de negocio no refresca nada", async () => {
    signInAs(admin);
    const result = await adminActions.approveRequestAction("no-existe");
    expect(result.ok).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("acceso no autorizado a acciones de empleado", () => {
  it("sin sesión no se puede solicitar ni cancelar", async () => {
    await expect(vacationActions.createRequestAction({ startDate: "2026-12-01", endDate: "2026-12-02", reason: "" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(vacationActions.cancelRequestAction(requestId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("un administrador no puede solicitar vacaciones", async () => {
    signInAs(admin);
    await expect(vacationActions.createRequestAction({ startDate: "2026-12-01", endDate: "2026-12-02", reason: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("un empleado no puede cancelar la solicitud de otro", async () => {
    const { user: luis } = await createUser("EMPLOYEE", "Luis", { allocate: 22 });
    signInAs(luis);
    expect((await vacationActions.cancelRequestAction(requestId)).ok).toBe(false);
    expect((await db.vacationRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe("PENDING");
  });

  it("el propietario puede cancelar la suya", async () => {
    signInAs(ana);
    expect((await vacationActions.cancelRequestAction(requestId)).ok).toBe(true);
    expect(revalidate).toHaveBeenCalledWith("/vacaciones/mis-solicitudes");
  });

  it("una entrada malformada se rechaza con errores de validación, sin llegar a la BD", async () => {
    signInAs(ana);
    const result = await vacationActions.createRequestAction({ startDate: "2026-13-45", endDate: "x", reason: "a".repeat(600) });
    expect(result.ok).toBe(false);
    expect(await db.vacationRequest.count({ where: { employeeId: ana.id } })).toBe(1); // sólo la del setup
  });
});
