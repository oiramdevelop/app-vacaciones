import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestión de vacaciones",
    short_name: "Vacaciones",
    description: "Solicita y consulta tus vacaciones.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0133c0",
    theme_color: "#0b1a33",
    icons: [
      { src: "/pwa-icon/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
