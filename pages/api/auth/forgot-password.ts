import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_request: NextApiRequest, response: NextApiResponse) {
  response.status(410).json({ error: "Password reset is not used in production. Sign in through Cloudflare Access." });
}
