"use client";

import { useState, useTransition } from "react";
import { Scale, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setEmployeeActiveAction } from "../actions";
import { AdjustBalanceDialog } from "./adjust-balance-dialog";
import { EmployeeDialog, type EmployeeFormTarget } from "./employee-dialog";

export function EmployeeRowActions({
  employee,
  isActive,
  isSelf,
  year,
  available,
}: {
  employee: EmployeeFormTarget;
  isActive: boolean;
  isSelf: boolean;
  year: number;
  available: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const result = await setEmployeeActiveAction(employee.id, !isActive);
      if (!result.ok) setError(result.errors.join(" "));
      setConfirming(false);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        <EmployeeDialog
          employee={employee}
          defaultDays={0}
          trigger={
            <Button variant="ghost" size="icon" className="size-8" title="Editar" aria-label={`Editar a ${employee.name}`}>
              <Pencil />
            </Button>
          }
        />
        <AdjustBalanceDialog
          employeeId={employee.id}
          employeeName={employee.name}
          year={year}
          available={available}
          trigger={
            <Button variant="ghost" size="icon" className="size-8" title="Ajustar saldo" aria-label={`Ajustar saldo de ${employee.name}`}>
              <Scale />
            </Button>
          }
        />
        {isSelf ? null : confirming ? (
          <>
            <Button variant={isActive ? "destructive" : "default"} size="sm" disabled={pending} onClick={toggle}>
              {isActive ? "Desactivar" : "Activar"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              No
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={isActive ? "Desactivar" : "Activar"}
            aria-label={`${isActive ? "Desactivar" : "Activar"} a ${employee.name}`}
            onClick={() => setConfirming(true)}
          >
            {isActive ? <UserX /> : <UserCheck />}
          </Button>
        )}
      </div>
      {error ? <p className="max-w-56 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
