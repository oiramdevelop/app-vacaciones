import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/** Comparación contra un hash falso para que el tiempo de respuesta no revele si el email existe. */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(plain, await dummyHash);
  return false;
}
