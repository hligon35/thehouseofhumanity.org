import type { NextApiRequest, NextApiResponse } from "next";
import { getSiteContent, publishSiteDraft, resetSiteDraft, saveSiteDraft } from "@/lib/admin-store";
import type { SiteEditorContent } from "@/lib/types";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method === "GET") {
    const content = await getSiteContent();
    const mode = request.query.mode === "published" ? "published" : "full";
    response.status(200).json(mode === "published" ? content.published : content);
    return;
  }

  const session = requireApiSession(request, response);
  if (!session) {
    return;
  }

  if (request.method !== "PUT") {
    response.setHeader("Allow", "GET, PUT");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { action, draft } = request.body as {
    action?: "save" | "reset" | "publish";
    draft?: SiteEditorContent;
  };

  if (action === "save") {
    if (!draft) {
      response.status(400).json({ error: "Draft payload is required" });
      return;
    }

    const siteContent = await saveSiteDraft(draft);
    response.status(200).json({ siteContent });
    return;
  }

  if (action === "reset") {
    const siteContent = await resetSiteDraft();
    response.status(200).json({ siteContent });
    return;
  }

  if (action === "publish") {
    const siteContent = await publishSiteDraft();
    response.status(200).json({ siteContent });
    return;
  }

  response.status(400).json({ error: "Invalid action" });
}