import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie } from "@/lib/session";

export default function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  clearSessionCookie(response);
  response.status(200).json({ ok: true });
}