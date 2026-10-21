import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

export type ServiceResult<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; errors: string[] };

export const fail = (...errors: string[]): { ok: false; errors: string[] } => ({ ok: false, errors });

/**
 * Serializa las operaciones que afectan al saldo de un empleado (solicitar, aprobar, rechazar,
 * cancelar, ajustar): quien llega segundo espera y ve el estado ya confirmado por el primero.
 */
export async function lockEmployee(tx: Tx, employeeId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${employeeId} FOR UPDATE`;
}

export async function writeAudit(
  tx: Tx,
  entry: { actorId: string | null; action: string; entityType: string; entityId: string; metadata?: Prisma.InputJsonValue },
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
