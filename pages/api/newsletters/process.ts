import type { NextApiRequest, NextApiResponse } from "next";
import { getNewsletters, processDueNewsletters } from "@/lib/admin-store";
import { getProcessSecret, requireApiSession } from "@/lib/session";

function authorizeProcessRequest(request: NextApiRequest, response: NextApiResponse) {
  const hasCronSecret = request.headers.authorization === `Bearer ${getProcessSecret()}`;
  if (hasCronSecret) {
    return true;
  }

  return Boolean(requireApiSession(request, response));
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authorized = authorizeProcessRequest(request, response);
  if (!authorized) {
    return;
  }

  const processed = await processDueNewsletters(8);
  const newsletters = await getNewsletters();
  response.status(200).json({ processed, newsletters });
}