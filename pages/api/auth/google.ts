import type { NextApiRequest, NextApiResponse } from "next";
import { recordActivity } from "@/lib/admin-store";
import { setSessionCookie, verifyGoogleIdToken } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = request.body as { credential?: string };
  const credential = body.credential ?? "";
  const verified = credential ? await verifyGoogleIdToken(credential) : null;
  if (!verified) {
    response.status(401).json({ error: "Google sign-in could not be verified for this account." });
    return;
  }
  setSessionCookie(response, verified.email, "google");
  await recordActivity({ actor: verified.email, action: "logged_in", entityType: "admin" });
  response.status(200).json({ ok: true, username: verified.email });
}
