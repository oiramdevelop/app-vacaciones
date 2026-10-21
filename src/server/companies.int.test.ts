import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { toUTCDate } from "@/features/vacations/domain/dates";
import { getAdminDashboard, listAllRequests, listEmployees } from "@/server/admin/queries";
import { listApprovedAbsences } from "@/server/vacations/queries";
import { createPolicy, createUser, resetDb, TODAY, YEAR } from "../../tests/helpers";

let flora: string;
let galactic: string;

async function addRequest(employeeId: string, policyId: string, status: "PENDING" | "APPROVED", start: string, end: string) {
  await db.vacationRequest.create({
    data: { employeeId, policyId, status, startDate: toUTCDate(start), endDate: toUTCDate(end), totalDays: 5, policySnapshot: {} },
  });
}

beforeEach(async () => {
  await resetDb();
  const policy = await createPolicy();
  flora = (await createUser("EMPLOYEE", "Flora Uno", { allocate: 22 })).user.id;
  galactic = (await createUser("EMPLOYEE", "Galactic Uno", { allocate: 22 })).user.id;
  await db.user.update({ where: { id: galactic }, data: { company: "GALACTICBLUM" } });

  await addRequest(flora, policy.id, "APPROVED", "2026-11-02", "2026-11-06");
  await addRequest(galactic, policy.id, "APPROVED", "2026-11-09", "2026-11-13");
  await addRequest(galactic, policy.id, "PENDING", "2026-12-14", "2026-12-18");
});

describe("filtro por empresa", () => {
  it("los usuarios nuevos pertenecen a Floramarket por defecto", async () => {
    expect((await db.user.findUniqueOrThrow({ where: { id: flora } })).company).toBe("FLORAMARKET");
  });

  it("el calendario sólo muestra ausencias de la empresa indicada", async () => {
    const window = { from: "2026-10-01", to: "2026-12-31" };
    expect(await listApprovedAbsences(db, window)).toHaveLength(2);
    const onlyGalactic = await listApprovedAbsences(db, window, { company: "GALACTICBLUM" });
    expect(onlyGalactic.map((a) => a.employeeName)).toEqual(["Galactic Uno"]);
  });

  it("empleados, solicitudes y panel respetan el filtro", async () => {
    expect((await listEmployees(db, YEAR, TODAY, "FLORAMARKET")).map((e) => e.name)).toEqual(["Flora Uno"]);
    expect(await listEmployees(db, YEAR, TODAY)).toHaveLength(2);

    const requests = await listAllRequests(db, { company: "GALACTICBLUM" }, TODAY);
    expect(requests).toHaveLength(2);
    expect(requests.every((r) => r.company === "GALACTICBLUM")).toBe(true);

    const flor = await getAdminDashboard(db, TODAY, "FLORAMARKET");
    expect(flor.stats).toMatchObject({ activeEmployees: 1, pendingCount: 0 });
    const all = await getAdminDashboard(db, TODAY);
    expect(all.stats).toMatchObject({ activeEmployees: 2, pendingCount: 1 });
  });
});
