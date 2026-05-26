import type { NextApiRequest, NextApiResponse } from "next";
import { createPasswordReset } from "@/lib/admin-store";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { username } = request.body as { username?: string };
  if (!username?.trim()) {
    response.status(400).json({ error: "Username is required." });
    return;
  }

  const result = await createPasswordReset(username);
  response.status(200).json({
    ok: true,
    message: "If the username exists, a reset link has been prepared.",
    resetLink: process.env.NODE_ENV === "production" ? null : result.resetLink,
    expiresAt: result.expiresAt
  });
}