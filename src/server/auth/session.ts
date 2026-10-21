import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LOGIN_PATH, roleHomePath, type AppRole } from "@/features/auth/access";
import { db } from "@/server/db/client";
import { ForbiddenError } from "./errors";

export { ForbiddenError };

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

/**
 * Usuario autenticado, releído de la base de datos en cada petición: si se desactiva
 * o cambia de rol, el efecto es inmediato aunque su JWT siga vigente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Para páginas y layouts: redirige si el rol no coincide. */
export async function requireRole(role: AppRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(roleHomePath(user.role));
  return user;
}

/** Para server actions y servicios: lanza en vez de redirigir. */
export async function assertRole(role: AppRole): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== role) throw new ForbiddenError();
  return user;
}
