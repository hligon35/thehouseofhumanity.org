import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse, NextPageContext } from "next";
import { getRuntimeEnv } from "@/lib/runtime-env";
import type { AdminPrincipal } from "@/lib/types";

const SESSION_COOKIE = "thoh_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
type SessionPayload = { username: string; expiresAt: number };
type RequestWithHeaders = Pick<NextApiRequest, "headers"> | NextPageContext["req"];

function getHeader(request: RequestWithHeaders, name: string) {
  const value = request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "local-only-change-me";
}

function encodePayload(payload: SessionPayload) {
  const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  return base + "." + signature;
}

function decodePayload(value?: string): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  const base = parts[0];
  const signature = parts[1];
  if (!base || !signature) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as SessionPayload;
    return parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader?: string) {
  return (cookieHeader ?? "").split(";").reduce<Record<string, string>>((result, pair) => {
    const [key, ...parts] = pair.trim().split("=");
    if (key && parts.length) result[key] = parts.join("=");
    return result;
  }, {});
}

export function getSessionFromRequest(request: RequestWithHeaders) {
  if (!request) return null;
  return decodePayload(parseCookieHeader(getHeader(request, "cookie"))[SESSION_COOKIE]);
}

export async function isLocalAdminLoginEnabled() {
  const env = await getRuntimeEnv();
  return env.ALLOW_LOCAL_ADMIN_LOGIN === "true" || env.NODE_ENV !== "production";
}

export async function getLocalAdminUsername() {
  return (await getRuntimeEnv()).ADMIN_USERNAME ?? "";
}

function allowedAccessEmails(env: Record<string, string | undefined>) {
  return (env.ADMIN_ALLOWED_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function getAdminIdentity(request: RequestWithHeaders): Promise<AdminPrincipal | null> {
  const accessEmail = getHeader(request, "cf-access-authenticated-user-email")?.trim().toLowerCase();
  if (accessEmail) {
    const env = await getRuntimeEnv();
    const allowed = allowedAccessEmails(env);
    if (allowed.length && !allowed.includes(accessEmail)) return null;
    return { username: accessEmail, email: accessEmail, authType: "cloudflare-access" };
  }
  if (!(await isLocalAdminLoginEnabled())) return null;
  const session = getSessionFromRequest(request);
  return session ? { username: session.username, email: session.username, authType: "local" } : null;
}

export async function requireApiSession(request: NextApiRequest, response: NextApiResponse) {
  const principal = await getAdminIdentity(request);
  if (!principal) {
    response.status(401).json({ error: "Cloudflare Access authentication is required." });
    return null;
  }
  return principal;
}

export function setSessionCookie(response: NextApiResponse, username: string) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  response.setHeader(
    "Set-Cookie",
    SESSION_COOKIE + "=" + encodePayload({ username, expiresAt: Date.now() + SESSION_TTL_MS }) +
      "; Path=/; HttpOnly; SameSite=Lax;" + secure + " Max-Age=" + SESSION_TTL_MS / 1000
  );
}

export function clearSessionCookie(response: NextApiResponse) {
  response.setHeader("Set-Cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

export async function getProcessSecret() {
  return (await getRuntimeEnv()).CRON_PROCESS_SECRET ?? "";
}
