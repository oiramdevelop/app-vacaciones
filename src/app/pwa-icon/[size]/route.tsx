import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/pwa-icon";

const SIZES = { "192": { px: 192, safe: false }, "512": { px: 512, safe: false }, maskable: { px: 512, safe: true } } as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size as keyof typeof SIZES];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIconArt size={spec.px} safeZone={spec.safe} />, { width: spec.px, height: spec.px });
}
