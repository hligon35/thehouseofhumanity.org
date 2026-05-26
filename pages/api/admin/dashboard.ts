import type { NextApiRequest, NextApiResponse } from "next";
import { getDashboardData } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = requireApiSession(request, response);
  if (!session) {
    return;
  }

  const data = await getDashboardData();
  response.status(200).json({ username: session.username, data });
}