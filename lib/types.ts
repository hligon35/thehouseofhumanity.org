export type Subscriber = {
  id: string;
  email: string;
  createdAt: string;
};

export type SubmissionStatus = "new" | "read" | "archived";

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  message: string;
  pageUrl?: string;
  status: SubmissionStatus;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
};

export type ActivityEvent = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type TrafficRangeKey = "24h" | "7d" | "14d" | "30d";

export type AnalyticsSnapshot = {
  totalViews: number;
  pageAnalytics: Array<{ path: string; views: number }>;
  browserUsage: Array<{ name: string; views: number }>;
  deviceTypes: Array<{ name: string; views: number }>;
  topReferrers: Array<{ source: string; visits: number }>;
  cloudflarePanel: { requests: number; uniques: number; bandwidthMB: number };
};

export type AnalyticsSummary = Record<TrafficRangeKey, AnalyticsSnapshot>;

export type NewsletterStatus = "queued" | "processing" | "sent" | "failed";

export type NewsletterQueueItem = {
  id: string;
  subject: string;
  body: string;
  scheduledForIso: string;
  recipientIds: string[];
  status: NewsletterStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};

export type SiteEvent = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
};

export type SiteProduct = {
  id: string;
  title: string;
  description: string;
  priceLabel: string;
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
};

export type SiteEditorContent = {
  about: {
    title: string;
    subtitle: string;
    missionHeading: string;
    missionBody: string;
    visionHeading: string;
    visionBody: string;
  };
  newsletter: { title: string; body: string; ctaLabel: string };
  events: { heading: string; intro: string; items: SiteEvent[] };
  shop: { heading: string; body: string; ctaLabel: string; ctaHref: string; products: SiteProduct[] };
  colors: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string };
  images: {
    founder: { src: string; alt: string };
    newsletter: { src: string; alt: string };
  };
};

export type SiteContentRecord = {
  published: SiteEditorContent;
  draft: SiteEditorContent;
  updatedAt: string;
  publishedAt: string;
};

export type AdminPrincipal = {
  username: string;
  email: string;
  authType: "cloudflare-access" | "local" | "google";
};

export type AdminData = {
  subscribers: Subscriber[];
  submissions: ContactSubmission[];
  activity: ActivityEvent[];
  analytics: AnalyticsSummary;
  newsletters: NewsletterQueueItem[];
  siteContent: SiteContentRecord;
};
