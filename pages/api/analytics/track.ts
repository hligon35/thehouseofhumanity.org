import type { NextApiRequest, NextApiResponse } from "next";
import { recordAnalyticsEvent } from "@/lib/admin-store";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); response.status(405).json({ error: "Method not allowed" }); return; }
  const body = request.body as { eventType?: string; path?: string; referrer?: string; userAgent?: string; visitorId?: string; metadata?: Record<string, unknown> };
  if (!body.eventType || !body.path) { response.status(400).json({ error: "Event type and path are required." }); return; }
  await recordAnalyticsEvent(body);
  response.status(204).end();
}
