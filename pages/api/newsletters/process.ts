import type { NextApiRequest, NextApiResponse } from "next";
import { getNewsletters, processDueNewsletters, recordActivity } from "@/lib/admin-store";
import { getProcessSecret, requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); response.status(405).json({ error: "Method not allowed" }); return; }
  const secret = await getProcessSecret();
  let principal = null;
  if (!secret || request.headers.authorization !== "Bearer " + secret) principal = await requireApiSession(request, response);
  if (!secret || request.headers.authorization !== "Bearer " + secret) {
    if (!principal) return;
  }
  const processed = await processDueNewsletters(8);
  if (principal) await recordActivity({ actor: principal.email, action: "newsletters_processed", entityType: "newsletter", metadata: { count: processed.length } });
  response.status(200).json({ processed, newsletters: await getNewsletters() });
}
