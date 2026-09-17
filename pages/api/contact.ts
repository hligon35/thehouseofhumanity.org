import type { NextApiRequest, NextApiResponse } from "next";
import { createSubmission, recordActivity, sendContactNotification } from "@/lib/admin-store";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); response.status(405).json({ error: "Method not allowed" }); return; }
  const body = request.body as Record<string, unknown>;
  if (clean(body.website, 100)) { response.status(200).json({ ok: true }); return; }
  const name = clean(body.Name ?? body.name, 120);
  const email = clean(body.Email ?? body.email, 254).toLowerCase();
  const phone = clean(body.Phone ?? body.phone, 40);
  const topic = clean(body.Topic ?? body.topic, 120);
  const message = clean(body.Message ?? body.message, 4000);
  const pageUrl = clean(body.PageURL ?? body.pageUrl, 500);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !topic) {
    response.status(400).json({ error: "Name, a valid email, and a topic are required." }); return;
  }
  const submission = await createSubmission({ name, email, phone: phone || undefined, topic, message, pageUrl: pageUrl || undefined });
  let delivery = { delivered: 0, mode: "not-configured" as string };
  try { delivery = await sendContactNotification(submission); } catch { /* D1 is the system of record even if email is unavailable. */ }
  await recordActivity({ actor: email, action: "submission_created", entityType: "submission", entityId: submission.id });
  response.status(201).json({ ok: true, id: submission.id, notification: delivery.mode });
}
