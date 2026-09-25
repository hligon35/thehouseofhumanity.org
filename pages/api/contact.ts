import { createHash } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { consumeContactRateLimit, createSubmission, recordActivity, sendContactNotification } from "@/lib/admin-store";
import { getRuntimeEnv } from "@/lib/runtime-env";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function clientIp(request: NextApiRequest) {
  return clean(
    headerValue(request.headers["cf-connecting-ip"]) ||
      headerValue(request.headers["x-forwarded-for"]).split(",")[0] ||
      request.socket.remoteAddress || "unknown",
    120
  );
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function isSuspiciousMessage(topic: string, message: string) {
  const content = (topic + "\n" + message).toLowerCase();
  const urls = content.match(/https?:\/\/[^\s<]+/g) ?? [];
  if (urls.length > 2) return true;
  if (/(?:telegra\.ph|t\.me\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/)/i.test(content)) return true;
  return /(?:win|winner|won|free|claim|prize|giveaway|contest).{0,90}(?:playstation|xbox|iphone|ipad|lamborghini|ferrari|cash|money|https?:\/\/)/i.test(content);
}

async function verifyTurnstile(token: string, secret: string, ip: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
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

export const config = { api: { bodyParser: { sizeLimit: "20kb" } } };

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); response.status(405).json({ error: "Method not allowed" }); return; }
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body as Record<string, unknown>
    : {};
  const env = await getRuntimeEnv();
  const requireTurnstile = env.CONTACT_FORM_REQUIRE_TURNSTILE === "true" || env.NODE_ENV === "production";
  const ip = clientIp(request);

  if (clean(body.website, 100)) { response.status(200).json({ ok: true }); return; }
  const startedAt = Number(body.formStartedAt);
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 2500) {
    response.status(202).json({ ok: true });
    return;
  }

  const turnstileToken = clean(body["cf-turnstile-response"], 4096);
  if (requireTurnstile) {
    if (!env.TURNSTILE_SECRET_KEY || !turnstileToken || !(await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, ip))) {
      response.status(403).json({ error: "Please complete the security check and try again." });
      return;
    }
  }

  const ipLimit = await consumeContactRateLimit({ bucketKey: "ip:" + hashIdentifier(ip || "unknown"), maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (!ipLimit.allowed) {
    response.setHeader("Retry-After", String(ipLimit.retryAfterSeconds));
    response.status(429).json({ error: "Too many submissions. Please try again later." });
    return;
  }

  const name = clean(body.Name ?? body.name, 120);
  const email = clean(body.Email ?? body.email, 254).toLowerCase();
  const phone = clean(body.Phone ?? body.phone, 40);
  const topic = clean(body.Topic ?? body.topic, 120);
  const message = clean(body.Message ?? body.message, 4000);
  const pageUrl = clean(body.PageURL ?? body.pageUrl, 500);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !topic) {
    response.status(400).json({ error: "Name, a valid email, and a topic are required." }); return;
  }
  if (isSuspiciousMessage(topic, message)) {
    response.status(202).json({ ok: true });
    return;
  }

  const emailLimit = await consumeContactRateLimit({ bucketKey: "email:" + hashIdentifier(email), maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!emailLimit.allowed) {
    response.status(202).json({ ok: true });
    return;
  }

  const submission = await createSubmission({ name, email, phone: phone || undefined, topic, message, pageUrl: pageUrl || undefined });
  let delivery = { delivered: 0, mode: "not-configured" as string };
  try { delivery = await sendContactNotification(submission); } catch { /* D1 is the system of record even if email is unavailable. */ }
  await recordActivity({ actor: email, action: "submission_created", entityType: "submission", entityId: submission.id });
  response.status(201).json({ ok: true, id: submission.id, notification: delivery.mode });
}
