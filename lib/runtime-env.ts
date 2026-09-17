import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnv = Record<string, string | undefined>;

export async function getRuntimeEnv(): Promise<RuntimeEnv> {
  const values: RuntimeEnv = { ...process.env };
  try {
    const { env } = await getCloudflareContext({ async: true });
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (typeof value === "string") values[key] = value;
    }
  } catch {
    // Local Next.js development uses process.env/.env.local.
  }
  return values;
}

export async function getRuntimeValue(key: string) {
  return (await getRuntimeEnv())[key];
}
