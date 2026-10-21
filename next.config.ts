import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // CSP parcial y segura: restringe lo que no afecta a scripts ni estilos (clickjacking, <base>, formularios, plugins).
  // Una CSP completa con nonce no se ha activado: requiere validarla en navegador.
  { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
  // HSTS sólo en producción: en desarrollo (http://localhost) no debe fijarse.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Genera .next/standalone: un servidor mínimo con sólo las dependencias necesarias (imagen Docker pequeña).
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // El service worker no debe cachearse, para que las actualizaciones lleguen.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
