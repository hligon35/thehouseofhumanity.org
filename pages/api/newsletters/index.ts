import type { NextApiRequest, NextApiResponse } from "next";
import { createNewsletter, deleteNewsletter, getNewsletters, recordActivity, updateNewsletter } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const principal = await requireApiSession(request, response);
  if (!principal) return;
  if (request.method === "GET") { response.status(200).json({ newsletters: await getNewsletters() }); return; }
  if (request.method === "POST") {
    const body = request.body as { subject?: string; body?: string; scheduledForIso?: string; recipientIds?: string[] };
    if (!body.subject?.trim() || !body.body?.trim() || !body.scheduledForIso || !Array.isArray(body.recipientIds) || !body.recipientIds.length) {
      response.status(400).json({ error: "Subject, body, schedule, and at least one recipient are required." }); return;
    }
    const newsletter = await createNewsletter({ subject: body.subject, body: body.body, scheduledForIso: body.scheduledForIso, recipientIds: body.recipientIds });
    await recordActivity({ actor: principal.email, action: "newsletter_scheduled", entityType: "newsletter", entityId: newsletter.id });
    response.status(200).json({ newsletter, newsletters: await getNewsletters() }); return;
  }
  if (request.method === "PUT") {
    const body = request.body as { id?: string; subject?: string; body?: string; scheduledForIso?: string; recipientIds?: string[] };
    if (!body.id || !body.subject?.trim() || !body.body?.trim() || !body.scheduledForIso || !Array.isArray(body.recipientIds) || !body.recipientIds.length) {
      response.status(400).json({ error: "Newsletter id, content, schedule, and recipients are required." }); return;
    }
    const newsletter = await updateNewsletter(body.id, { subject: body.subject, body: body.body, scheduledForIso: body.scheduledForIso, recipientIds: body.recipientIds });
    await recordActivity({ actor: principal.email, action: "newsletter_updated", entityType: "newsletter", entityId: newsletter.id });
    response.status(200).json({ newsletter, newsletters: await getNewsletters() }); return;
  }
  if (request.method === "DELETE") {
    const id = typeof request.query.id === "string" ? request.query.id : "";
    if (!id) { response.status(400).json({ error: "Newsletter id is required." }); return; }
    await deleteNewsletter(id);
    await recordActivity({ actor: principal.email, action: "newsletter_deleted", entityType: "newsletter", entityId: id });
    response.status(200).json({ newsletters: await getNewsletters() }); return;
  }
  response.setHeader("Allow", "GET, POST, PUT, DELETE");
  response.status(405).json({ error: "Method not allowed" });
}
