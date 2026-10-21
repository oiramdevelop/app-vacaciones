import { describe, expect, it } from "vitest";
import { decideAccess, safeCallbackUrl } from "./access";

describe("decideAccess", () => {
  it("permite /login sin sesión", () => {
    expect(decideAccess("/login", null)).toEqual({ allow: true });
  });

  it("redirige a /login si no hay sesión", () => {
    expect(decideAccess("/dashboard", null)).toEqual({ allow: false, redirectTo: "/login" });
    expect(decideAccess("/admin/empleados", null)).toEqual({ allow: false, redirectTo: "/login" });
  });

  it("impide a un empleado acceder a /admin y subrutas", () => {
    expect(decideAccess("/admin", "EMPLOYEE")).toEqual({ allow: false, redirectTo: "/dashboard" });
    expect(decideAccess("/admin/solicitudes", "EMPLOYEE")).toEqual({ allow: false, redirectTo: "/dashboard" });
  });

  it("no confunde rutas con prefijo parecido a /admin", () => {
    expect(decideAccess("/administracion", "EMPLOYEE")).toEqual({ allow: true });
  });

  it("permite a un admin entrar en /admin", () => {
    expect(decideAccess("/admin/configuracion", "ADMIN")).toEqual({ allow: true });
  });
});

describe("safeCallbackUrl", () => {
  it("acepta rutas internas", () => {
    expect(safeCallbackUrl("/vacaciones/solicitar")).toBe("/vacaciones/solicitar");
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "", null, undefined])(
    "rechaza %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/");
    },
  );
});
