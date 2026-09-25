import type { NextApiRequest } from "next";
import { getRuntimeEnv } from "@/lib/runtime-env";

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function clientIp(request: NextApiRequest) {
  return (headerValue(request.headers["cf-connecting-ip"]) ||
    headerValue(request.headers["x-forwarded-for"]).split(",")[0] ||
    request.socket.remoteAddress ||
    "unknown").trim().slice(0, 120);
}

export async function isTurnstileEnabled() {
  const env = await getRuntimeEnv();
  return env.CONTACT_FORM_REQUIRE_TURNSTILE === "true" || env.NODE_ENV === "production";
}

export async function verifyTurnstileToken(token: string, request: NextApiRequest) {
  const env = await getRuntimeEnv();
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  const ip = clientIp(request);
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal
    });
    if (!result.ok) return false;
    const payload = await result.json() as { success?: boolean };
    return payload.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
