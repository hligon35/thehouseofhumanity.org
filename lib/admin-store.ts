import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { defaultSiteContent } from "@/lib/defaults";
import { getDb } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import type {
  ActivityEvent, AdminData, AnalyticsSnapshot, AnalyticsSummary, ContactSubmission,
  NewsletterQueueItem, SiteContentRecord, SiteEditorContent, SiteEvent, SiteProduct,
  SubmissionStatus, Subscriber, TrafficRangeKey
} from "@/lib/types";

type AdminCredentialRow = { username: string; password_hash: string; updated_at: string };
type SiteContentRow = { singleton_key: string; published_json: string; draft_json: string; updated_at: string; published_at: string };
type SubscriberRow = { id: string; email: string; created_at: string };
type SubmissionRow = {
  id: string; name: string; email: string; phone: string | null; topic: string; message: string;
  page_url: string | null; status: SubmissionStatus; created_at: string; read_at: string | null; archived_at: string | null;
};
type ActivityRow = {
  id: string; actor: string; action: string; entity_type: string; entity_id: string | null;
  metadata_json: string | null; created_at: string;
};
type NewsletterRow = {
  id: string; subject: string; body: string; scheduled_for_iso: string; recipient_ids: string;
  status: NewsletterQueueItem["status"]; created_at: string; updated_at: string; sent_at: string | null;
};

let seeded = false;
let seedPromise: Promise<void> | undefined;

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split(":");
  if (!parts[0] || !parts[1]) return false;
  const derived = scryptSync(password, parts[0], 64).toString("hex");
  return derived.length === parts[1].length && timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(parts[1], "hex"));
}

function mapSubscriber(row: SubscriberRow): Subscriber {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

function mapSubmission(row: SubmissionRow): ContactSubmission {
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone ?? undefined, topic: row.topic,
    message: row.message, pageUrl: row.page_url ?? undefined, status: row.status, createdAt: row.created_at,
    readAt: row.read_at ?? undefined, archivedAt: row.archived_at ?? undefined
  };
}

function mapActivity(row: ActivityRow): ActivityEvent {
  let metadata: Record<string, unknown> | undefined;
  try { metadata = row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : undefined; } catch { metadata = undefined; }
  return {
    id: row.id, actor: row.actor, action: row.action, entityType: row.entity_type,
    entityId: row.entity_id ?? undefined, metadata, createdAt: row.created_at
  };
}

function mapNewsletter(row: NewsletterRow): NewsletterQueueItem {
  let recipientIds: string[] = [];
  try { recipientIds = JSON.parse(row.recipient_ids) as string[]; } catch { recipientIds = []; }
  return {
    id: row.id, subject: row.subject, body: row.body, scheduledForIso: row.scheduled_for_iso,
    recipientIds, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    sentAt: row.sent_at ?? undefined
  };
}

function normalizeEvent(event: Partial<SiteEvent> | undefined, fallback: SiteEvent): SiteEvent {
  return {
    id: event?.id ?? fallback.id, title: event?.title ?? fallback.title, description: event?.description ?? fallback.description,
    ctaLabel: event?.ctaLabel ?? fallback.ctaLabel, ctaHref: event?.ctaHref ?? fallback.ctaHref,
    imageSrc: event?.imageSrc ?? fallback.imageSrc, imageAlt: event?.imageAlt ?? fallback.imageAlt
  };
}

function normalizeProduct(product: Partial<SiteProduct> | undefined, fallback: SiteProduct): SiteProduct {
  return {
    id: product?.id ?? fallback.id, title: product?.title ?? fallback.title, description: product?.description ?? fallback.description,
    priceLabel: product?.priceLabel ?? fallback.priceLabel, ctaLabel: product?.ctaLabel ?? fallback.ctaLabel,
    ctaHref: product?.ctaHref ?? fallback.ctaHref, featured: product?.featured ?? fallback.featured
  };
}

