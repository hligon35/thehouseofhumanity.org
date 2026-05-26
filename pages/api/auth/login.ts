import type { NextApiRequest, NextApiResponse } from "next";
import { validateAdminLogin } from "@/lib/admin-store";
import { setSessionCookie } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { username, password } = request.body as { username?: string; password?: string };

  if (!username || !password || !(await validateAdminLogin(username, password))) {
    response.status(401).json({ error: "Invalid credentials" });
    return;
  }

  setSessionCookie(response, username);
  response.status(200).json({ ok: true, username });
}