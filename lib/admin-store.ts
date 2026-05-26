import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { defaultAdminData, defaultSiteContent } from "@/lib/defaults";
import { getDb } from "@/lib/db";
import type { AdminData, NewsletterQueueItem, SiteContentRecord, SiteEditorContent, SiteEvent, SiteProduct, Subscriber } from "@/lib/types";

type AdminCredentialRow = {
  username: string;
  password_hash: string;
  updated_at: string;
};

type PasswordResetTokenRow = {
  id: string;
  username: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type SiteContentRow = {
  singleton_key: string;
  published_json: string;
  draft_json: string;
  updated_at: string;
  published_at: string;
};

type NewsletterRow = {
  id: string;
  subject: string;
  body: string;
  scheduled_for_iso: string;
  recipient_ids: string;
  status: "queued" | "sent";
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

type SubscriberRow = {
  id: string;
  email: string;
  created_at: string;
};

let seeded = false;
let seedPromise: Promise<void> | undefined;

function getDefaultAdminCredentials() {
  return [
    {
      username: process.env.ADMIN_USERNAME ?? "admin",
      password: process.env.ADMIN_PASSWORD ?? "HumanityAdmin!2026"
    },
    {
      username: process.env.ADMIN_SECONDARY_USERNAME ?? "HouseOpsAdmin",
      password: process.env.ADMIN_SECONDARY_PASSWORD ?? "HumanityAdminBackup!2026"
    }
  ];
}

function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(expectedHash, "hex"));
}

function mapSubscriber(row: SubscriberRow): Subscriber {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at
  };
}

function mapNewsletter(row: NewsletterRow): NewsletterQueueItem {
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    scheduledForIso: row.scheduled_for_iso,
    recipientIds: JSON.parse(row.recipient_ids) as string[],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at ?? undefined
  };
}

function normalizeSiteEvent(event: Partial<SiteEvent> | undefined, fallback: SiteEvent): SiteEvent {
  return {
    id: event?.id ?? fallback.id,
    title: event?.title ?? fallback.title,
    description: event?.description ?? fallback.description,
    ctaLabel: event?.ctaLabel ?? fallback.ctaLabel,
    ctaHref: event?.ctaHref ?? fallback.ctaHref,
    imageSrc: event?.imageSrc ?? fallback.imageSrc,
    imageAlt: event?.imageAlt ?? fallback.imageAlt
  };
}

function normalizeSiteProduct(product: Partial<SiteProduct> | undefined, fallback: SiteProduct): SiteProduct {
  return {
    id: product?.id ?? fallback.id,
    title: product?.title ?? fallback.title,
    description: product?.description ?? fallback.description,
    priceLabel: product?.priceLabel ?? fallback.priceLabel,
    ctaLabel: product?.ctaLabel ?? fallback.ctaLabel,
    ctaHref: product?.ctaHref ?? fallback.ctaHref,
    featured: product?.featured ?? fallback.featured
  };
}

function normalizeSiteContent(content: Partial<SiteEditorContent> | undefined): SiteEditorContent {
  const defaultEvent = defaultSiteContent.events.items[0];
  const defaultProduct = defaultSiteContent.shop.products[0];

  return {
    about: {
      ...defaultSiteContent.about,
      ...(content?.about ?? {})
    },
    newsletter: {
      ...defaultSiteContent.newsletter,
      ...(content?.newsletter ?? {})
    },
    events: {
      heading: content?.events?.heading ?? defaultSiteContent.events.heading,
      intro: content?.events?.intro ?? defaultSiteContent.events.intro,
      items: (content?.events?.items?.length ? content.events.items : defaultSiteContent.events.items).map((item) =>
        normalizeSiteEvent(item, defaultEvent)
      )
    },
    shop: {
      heading: content?.shop?.heading ?? defaultSiteContent.shop.heading,
      body: content?.shop?.body ?? defaultSiteContent.shop.body,
      ctaLabel: content?.shop?.ctaLabel ?? defaultSiteContent.shop.ctaLabel,
      ctaHref: content?.shop?.ctaHref ?? defaultSiteContent.shop.ctaHref,
      products: (content?.shop?.products?.length ? content.shop.products : defaultSiteContent.shop.products).map((product) =>
        normalizeSiteProduct(product, defaultProduct)
      )
    },
    colors: {
      ...defaultSiteContent.colors,
      ...(content?.colors ?? {})
    },
    images: {
      founder: {
        ...defaultSiteContent.images.founder,
        ...(content?.images?.founder ?? {})
      },
      newsletter: {
        ...defaultSiteContent.images.newsletter,
        ...(content?.images?.newsletter ?? {})
      }
    }
  };
}

