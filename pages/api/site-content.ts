import type { NextApiRequest, NextApiResponse } from "next";
import { getSiteContent, publishSiteDraft, recordActivity, resetSiteDraft, saveSiteDraft } from "@/lib/admin-store";
import type { SiteEditorContent } from "@/lib/types";
import { requireApiSession } from "@/lib/session";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method === "GET") {
    const content = await getSiteContent();
    response.status(200).json(request.query.mode === "published" ? content.published : content);
    return;
  }
  const principal = await requireApiSession(request, response);
  if (!principal) return;
  if (request.method !== "PUT") {
    response.setHeader("Allow", "GET, PUT");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = request.body as { action?: "save" | "reset" | "publish"; draft?: SiteEditorContent };
  if (body.action === "save") {
    if (!body.draft) { response.status(400).json({ error: "Draft content is required." }); return; }
    const siteContent = await saveSiteDraft(body.draft);
    await recordActivity({ actor: principal.email, action: "content_saved", entityType: "site_content" });
    response.status(200).json({ siteContent });
    return;
  }
  if (body.action === "reset") {
    const siteContent = await resetSiteDraft();
    await recordActivity({ actor: principal.email, action: "content_reset", entityType: "site_content" });
    response.status(200).json({ siteContent });
    return;
  }
  if (body.action === "publish") {
    const siteContent = await publishSiteDraft();
    await recordActivity({ actor: principal.email, action: "content_published", entityType: "site_content" });
    response.status(200).json({ siteContent });
    return;
  }
  response.status(400).json({ error: "Invalid content action." });
}
