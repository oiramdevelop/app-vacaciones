import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/features/auth/access";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: AppRole } & DefaultSession["user"];
  }
  interface User {
    role: AppRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
  }
}
