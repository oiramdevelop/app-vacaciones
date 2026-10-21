import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/server/auth/session";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("EMPLOYEE");
  return <AppShell user={user}>{children}</AppShell>;
}
