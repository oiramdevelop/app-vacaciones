import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Sonda para el orquestador/balanceador. Pública a propósito y sin detalles internos. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
