import type { NextApiRequest, NextApiResponse } from "next";
import { resetPasswordWithToken } from "@/lib/admin-store";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { token, password } = request.body as { token?: string; password?: string };
  if (!token?.trim() || !password?.trim()) {
    response.status(400).json({ error: "Token and password are required." });
    return;
  }

  try {
    await resetPasswordWithToken(token, password);
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to reset password." });
  }
}