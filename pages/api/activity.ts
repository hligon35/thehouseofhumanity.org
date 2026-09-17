import type { NextApiRequest, NextApiResponse } from "next";
import { getActivity } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "GET") { response.setHeader("Allow", "GET"); response.status(405).json({ error: "Method not allowed" }); return; }
  if (!(await requireApiSession(request, response))) return;
  response.status(200).json({ activity: await getActivity(200) });
}
