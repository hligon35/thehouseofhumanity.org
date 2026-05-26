import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse, NextPageContext } from "next";

const SESSION_COOKIE = "thoh_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? "local-admin-session-secret-change-me";
}

function encodePayload(payload: SessionPayload) {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  return `${base}.${signature}`;
}

function decodePayload(value?: string): SessionPayload | null {
  if (!value) {
    return null;
  }

  const [base, signature] = value.split(".");
  if (!base || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const parsed = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as SessionPayload;
  if (parsed.expiresAt < Date.now()) {
    return null;
  }

  return parsed;
}

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME ?? "admin",
    password: process.env.ADMIN_PASSWORD ?? "HumanityAdmin!2026"
  };
}

function parseCookieHeader(cookieHeader?: string) {
  return (cookieHeader ?? "").split(";").reduce<Record<string, string>>((accumulator, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey || rest.length === 0) {
      return accumulator;
    }

    accumulator[rawKey] = rest.join("=");
    return accumulator;
  }, {});
}

export function getSessionFromRequest(request: Pick<NextApiRequest, "headers"> | NextPageContext["req"]) {
  if (!request) {
    return null;
  }

  const cookies = parseCookieHeader(request.headers.cookie);
  return decodePayload(cookies[SESSION_COOKIE]);
}

export function setSessionCookie(response: NextApiResponse, username: string) {
  const value = encodePayload({
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
  );
}

export function clearSessionCookie(response: NextApiResponse) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function requireApiSession(request: NextApiRequest, response: NextApiResponse) {
  const session = getSessionFromRequest(request);
  if (!session) {
    response.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return session;
}

export function getProcessSecret() {
  return process.env.CRON_PROCESS_SECRET ?? "local-cron-secret-change-me";
}