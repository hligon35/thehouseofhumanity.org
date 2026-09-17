import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminIdentity } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  response.status(200).json({ authenticated: Boolean(await getAdminIdentity(request)), principal: await getAdminIdentity(request) });
}
