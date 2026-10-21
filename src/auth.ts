import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/features/auth/schemas";
import { db } from "@/server/db/client";
import { clearFailures, isLockedOut, recordFailure } from "@/server/auth/login-throttle";
import { verifyAgainstDummy, verifyPassword } from "@/server/auth/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        if (await isLockedOut(email)) return null;

        const user = await db.user.findUnique({ where: { email } });
        const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : await verifyAgainstDummy(parsed.data.password);

        if (!user || !valid || !user.isActive) {
          await recordFailure(email);
          return null;
        }

        await clearFailures(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
