import { z } from "zod";

// Debe coincidir con el enum `Company` de prisma/schema.prisma.
export const COMPANIES = ["FLORAMARKET", "GALACTICBLUM"] as const;
export type Company = (typeof COMPANIES)[number];

export const COMPANY_LABELS: Record<Company, string> = {
  FLORAMARKET: "Floramarket",
  GALACTICBLUM: "Galacticblum",
};

export const companySchema = z.enum(COMPANIES);

/** Filtro de empresa desde la URL (`?empresa=...`): undefined = todas. */
export function parseCompany(value: string | undefined): Company | undefined {
  return companySchema.safeParse(value).data;
}
