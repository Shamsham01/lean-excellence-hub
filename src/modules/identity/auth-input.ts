import { z } from "zod";

export const emailPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email().max(320))
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(1024),
});

export const workforceLoginSchema = z.object({
  organisationCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/),
  workforceAlias: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{0,127}$/),
  password: z.string().min(1).max(1024),
});

export const passwordUpdateSchema = z.object({
  password: z
    .string()
    .min(12)
    .max(1024)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});
