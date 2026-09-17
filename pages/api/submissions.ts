import type { NextApiRequest, NextApiResponse } from "next";
import { getSubmissions, recordActivity, updateSubmission } from "@/lib/admin-store";
import { requireApiSession } from "@/lib/session";
import type { SubmissionStatus } from "@/lib/types";

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const principal = await requireApiSession(request, response);
  if (!principal) return;
  if (request.method === "GET") {
    const status = typeof request.query.status === "string" ? request.query.status as SubmissionStatus | "all" : "all";
    const query = typeof request.query.q === "string" ? request.query.q : "";
    response.status(200).json({ submissions: await getSubmissions({ status, query, limit: 200 }) }); return;
  }
  if (request.method === "PATCH") {
    const body = request.body as { id?: string; action?: "read" | "archive" | "restore" };
    if (!body.id || !body.action) { response.status(400).json({ error: "Submission id and action are required." }); return; }
    const submission = await updateSubmission(body.id, body.action);
    await recordActivity({ actor: principal.email, action: "submission_" + body.action, entityType: "submission", entityId: body.id });
    response.status(200).json({ submission, submissions: await getSubmissions({ limit: 200 }) }); return;
  }
  response.setHeader("Allow", "GET, PATCH");
  response.status(405).json({ error: "Method not allowed" });
}
