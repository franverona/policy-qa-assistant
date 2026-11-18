import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.url(),
    LLM_PROVIDER: z.enum(["ollama", "anthropic", "fixture"]),
    OLLAMA_BASE_URL: z.url(),
    CHAT_MODEL: z.string().min(1),
    EMBED_MODEL: z.string().min(1),
    EMBED_DIM: z.coerce.number().int().positive(),
    RERANK_MODEL: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER !== "anthropic") return;
    for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"] as const) {
      if (!env[key])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "required when LLM_PROVIDER=anthropic",
        });
    }
  });

export type Config = z.infer<typeof schema>;

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => {
    const key = String(i.path[0]);
    const missing = !env[key] && i.code !== "custom";
    return `  - ${key}: ${missing ? "missing" : i.message}`;
  });
  throw new Error(
    `Invalid configuration:\n${lines.join("\n")}\nCopy .env.example to .env and fill in the missing values.`,
  );
}

let cached: Config | undefined;

// Lazy so `next build` (no env in CI) doesn't fail; instrumentation.ts calls it at server start.
export function getConfig(): Config {
  return (cached ??= parseConfig(process.env));
}
