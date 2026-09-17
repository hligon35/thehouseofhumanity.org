import type { NextApiRequest, NextApiResponse } from "next";
import { recordActivity, validateAdminLogin } from "@/lib/admin-store";
import { isLocalAdminLoginEnabled, setSessionCookie } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!(await isLocalAdminLoginEnabled())) {
    response.status(403).json({ error: "Use the Cloudflare Access sign-in at this address." });
    return;
  }
  const body = request.body as { username?: string; password?: string };
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !(await validateAdminLogin(username, password))) {
    response.status(401).json({ error: "Invalid local credentials." });
    return;
  }
  setSessionCookie(response, username);
  await recordActivity({ actor: username, action: "logged_in", entityType: "admin" });
  response.status(200).json({ ok: true, username });
}
