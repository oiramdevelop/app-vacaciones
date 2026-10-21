"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelRequestAction } from "../actions";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Cancelar
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelRequestAction(requestId);
              if (!result.ok) setError(result.errors.join(" "));
            })
          }
        >
          Confirmar
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          No
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
