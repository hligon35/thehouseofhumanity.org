import type { NextApiRequest, NextApiResponse } from "next";
import { addSubscriber, getSubscribers } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const session = requireApiSession(request, response);
  if (!session) {
    return;
  }

  if (request.method === "GET") {
    const subscribers = await getSubscribers();
    response.status(200).json({ subscribers });
    return;
  }

  if (request.method === "POST") {
    const { email } = request.body as { email?: string };
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      response.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const subscriber = await addSubscriber(email);
    const subscribers = await getSubscribers();
    response.status(200).json({ subscriber, subscribers });
    return;
  }

  response.setHeader("Allow", "GET, POST");
  response.status(405).json({ error: "Method not allowed" });
}