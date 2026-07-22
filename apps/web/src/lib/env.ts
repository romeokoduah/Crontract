import { z } from "zod"

/**
 * Server environment validation. Run once at server startup via
 * `src/instrumentation.ts` so a misconfigured deployment fails fast and loudly
 * instead of throwing obscure errors on the first request.
 *
 * Set SKIP_ENV_VALIDATION=1 to bypass (e.g. for a Docker build step that has no
 * real secrets yet).
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),
    NEXTAUTH_SECRET: z
      .string()
      .min(1, "NEXTAUTH_SECRET is required"),
    NEXTAUTH_URL: z.string().url().optional(),
    // Optional integrations — validated only if present.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    REDIS_URL: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    AUTHZ_ENFORCED: z.enum(["true", "false"]).optional(),
  })
  .superRefine((env, ctx) => {
    // In production, weak/short auth secrets are a real risk — require strength.
    if (env.NODE_ENV === "production" && env.NEXTAUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXTAUTH_SECRET"],
        message:
          "NEXTAUTH_SECRET must be at least 32 characters in production (generate with `openssl rand -base64 32`)",
      })
    }
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Validate process.env. Throws an aggregated, readable error on failure.
 * Returns the parsed, typed env on success.
 */
export function validateEnv(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as ServerEnv
  }

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(
      `Invalid server environment configuration:\n${issues}\n` +
        `Check your .env / deployment secrets. See .env.example for the full list.`
    )
  }
  return parsed.data
}

/** Master switch for permission enforcement. Off unless explicitly "true". */
export const AUTHZ_ENFORCED = process.env.AUTHZ_ENFORCED === "true"
