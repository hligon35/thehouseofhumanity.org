import type { NextApiRequest, NextApiResponse } from "next";
import { addSubscriber, getSubscribers, recordActivity } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const principal = await requireApiSession(request, response);
  if (!principal) return;
  if (request.method === "GET") {
    response.status(200).json({ subscribers: await getSubscribers() });
    return;
  }
  if (request.method === "POST") {
    const email = String((request.body as { email?: string }).email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ error: "A valid email address is required." });
      return;
    }
    const subscriber = await addSubscriber(email);
    await recordActivity({ actor: principal.email, action: "subscriber_added", entityType: "subscriber", entityId: subscriber.id });
    response.status(200).json({ subscriber, subscribers: await getSubscribers() });
    return;
  }
  response.setHeader("Allow", "GET, POST");
  response.status(405).json({ error: "Method not allowed" });
}
