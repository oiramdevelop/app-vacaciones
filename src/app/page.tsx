import { redirect } from "next/navigation";
import { LOGIN_PATH, roleHomePath } from "@/features/auth/access";
import { getCurrentUser } from "@/server/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? roleHomePath(user.role) : LOGIN_PATH);
}
