import type { NextApiRequest, NextApiResponse } from "next";
import { recordActivity } from "@/lib/admin-store";
import { clearSessionCookie, getAdminIdentity } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const principal = await getAdminIdentity(request);
  if (principal) await recordActivity({ actor: principal.email, action: "logged_out", entityType: "admin" });
  clearSessionCookie(response);
  response.status(200).json({ ok: true });
}
