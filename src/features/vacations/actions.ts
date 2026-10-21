"use server";

import { revalidatePath } from "next/cache";
import { assertRole } from "@/server/auth/session";
import { cancelOwnRequest, createVacationRequest } from "@/server/vacations/request-service";
import type { ActionResult } from "@/lib/action-result";
import { cancelInputSchema, type RequestInput } from "./schemas";

export type { ActionResult };

export async function createRequestAction(input: RequestInput): Promise<ActionResult> {
  const user = await assertRole("EMPLOYEE");
  const result = await createVacationRequest(user, input);
  if (!result.ok) return result;

  revalidatePath("/dashboard");
  revalidatePath("/vacaciones/mis-solicitudes");
  return { ok: true };
}

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  const user = await assertRole("EMPLOYEE");
  const parsed = cancelInputSchema.safeParse({ requestId });
  if (!parsed.success) return { ok: false, errors: ["Solicitud no válida."] };

  const result = await cancelOwnRequest(user, parsed.data.requestId);
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/vacaciones/mis-solicitudes");
  }
  return result;
}
