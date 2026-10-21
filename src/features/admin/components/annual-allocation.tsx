"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allocateAnnualDaysAction } from "../actions";

export function AnnualAllocation({ year, annualDays }: { year: number; annualDays: number }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Asigna {annualDays} días de {year} a los empleados activos que todavía no tienen asignación anual ese año. No modifica a quienes ya la tienen.
      </p>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await allocateAnnualDaysAction(year);
            setMessage(
              result.ok
                ? { ok: true, text: "Asignación aplicada." }
                : { ok: false, text: result.errors.join(" ") },
            );
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <CalendarRange />}
        Generar asignación de {year}
      </Button>
      {message ? <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p> : null}
    </div>
  );
}
