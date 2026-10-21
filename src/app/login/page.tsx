import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AppLogo } from "@/components/layout/app-logo";
import { roleHomePath, safeCallbackUrl } from "@/features/auth/access";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(roleHomePath(user.role));

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-sidebar-foreground">
          <AppLogo size={72} priority />
          <h1 className="text-xl font-semibold">Gestión de vacaciones</h1>
        </div>
        <Card className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">Accede con tu cuenta de empresa.</p>
          <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
        </Card>
      </div>
    </main>
  );
}