function normalizeSiteContent(content: Partial<SiteEditorContent> | undefined): SiteEditorContent {
  const defaultEvent = defaultSiteContent.events.items[0];
  const defaultProduct = defaultSiteContent.shop.products[0];
  return {
    about: { ...defaultSiteContent.about, ...(content?.about ?? {}) },
    newsletter: { ...defaultSiteContent.newsletter, ...(content?.newsletter ?? {}) },
    events: {
      heading: content?.events?.heading ?? defaultSiteContent.events.heading,
      intro: content?.events?.intro ?? defaultSiteContent.events.intro,
      items: (content?.events?.items?.length ? content.events.items : defaultSiteContent.events.items).map((item) => normalizeEvent(item, defaultEvent))
    },
    shop: {
      heading: content?.shop?.heading ?? defaultSiteContent.shop.heading,
      body: content?.shop?.body ?? defaultSiteContent.shop.body,
      ctaLabel: content?.shop?.ctaLabel ?? defaultSiteContent.shop.ctaLabel,
      ctaHref: content?.shop?.ctaHref ?? defaultSiteContent.shop.ctaHref,
      products: (content?.shop?.products?.length ? content.shop.products : defaultSiteContent.shop.products).map((item) => normalizeProduct(item, defaultProduct))
    },
    colors: { ...defaultSiteContent.colors, ...(content?.colors ?? {}) },
    images: {
      founder: { ...defaultSiteContent.images.founder, ...(content?.images?.founder ?? {}) },
      newsletter: { ...defaultSiteContent.images.newsletter, ...(content?.images?.newsletter ?? {}) }
    }
  };
}

function mapSiteContent(row: SiteContentRow | undefined): SiteContentRecord {
  if (!row) {
    const now = new Date().toISOString();
    return { published: defaultSiteContent, draft: defaultSiteContent, updatedAt: now, publishedAt: now };
  }
  return {
    published: normalizeSiteContent(JSON.parse(row.published_json) as Partial<SiteEditorContent>),
    draft: normalizeSiteContent(JSON.parse(row.draft_json) as Partial<SiteEditorContent>),
    updatedAt: row.updated_at, publishedAt: row.published_at
  };
}

async function ensureSeeded() {
  if (seeded) return;
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const database = await getDb();
    const existing = await database.get<SiteContentRow>("SELECT * FROM site_content WHERE singleton_key = 'default'");
    if (!existing) {
      const now = new Date().toISOString();
      await database.run(
        "INSERT INTO site_content (singleton_key, published_json, draft_json, updated_at, published_at) VALUES ('default', ?, ?, ?, ?)",
        JSON.stringify(defaultSiteContent), JSON.stringify(defaultSiteContent), now, now
      );
    }
    const env = await getRuntimeEnv();
    if (env.NODE_ENV !== "production" || env.ALLOW_LOCAL_ADMIN_LOGIN === "true") {
      const credentials: Array<[string | undefined, string | undefined]> = [
        [env.ADMIN_USERNAME, env.ADMIN_PASSWORD],
        [env.ADMIN_SECONDARY_USERNAME, env.ADMIN_SECONDARY_PASSWORD]
      ];
      for (const pair of credentials) {
        if (pair[0] && pair[1]) {
          await database.run(
            "INSERT OR IGNORE INTO admin_credentials (username, password_hash, updated_at) VALUES (?, ?, ?)",
            pair[0], passwordHash(pair[1]), new Date().toISOString()
          );
        }
      }
    }
    seeded = true;
  })();
  try { await seedPromise; } finally { seedPromise = undefined; }
}

export async function validateAdminLogin(username: string, password: string) {
  await ensureSeeded();
  const row = await (await getDb()).get<AdminCredentialRow>(
    "SELECT * FROM admin_credentials WHERE username = ?", clean(username, 120)
  );
  return Boolean(row && verifyPassword(password, row.password_hash));
}

export async function getAdminUsername() {
  return (await getRuntimeEnv()).ADMIN_USERNAME ?? "";
}

export async function getSubscribers() {
  await ensureSeeded();
  const rows = await (await getDb()).all<SubscriberRow[]>("SELECT id, email, created_at FROM subscribers ORDER BY datetime(created_at) DESC");
  return rows.map(mapSubscriber);
}

export async function addSubscriber(email: string) {
  await ensureSeeded();
  const database = await getDb();
  const normalized = clean(email, 254).toLowerCase();
  const existing = await database.get<SubscriberRow>("SELECT id, email, created_at FROM subscribers WHERE email = ?", normalized);
  if (existing) return mapSubscriber(existing);
  const subscriber = { id: randomUUID(), email: normalized, createdAt: new Date().toISOString() };
  await database.run("INSERT INTO subscribers (id, email, created_at) VALUES (?, ?, ?)", subscriber.id, subscriber.email, subscriber.createdAt);
  return subscriber;
}

