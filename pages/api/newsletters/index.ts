import type { NextApiRequest, NextApiResponse } from "next";
import { createNewsletter, deleteNewsletter, getNewsletters, updateNewsletter } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const session = requireApiSession(request, response);
  if (!session) {
    return;
  }

  if (request.method === "GET") {
    const newsletters = await getNewsletters();
    response.status(200).json({ newsletters });
    return;
  }

  if (request.method === "POST") {
    const { subject, body, scheduledForIso, recipientIds } = request.body as {
      subject?: string;
      body?: string;
      scheduledForIso?: string;
      recipientIds?: string[];
    };
    if (!subject || !body || !scheduledForIso || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      response.status(400).json({ error: "Newsletter subject, body, schedule, and recipients are required" });
      return;
    }

    const newsletter = await createNewsletter({ subject, body, scheduledForIso, recipientIds });
    const newsletters = await getNewsletters();
    response.status(200).json({ newsletter, newsletters });
    return;
  }

  if (request.method === "PUT") {
    const { id, subject, body, scheduledForIso, recipientIds } = request.body as {
      id?: string;
      subject?: string;
      body?: string;
      scheduledForIso?: string;
      recipientIds?: string[];
    };
    if (!id || !subject || !body || !scheduledForIso || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      response.status(400).json({ error: "Newsletter id, content, schedule, and recipients are required" });
      return;
    }

    const newsletter = await updateNewsletter(id, { subject, body, scheduledForIso, recipientIds });
    const newsletters = await getNewsletters();
    response.status(200).json({ newsletter, newsletters });
    return;
  }

  if (request.method === "DELETE") {
    const { id } = request.query;
    if (typeof id !== "string") {
      response.status(400).json({ error: "Newsletter id is required" });
      return;
    }

    await deleteNewsletter(id);
    const newsletters = await getNewsletters();
    response.status(200).json({ newsletters });
    return;
  }

  response.setHeader("Allow", "GET, POST, PUT, DELETE");
  response.status(405).json({ error: "Method not allowed" });
}