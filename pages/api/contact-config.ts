import type { NextApiRequest, NextApiResponse } from "next";
import { getRuntimeEnv } from "@/lib/runtime-env";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const env = await getRuntimeEnv();
  const enabled = env.CONTACT_FORM_REQUIRE_TURNSTILE === "true" || env.NODE_ENV === "production";
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  response.status(200).json({ enabled, siteKey: env.TURNSTILE_SITE_KEY ?? "" });
}
