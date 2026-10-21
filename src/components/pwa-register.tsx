"use client";

import { useEffect } from "react";

/** Registra el service worker sólo en producción (en desarrollo molestaría con cachés). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app funciona igual; sólo se pierde la instalación/pantalla offline.
    });
  }, []);
  return null;
}
