import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Introduce tu email").email("Email no válido").max(254),
  password: z.string().min(1, "Introduce tu contraseña").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
