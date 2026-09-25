import type { NextApiRequest, NextApiResponse } from "next";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { isTurnstileEnabled } from "@/lib/turnstile";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const env = await getRuntimeEnv();
  const enabled = await isTurnstileEnabled();
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.status(200).json({ enabled, siteKey: env.TURNSTILE_SITE_KEY ?? "" });
}
