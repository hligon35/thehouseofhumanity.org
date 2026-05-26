import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionFromRequest } from "@/lib/session";

export default function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = getSessionFromRequest(request);
  response.status(200).json({ authenticated: Boolean(session), session });
}