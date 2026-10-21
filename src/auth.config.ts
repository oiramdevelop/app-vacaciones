import type { NextAuthConfig } from "next-auth";
import { decideAccess, LOGIN_PATH, type AppRole } from "@/features/auth/access";

/**
 * Configuración de Auth.js sin dependencias de base de datos (la usa el proxy).
 * El proxy es sólo una primera barrera: la autorización real se vuelve a comprobar
 * en servidor con `requireUser` / `requireRole` contra la base de datos.
 */
export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 horas
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const role = (auth?.user?.role as AppRole | undefined) ?? null;
      const decision = decideAccess(request.nextUrl.pathname, role);
      if (decision.allow) return true;
      if (!role) return false; // Auth.js redirige a /login conservando callbackUrl
      return Response.redirect(new URL(decision.redirectTo, request.nextUrl));
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
