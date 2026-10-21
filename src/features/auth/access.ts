/** Reglas de acceso puras (sin dependencias de servidor), reutilizables en proxy, layouts y tests. */

export type AppRole = "EMPLOYEE" | "ADMIN";

export const LOGIN_PATH = "/login";

export function roleHomePath(role: AppRole): string {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export type AccessDecision = { allow: true } | { allow: false; redirectTo: string };

/** Decisión de acceso para una ruta dada la sesión (null = sin sesión). */
export function decideAccess(pathname: string, role: AppRole | null): AccessDecision {
  if (pathname === LOGIN_PATH) return { allow: true };
  if (!role) return { allow: false, redirectTo: LOGIN_PATH };
  if (isAdminPath(pathname) && role !== "ADMIN") return { allow: false, redirectTo: roleHomePath(role) };
  return { allow: true };
}

/** Sólo se aceptan rutas internas como destino tras el login (evita open redirects). */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
