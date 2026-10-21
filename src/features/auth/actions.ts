"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { LOGIN_PATH, safeCallbackUrl } from "./access";
import { loginSchema, type LoginInput } from "./schemas";

export type LoginResult = { error: string } | undefined;

const GENERIC_ERROR = "Email o contraseña incorrectos, o demasiados intentos. Inténtalo de nuevo más tarde.";

/** Revalida en servidor; en caso de éxito `signIn` redirige (lanza NEXT_REDIRECT, que debe propagarse). */
export async function loginAction(input: LoginInput, callbackUrl?: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos introducidos." };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallbackUrl(callbackUrl) });
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: LOGIN_PATH });
}