export async function getSubmissions(options: { status?: SubmissionStatus | "all"; query?: string; limit?: number; offset?: number } = {}) {
  await ensureSeeded();
  const database = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (options.status && options.status !== "all") { clauses.push("status = ?"); params.push(options.status); }
  if (options.query?.trim()) {
    const query = "%" + clean(options.query, 120).replace(/[%_]/g, "\\$&") + "%";
    clauses.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR topic LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\')");
    params.push(query, query, query, query);
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const rows = await database.all<SubmissionRow[]>(
    "SELECT * FROM contact_submissions" + where + " ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?",
    ...params, limit, offset
  );
  return rows.map(mapSubmission);
}

export async function createSubmission(input: Omit<ContactSubmission, "id" | "status" | "createdAt">) {
  await ensureSeeded();
  const submission: ContactSubmission = { ...input, id: randomUUID(), status: "new", createdAt: new Date().toISOString() };
  await (await getDb()).run(
    "INSERT INTO contact_submissions (id, name, email, phone, topic, message, page_url, status, created_at, read_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, NULL, NULL)",
    submission.id, submission.name, submission.email, submission.phone ?? null, submission.topic, submission.message, submission.pageUrl ?? null, submission.createdAt
  );
  return submission;
}

export async function updateSubmission(id: string, action: "read" | "archive" | "restore") {
  await ensureSeeded();
  const database = await getDb();
  const now = new Date().toISOString();
  if (action === "read") await database.run("UPDATE contact_submissions SET status = 'read', read_at = ?, archived_at = NULL WHERE id = ?", now, id);
  if (action === "archive") await database.run("UPDATE contact_submissions SET status = 'archived', archived_at = ? WHERE id = ?", now, id);
  if (action === "restore") await database.run("UPDATE contact_submissions SET status = 'read', archived_at = NULL WHERE id = ?", id);
  const row = await database.get<SubmissionRow>("SELECT * FROM contact_submissions WHERE id = ?", id);
  if (!row) throw new Error("Submission not found");
  return mapSubmission(row);
}

export async function getActivity(limit = 100) {
  await ensureSeeded();
  const rows = await (await getDb()).all<ActivityRow[]>(
    "SELECT * FROM activity_log ORDER BY datetime(created_at) DESC LIMIT ?", Math.min(Math.max(limit, 1), 200)
  );
  return rows.map(mapActivity);
}

export async function recordActivity(input: { actor: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await ensureSeeded();
  const event: ActivityEvent = { id: randomUUID(), actor: input.actor, action: input.action, entityType: input.entityType, entityId: input.entityId, metadata: input.metadata, createdAt: new Date().toISOString() };
  await (await getDb()).run(
    "INSERT INTO activity_log (id, actor, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    event.id, event.actor, event.action, event.entityType, event.entityId ?? null, event.metadata ? JSON.stringify(event.metadata) : null, event.createdAt
  );
  return event;
}

function browserFromUserAgent(userAgent: string) {
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Other";
}

function deviceFromUserAgent(userAgent: string) {
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "Mobile";
  return "Desktop";
}

export async function recordAnalyticsEvent(input: { eventType: string; path: string; referrer?: string; userAgent?: string; visitorId?: string; metadata?: Record<string, unknown> }) {
  const database = await getDb();
  const ua = clean(input.userAgent, 500);
  await database.run(
    "INSERT INTO analytics_events (id, event_type, path, referrer, browser, device, visitor_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    randomUUID(), clean(input.eventType, 40), clean(input.path, 300) || "/", clean(input.referrer, 500),
    browserFromUserAgent(ua), deviceFromUserAgent(ua), clean(input.visitorId, 100),
    input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()
  );
}

async function snapshotSince(since: Date): Promise<AnalyticsSnapshot> {
  const database = await getDb();
  const cutoff = since.toISOString();
  const total = await database.get<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ?", cutoff);
  const pageAnalytics = await database.all<Array<{ path: string; views: number }>>("SELECT path, COUNT(*) AS views FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ? GROUP BY path ORDER BY views DESC LIMIT 10", cutoff);
  const browserUsage = await database.all<Array<{ name: string; views: number }>>("SELECT browser AS name, COUNT(*) AS views FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ? GROUP BY browser ORDER BY views DESC", cutoff);
  const deviceTypes = await database.all<Array<{ name: string; views: number }>>("SELECT device AS name, COUNT(*) AS views FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ? GROUP BY device ORDER BY views DESC", cutoff);
  const topReferrers = await database.all<Array<{ source: string; visits: number }>>("SELECT CASE WHEN referrer IS NULL OR referrer = '' THEN 'direct' ELSE referrer END AS source, COUNT(*) AS visits FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ? GROUP BY source ORDER BY visits DESC LIMIT 10", cutoff);
  const uniques = await database.get<{ count: number }>("SELECT COUNT(DISTINCT visitor_id) AS count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ? AND visitor_id <> ''", cutoff);
  return {
    totalViews: total?.count ?? 0, pageAnalytics: pageAnalytics ?? [], browserUsage: browserUsage ?? [],
    deviceTypes: deviceTypes ?? [], topReferrers: topReferrers ?? [],
    cloudflarePanel: { requests: total?.count ?? 0, uniques: uniques?.count ?? 0, bandwidthMB: 0 }
  };
}

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const result = {} as AnalyticsSummary;
  const ranges: Array<[TrafficRangeKey, number]> = [["24h", 1], ["7d", 7], ["14d", 14], ["30d", 30]];
  for (const range of ranges) result[range[0]] = await snapshotSince(new Date(Date.now() - range[1] * 86400000));
  return result;
}

export async function getNewsletters() {
  await ensureSeeded();
  const rows = await (await getDb()).all<NewsletterRow[]>("SELECT * FROM scheduled_newsletters ORDER BY datetime(scheduled_for_iso) ASC");
  return rows.map(mapNewsletter);
}

export async function createNewsletter(input: { subject: string; body: string; scheduledForIso: string; recipientIds: string[] }) {
  await ensureSeeded();
  const now = new Date().toISOString();
  const newsletter: NewsletterQueueItem = {
    id: randomUUID(), subject: clean(input.subject, 180), body: clean(input.body, 20000),
    scheduledForIso: input.scheduledForIso, recipientIds: Array.from(new Set(input.recipientIds)),
    status: "queued", createdAt: now, updatedAt: now
  };
  await (await getDb()).run(
    "INSERT INTO scheduled_newsletters (id, subject, body, scheduled_for_iso, recipient_ids, status, created_at, updated_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    newsletter.id, newsletter.subject, newsletter.body, newsletter.scheduledForIso, JSON.stringify(newsletter.recipientIds), newsletter.status, now, now
  );
  return newsletter;
}

export async function updateNewsletter(id: string, input: { subject: string; body: string; scheduledForIso: string; recipientIds: string[] }) {
  await ensureSeeded();
  const database = await getDb();
  const updatedAt = new Date().toISOString();
  await database.run(
    "UPDATE scheduled_newsletters SET subject = ?, body = ?, scheduled_for_iso = ?, recipient_ids = ?, updated_at = ? WHERE id = ? AND status IN ('queued', 'failed')",
    clean(input.subject, 180), clean(input.body, 20000), input.scheduledForIso, JSON.stringify(Array.from(new Set(input.recipientIds))), updatedAt, id
  );
  const row = await database.get<NewsletterRow>("SELECT * FROM scheduled_newsletters WHERE id = ?", id);
  if (!row) throw new Error("Newsletter not found");
  return mapNewsletter(row);
}

export async function deleteNewsletter(id: string) {
  await ensureSeeded();
  await (await getDb()).run("DELETE FROM scheduled_newsletters WHERE id = ? AND status IN ('queued', 'failed')", id);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function bodyToHtml(body: string) {
  return body.split(/\n{2,}/).map((paragraph) => "<p>" + escapeHtml(paragraph).replace(/\n/g, "<br />") + "</p>").join("");
}

async function sendResendEmail(input: { to: string[]; subject: string; text: string; html: string }) {
  const env = await getRuntimeEnv();
  if (!input.to.length) return { delivered: 0, mode: "empty" as const };
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    if (env.NODE_ENV === "production") throw new Error("Resend is not configured.");
    return { delivered: input.to.length, mode: "simulated" as const };
  }
  let delivered = 0;
  for (let index = 0; index < input.to.length; index += 50) {
    const batch = input.to.slice(index, index + 50);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL, to: batch, subject: input.subject, text: input.text, html: input.html,
        ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {})
      })
    });
    if (!response.ok) throw new Error("Resend delivery failed with status " + response.status + ": " + (await response.text()).slice(0, 300));
    delivered += batch.length;
  }
  return { delivered, mode: "resend" as const };
}

