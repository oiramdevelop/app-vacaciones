import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { resetDb } from "../../../tests/helpers";
import { clearFailures, isLockedOut, MAX_FAILURES, recordFailure } from "./login-throttle";

beforeEach(resetDb);

describe("login throttle", () => {
  it("bloquea al alcanzar el máximo de fallos y no afecta a otros emails", async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure("a@test.local");
    expect(await isLockedOut("a@test.local")).toBe(false);
    await recordFailure("a@test.local");
    expect(await isLockedOut("a@test.local")).toBe(true);
    expect(await isLockedOut("b@test.local")).toBe(false);
  });

  it("cuenta correctamente los fallos simultáneos", async () => {
    await Promise.all(Array.from({ length: 8 }, () => recordFailure("c@test.local")));
    const row = await db.loginThrottle.findUniqueOrThrow({ where: { key: "c@test.local" } });
    expect(row.count).toBe(8);
  });

  it("un login correcto reinicia el contador", async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure("d@test.local");
    await clearFailures("d@test.local");
    expect(await isLockedOut("d@test.local")).toBe(false);
  });

  it("el bloqueo expira al terminar la ventana y el siguiente fallo reinicia la cuenta", async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordFailure("e@test.local");
    await db.$executeRaw`UPDATE "LoginThrottle" SET "windowStart" = now() - interval '16 minutes' WHERE "key" = 'e@test.local'`;
    expect(await isLockedOut("e@test.local")).toBe(false);

    await recordFailure("e@test.local");
    expect((await db.loginThrottle.findUniqueOrThrow({ where: { key: "e@test.local" } })).count).toBe(1);
  });
});
