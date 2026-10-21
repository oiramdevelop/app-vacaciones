"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Next 16: el componente recibe `retry` (no `reset`).
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // En producción el mensaje real no llega al cliente; `digest` permite localizarlo en los logs del servidor.
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">Algo no ha ido bien</h1>
      <p className="text-sm text-muted-foreground">
        No hemos podido completar la operación. Inténtalo de nuevo; si el problema continúa, avisa al administrador
        {error.digest ? ` indicando el código ${error.digest}` : ""}.
      </p>
      <Button onClick={() => retry()}>Reintentar</Button>
    </div>
  );
}
