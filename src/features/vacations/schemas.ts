import { z } from "zod";
import { isValidISODate } from "./domain/dates";

const isoDate = z.string().refine(isValidISODate, "Fecha no válida");

export const requestInputSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().max(500, "Máximo 500 caracteres"),
});

export type RequestInput = z.infer<typeof requestInputSchema>;

export const requestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export const cancelInputSchema = z.object({ requestId: z.string().min(1).max(64) });
