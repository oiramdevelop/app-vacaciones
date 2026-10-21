import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Primera barrera (redirecciones rápidas). La autorización definitiva está en servidor: ver server/auth/session.ts.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Públicos a propósito: rutas de Auth.js, estáticos, health-check y recursos de la PWA (manifest, iconos, service worker).
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|sw.js|offline.html).*)"],
};