function mapSiteContent(row: SiteContentRow | undefined): SiteContentRecord {
  if (!row) {
    return defaultAdminData.siteContent;
  }

  return {
    published: normalizeSiteContent(JSON.parse(row.published_json) as Partial<SiteEditorContent>),
    draft: normalizeSiteContent(JSON.parse(row.draft_json) as Partial<SiteEditorContent>),
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

async function ensureSeeded() {
  if (seeded) {
    return;
  }

  if (seedPromise) {
    await seedPromise;
    return;
  }

  seedPromise = (async () => {
    const database = await getDb();

    for (const subscriber of defaultAdminData.subscribers) {
      await database.run(
        "INSERT OR IGNORE INTO subscribers (id, email, created_at) VALUES (?, ?, ?)",
        subscriber.id,
        subscriber.email,
        subscriber.createdAt
      );
    }

    await database.run(
      "INSERT OR IGNORE INTO site_content (singleton_key, published_json, draft_json, updated_at, published_at) VALUES ('default', ?, ?, ?, ?)",
      JSON.stringify(defaultSiteContent),
      JSON.stringify(defaultSiteContent),
      defaultAdminData.siteContent.updatedAt,
      defaultAdminData.siteContent.publishedAt
    );

    for (const credentials of getDefaultAdminCredentials()) {
      await database.run(
        "INSERT OR IGNORE INTO admin_credentials (username, password_hash, updated_at) VALUES (?, ?, ?)",
        credentials.username,
        createPasswordHash(credentials.password),
        new Date().toISOString()
      );
    }

    seeded = true;
  })();

  try {
    await seedPromise;
  } finally {
    seedPromise = undefined;
  }
}

async function getAdminCredentialsRow(username?: string) {
  await ensureSeeded();
  const database = await getDb();

  const row = username
    ? await database.get<AdminCredentialRow>("SELECT * FROM admin_credentials WHERE username = ?", username)
    : await database.get<AdminCredentialRow>("SELECT * FROM admin_credentials ORDER BY username ASC LIMIT 1");

  if (!row) {
    throw new Error("Admin credentials not configured");
  }

  return row;
}

export async function getAdminUsername() {
  const [primaryCredentials] = getDefaultAdminCredentials();
  const row = await getAdminCredentialsRow(primaryCredentials.username);
  return row.username;
}

export async function validateAdminLogin(username: string, password: string) {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return false;
  }

  const row = await getAdminCredentialsRow(normalizedUsername).catch(() => null);
  return Boolean(row && verifyPasswordHash(password, row.password_hash));
}

export async function createPasswordReset(username: string) {
  const normalizedUsername = username.trim();
  const row = await getAdminCredentialsRow(normalizedUsername).catch(() => null);
  const database = await getDb();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  if (!row) {
    return { resetLink: null, expiresAt: null };
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createPasswordHash(token);

  await database.run("DELETE FROM password_reset_tokens WHERE username = ? OR datetime(expires_at) < datetime('now')", row.username);
  await database.run(
    "INSERT INTO password_reset_tokens (id, username, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    randomUUID(),
    row.username,
    tokenHash,
    expiresAt,
    new Date().toISOString()
  );

  return {
    resetLink: `/admin?mode=reset&token=${encodeURIComponent(token)}`,
    expiresAt
  };
}

export async function resetPasswordWithToken(token: string, nextPassword: string) {
  const trimmedToken = token.trim();
  const trimmedPassword = nextPassword.trim();

  if (trimmedPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await ensureSeeded();
  const database = await getDb();
  const rows = await database.all<PasswordResetTokenRow[]>(
    "SELECT * FROM password_reset_tokens WHERE used_at IS NULL ORDER BY datetime(created_at) DESC"
  );

  const matchingRow = rows.find((row) => {
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return false;
    }

    return verifyPasswordHash(trimmedToken, row.token_hash);
  });

  if (!matchingRow) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const updatedAt = new Date().toISOString();
  await database.run(
    "UPDATE admin_credentials SET password_hash = ?, updated_at = ? WHERE username = ?",
    createPasswordHash(trimmedPassword),
    updatedAt,
    matchingRow.username
  );
  await database.run(
    "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
    updatedAt,
    matchingRow.id
  );
}

export async function getSubscribers() {
  await ensureSeeded();
  const database = await getDb();
  const rows = await database.all<SubscriberRow[]>(
    "SELECT id, email, created_at FROM subscribers ORDER BY datetime(created_at) DESC"
  );
  return rows.map(mapSubscriber);
}

export async function addSubscriber(email: string) {
  await ensureSeeded();
  const database = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await database.get<SubscriberRow>(
    "SELECT id, email, created_at FROM subscribers WHERE email = ?",
    normalizedEmail
  );

  if (existing) {
    return mapSubscriber(existing);
  }

  const subscriber: Subscriber = {
    id: randomUUID(),
    email: normalizedEmail,
    createdAt: new Date().toISOString()
  };

  await database.run(
    "INSERT INTO subscribers (id, email, created_at) VALUES (?, ?, ?)",
    subscriber.id,
    subscriber.email,
    subscriber.createdAt
  );

  return subscriber;
}

export async function getNewsletters() {
  await ensureSeeded();
  const database = await getDb();
  const rows = await database.all<NewsletterRow[]>(
    "SELECT * FROM scheduled_newsletters ORDER BY datetime(scheduled_for_iso) ASC"
  );
  return rows.map(mapNewsletter);
}

export async function createNewsletter(input: {
  subject: string;
  body: string;
  scheduledForIso: string;
  recipientIds: string[];
}) {
  await ensureSeeded();
  const database = await getDb();
  const newsletter: NewsletterQueueItem = {
    id: randomUUID(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    scheduledForIso: input.scheduledForIso,
    recipientIds: input.recipientIds,
    status: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await database.run(
    `INSERT INTO scheduled_newsletters
      (id, subject, body, scheduled_for_iso, recipient_ids, status, created_at, updated_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    newsletter.id,
    newsletter.subject,
    newsletter.body,
    newsletter.scheduledForIso,
    JSON.stringify(newsletter.recipientIds),
    newsletter.status,
    newsletter.createdAt,
    newsletter.updatedAt
  );

  return newsletter;
}

export async function updateNewsletter(id: string, input: {
  subject: string;
  body: string;
  scheduledForIso: string;
  recipientIds: string[];
}) {
  await ensureSeeded();
  const database = await getDb();
  const updatedAt = new Date().toISOString();
  await database.run(
    `UPDATE scheduled_newsletters
     SET subject = ?, body = ?, scheduled_for_iso = ?, recipient_ids = ?, updated_at = ?
     WHERE id = ?`,
    input.subject.trim(),
    input.body.trim(),
    input.scheduledForIso,
    JSON.stringify(input.recipientIds),
    updatedAt,
    id
  );

  const row = await database.get<NewsletterRow>("SELECT * FROM scheduled_newsletters WHERE id = ?", id);
  if (!row) {
    throw new Error("Newsletter not found");
  }

  return mapNewsletter(row);
}

export async function deleteNewsletter(id: string) {
  await ensureSeeded();
  const database = await getDb();
  await database.run("DELETE FROM scheduled_newsletters WHERE id = ?", id);
}

export async function getSiteContent() {
  await ensureSeeded();
  const database = await getDb();
  const row = await database.get<SiteContentRow>(
    "SELECT * FROM site_content WHERE singleton_key = 'default'"
  );
  return mapSiteContent(row);
}

export async function saveSiteDraft(draft: SiteEditorContent) {
  await ensureSeeded();
  const database = await getDb();
  const current = await getSiteContent();
  const updatedAt = new Date().toISOString();

  await database.run(
    "UPDATE site_content SET draft_json = ?, updated_at = ? WHERE singleton_key = 'default'",
    JSON.stringify(normalizeSiteContent(draft)),
    updatedAt
  );

  return {
    ...current,
    draft: normalizeSiteContent(draft),
    updatedAt
  };
}

export async function resetSiteDraft() {
  await ensureSeeded();
  const database = await getDb();
  const current = await getSiteContent();
  const updatedAt = new Date().toISOString();

  await database.run(
    "UPDATE site_content SET draft_json = ?, updated_at = ? WHERE singleton_key = 'default'",
    JSON.stringify(current.published),
    updatedAt
  );

  return {
    ...current,
    draft: current.published,
    updatedAt
  };
}

export async function publishSiteDraft() {
  await ensureSeeded();
  const database = await getDb();
  const current = await getSiteContent();
  const publishedAt = new Date().toISOString();

  await database.run(
    "UPDATE site_content SET published_json = ?, draft_json = ?, updated_at = ?, published_at = ? WHERE singleton_key = 'default'",
    JSON.stringify(current.draft),
    JSON.stringify(current.draft),
    publishedAt,
    publishedAt
  );

  return {
    published: current.draft,
    draft: current.draft,
    updatedAt: publishedAt,
    publishedAt
  };
}

async function sendNewsletter(subject: string, body: string, recipients: string[]) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail || recipients.length === 0) {
    return { delivered: recipients.length, mode: "simulated" as const };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: fromEmail },
      subject,
      content: [{ type: "text/plain", value: body }]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`SendGrid delivery failed: ${details}`);
  }

  return { delivered: recipients.length, mode: "sendgrid" as const };
}

export async function processDueNewsletters(limit = 8) {
  await ensureSeeded();
  const database = await getDb();
  const dueRows = await database.all<NewsletterRow[]>(
    `SELECT * FROM scheduled_newsletters
     WHERE status = 'queued' AND datetime(scheduled_for_iso) <= datetime(?)
     ORDER BY datetime(scheduled_for_iso) ASC
     LIMIT ?`,
    new Date().toISOString(),
    limit
  );

  const subscribers = await getSubscribers();
  const processed: Array<{ id: string; delivered: number; mode: "simulated" | "sendgrid" }> = [];

  for (const row of dueRows) {
    const newsletter = mapNewsletter(row);
    const recipients = subscribers
      .filter((subscriber) => newsletter.recipientIds.includes(subscriber.id))
      .map((subscriber) => subscriber.email);

    const delivery = await sendNewsletter(newsletter.subject, newsletter.body, recipients);
    const sentAt = new Date().toISOString();

    await database.run(
      "UPDATE scheduled_newsletters SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?",
      sentAt,
      sentAt,
      newsletter.id
    );

    processed.push({ id: newsletter.id, delivered: delivery.delivered, mode: delivery.mode });
  }

  return processed;
}

export async function getDashboardData(): Promise<AdminData> {
  const [subscribers, newsletters, siteContent] = await Promise.all([
    getSubscribers(),
    getNewsletters(),
    getSiteContent()
  ]);

  return {
    subscribers,
    newsletters,
    analytics: defaultAdminData.analytics,
    siteContent
  };
}