import "server-only";
import { db } from "@/server/db/client";

/**
 * Limitador de intentos de login fallidos por email, guardado en PostgreSQL para que
 * valga con varias instancias y sobreviva a reinicios. Tras MAX_FAILURES fallos dentro de la
 * ventana, el email queda bloqueado hasta que la ventana expira.
 *
 * Compromiso conocido: un atacante que conozca un email puede bloquearlo durante la ventana
 * (denegación de servicio sobre una cuenta). Se acepta a cambio de frenar el ataque de fuerza bruta;
 * un límite por IP en el proxy inverso lo complementaría.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

export async function isLockedOut(key: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT ("count" >= ${MAX_FAILURES} AND "windowStart" > now() - make_interval(mins => ${WINDOW_MINUTES})) AS locked
    FROM "LoginThrottle" WHERE "key" = ${key}`;
  return rows[0]?.locked ?? false;
}

/** Incrementa el contador de forma atómica; reinicia la ventana si la anterior ya expiró. */
export async function recordFailure(key: string): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "LoginThrottle" ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "LoginThrottle"."windowStart" <= now() - make_interval(mins => ${WINDOW_MINUTES}) THEN 1 ELSE "LoginThrottle"."count" + 1 END,
      "windowStart" = CASE WHEN "LoginThrottle"."windowStart" <= now() - make_interval(mins => ${WINDOW_MINUTES}) THEN now() ELSE "LoginThrottle"."windowStart" END`;
}

export async function clearFailures(key: string): Promise<void> {
  await db.loginThrottle.deleteMany({ where: { key } });
}
