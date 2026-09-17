import type { NextApiRequest, NextApiResponse } from "next";
import { sendTestNewsletter, recordActivity } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); response.status(405).json({ error: "Method not allowed" }); return; }
  const principal = await requireApiSession(request, response);
  if (!principal) return;
  const body = request.body as { subject?: string; body?: string; email?: string };
  if (!body.subject?.trim() || !body.body?.trim() || !/^\S+@\S+\.\S+$/.test(body.email ?? "")) {
    response.status(400).json({ error: "Subject, body, and a valid test email are required." }); return;
  }
  const email = body.email ?? "";
  const delivery = await sendTestNewsletter(body.subject, body.body, email);
  await recordActivity({ actor: principal.email, action: "newsletter_test_sent", entityType: "newsletter", metadata: { recipient: email } });
  response.status(200).json({ delivery });
}