export async function sendContactNotification(submission: ContactSubmission) {
  const env = await getRuntimeEnv();
  const recipient = clean(env.CONTACT_TO_EMAIL, 254);
  if (!recipient) return { delivered: 0, mode: "not-configured" as const };
  return sendResendEmail({
    to: [recipient],
    subject: "New contact form submission: " + submission.topic,
    text: [
      "New contact form submission", "Name: " + submission.name, "Email: " + submission.email,
      submission.phone ? "Phone: " + submission.phone : "", "Topic: " + submission.topic,
      submission.pageUrl ? "Page: " + submission.pageUrl : "", "", submission.message
    ].filter(Boolean).join("\n"),
    html: "<h2>New contact form submission</h2><p><strong>Name:</strong> " + escapeHtml(submission.name) +
      "</p><p><strong>Email:</strong> " + escapeHtml(submission.email) + "</p><p><strong>Topic:</strong> " +
      escapeHtml(submission.topic) + "</p><p>" + escapeHtml(submission.message).replace(/\n/g, "<br />") + "</p>"
  });
}

async function deliverNewsletter(newsletter: NewsletterQueueItem, recipients: string[]) {
  return sendResendEmail({ to: recipients, subject: newsletter.subject, text: newsletter.body, html: bodyToHtml(newsletter.body) });
}

