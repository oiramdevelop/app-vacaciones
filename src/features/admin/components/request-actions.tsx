"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { approveRequestAction, cancelApprovedRequestAction, rejectRequestAction } from "../actions";
import { rejectSchema, type RejectInput } from "../schemas";

function RejectDialog({ requestId, summary }: { requestId: string; summary: string }) {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors },
  } = useForm<RejectInput>({ resolver: zodResolver(rejectSchema), defaultValues: { requestId, reason: "" } });

  const onSubmit = handleSubmit((values) => {
    setErrors([]);
    startTransition(async () => {
      const result = await rejectRequestAction(values);
      if (result.ok) setOpen(false);
      else setErrors(result.errors);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <X /> Rechazar
        </Button>
      </DialogTrigger>
      <DialogContent title="Rechazar solicitud" description={`${summary}. El empleado verá el motivo.`}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Motivo del rechazo" htmlFor={`reject-${requestId}`} error={fieldErrors.reason?.message}>
            <Input id={`reject-${requestId}`} maxLength={300} autoFocus {...register("reason")} />
          </Field>
          <FormErrors errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Rechazar solicitud
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequestActions({
  requestId,
  status,
  cancellable,
  summary,
}: {
  requestId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  cancellable: boolean;
  summary: string;
}) {
  const [error, setError] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; errors?: string[] }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn();
      if (!result.ok) setError(result.errors?.join(" "));
      setConfirmCancel(false);
    });

  if (status === "PENDING") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => approveRequestAction(requestId))}>
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Aprobar
          </Button>
          <RejectDialog requestId={requestId} summary={summary} />
        </div>
        {error ? <p className="max-w-56 text-right text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (status === "APPROVED" && cancellable) {
    return (
      <div className="flex flex-col items-end gap-1">
        {confirmCancel ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => run(() => cancelApprovedRequestAction(requestId))}>
              Cancelar y devolver días
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
            Cancelar
          </Button>
        )}
        {error ? <p className="max-w-56 text-right text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}