export async function sendTestNewsletter(subject: string, body: string, email: string) {
  return sendResendEmail({ to: [clean(email, 254)], subject: "[Test] " + clean(subject, 180), text: body, html: bodyToHtml(body) });
}

export async function processDueNewsletters(limit = 8) {
  await ensureSeeded();
  const database = await getDb();
  const rows = await database.all<NewsletterRow[]>(
    "SELECT * FROM scheduled_newsletters WHERE status = 'queued' AND datetime(scheduled_for_iso) <= datetime(?) ORDER BY datetime(scheduled_for_iso) ASC LIMIT ?",
    new Date().toISOString(), limit
  );
  const subscribers = await getSubscribers();
  const processed: Array<{ id: string; delivered: number; mode: string; status: string }> = [];
  for (const row of rows) {
    const claimedAt = new Date().toISOString();
    await database.run("UPDATE scheduled_newsletters SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'queued'", claimedAt, row.id);
    const newsletter = mapNewsletter({ ...row, status: "processing" });
    const recipients = subscribers.filter((subscriber) => newsletter.recipientIds.includes(subscriber.id)).map((subscriber) => subscriber.email);
    try {
      const delivery = await deliverNewsletter(newsletter, recipients);
      const sentAt = new Date().toISOString();
      await database.run("UPDATE scheduled_newsletters SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?", sentAt, sentAt, newsletter.id);
      processed.push({ id: newsletter.id, delivered: delivery.delivered, mode: delivery.mode, status: "sent" });
    } catch {
      await database.run("UPDATE scheduled_newsletters SET status = 'failed', updated_at = ? WHERE id = ?", new Date().toISOString(), newsletter.id);
      processed.push({ id: newsletter.id, delivered: 0, mode: "error", status: "failed" });
    }
  }
  return processed;
}

export async function getDashboardData(): Promise<AdminData> {
  const result = await Promise.all([
    getSubscribers(), getSubmissions({ limit: 100 }), getActivity(100), getAnalytics(), getNewsletters(), getSiteContent()
  ]);
  return { subscribers: result[0], submissions: result[1], activity: result[2], analytics: result[3], newsletters: result[4], siteContent: result[5] };
}

export async function getSiteContent() {
  await ensureSeeded();
  const row = await (await getDb()).get<SiteContentRow>("SELECT * FROM site_content WHERE singleton_key = 'default'");
  return mapSiteContent(row);
}

export async function saveSiteDraft(draft: SiteEditorContent) {
  await ensureSeeded();
  const normalized = normalizeSiteContent(draft);
  const updatedAt = new Date().toISOString();
  await (await getDb()).run("UPDATE site_content SET draft_json = ?, updated_at = ? WHERE singleton_key = 'default'", JSON.stringify(normalized), updatedAt);
  const current = await getSiteContent();
  return { ...current, draft: normalized, updatedAt };
}

export async function resetSiteDraft() {
  await ensureSeeded();
  const current = await getSiteContent();
  const updatedAt = new Date().toISOString();
  await (await getDb()).run("UPDATE site_content SET draft_json = ?, updated_at = ? WHERE singleton_key = 'default'", JSON.stringify(current.published), updatedAt);
  return { ...current, draft: current.published, updatedAt };
}

export async function publishSiteDraft() {
  await ensureSeeded();
  const current = await getSiteContent();
  const publishedAt = new Date().toISOString();
  await (await getDb()).run("UPDATE site_content SET published_json = ?, draft_json = ?, updated_at = ?, published_at = ? WHERE singleton_key = 'default'", JSON.stringify(current.draft), JSON.stringify(current.draft), publishedAt, publishedAt);
  return { published: current.draft, draft: current.draft, updatedAt: publishedAt, publishedAt };
}
