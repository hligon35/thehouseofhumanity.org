import type { AdminData, SiteEditorContent } from "@/lib/types";

export const defaultSiteContent: SiteEditorContent = {
  about: {
    title: "About The House of Humanity",
    subtitle: "Restoring dignity and renewing dreams for families in need",
    missionHeading: "Our Mission",
    missionBody:
      "Our mission is clear and unchanging: Renewing Dreams, Restoring Dignity. We strive to be a cornerstone in the lives of homeless families and victims of domestic violence, providing them with the support needed to overcome adversity.",
    visionHeading: "Our Vision",
    visionBody:
      "We envision a future in which everyone, regardless of circumstance, has a place to call home-a safe haven where aspirations may be revived and dignity can be restored."
  },
  newsletter: {
    title: "Stay Connected",
    body:
      "Subscribe for event updates, donation drives, and stories from the families and volunteers who keep this mission moving.",
    ctaLabel: "Join the newsletter"
  },
  events: {
    heading: "Seasonal Events",
    intro:
      "There are no upcoming public events scheduled right now. Please check back soon or contact us if you would like to be added to future event and volunteer updates.",
    items: [
      {
        id: "thanksgiving-highlight",
        title: "Past Community Outreach Highlight",
        description:
          "No upcoming events are scheduled at this time. Check back soon, or use the contact form to request future event and volunteer updates.",
        ctaLabel: "Request Event Updates",
        ctaHref: "#contact",
        imageSrc: "images/THOHTGevent.webp",
        imageAlt: "Thanksgiving community outreach flyer"
      }
    ]
  },
  shop: {
    heading: "Support the Mission",
    body:
      "Use the donation options below to support emergency shelter, food access, and family services while our merchandise program is being refreshed.",
    ctaLabel: "Donate now",
    ctaHref: "#donate",
    products: [
      {
        id: "support-bundle",
        title: "Family Support Bundle",
        description: "Direct this featured giving bundle toward shelter nights, care kits, and emergency outreach support.",
        priceLabel: "$50 suggested",
        ctaLabel: "Support a family",
        ctaHref: "#donate",
        featured: true
      }
    ]
  },
  colors: {
    primary: "#02c9aa",
    secondary: "#6c2eb7",
    accent: "#f4b740",
    background: "#f7f6fa",
    surface: "#ffffff",
    text: "#18212f"
  },
  images: {
    founder: {
      src: "images/BridgetCharles.webp",
      alt: "Founder Bridget Charles"
    },
    newsletter: {
      src: "images/GroupRun4Humanity.webp",
      alt: "Volunteers gathering at a House of Humanity community event"
    }
  }
};

export const defaultAdminData: AdminData = {
  subscribers: [
    {
      id: "subscriber-1",
      email: "supporter@thehouseofhumanity.org",
      createdAt: "2026-05-01T14:00:00.000Z"
    },
    {
      id: "subscriber-2",
      email: "volunteer@thehouseofhumanity.org",
      createdAt: "2026-05-14T16:30:00.000Z"
    }
  ],
  analytics: {
    "24h": {
      totalViews: 168,
      pageAnalytics: [
        { path: "/", views: 126 },
        { path: "/contact-us", views: 24 },
        { path: "/#donate", views: 18 }
      ],
      browserUsage: [
        { name: "Chrome", views: 92 },
        { name: "Safari", views: 49 },
        { name: "Edge", views: 27 }
      ],
      deviceTypes: [
        { name: "Mobile", views: 104 },
        { name: "Desktop", views: 52 },
        { name: "Tablet", views: 12 }
      ],
      topReferrers: [
        { source: "google.com", visits: 74 },
        { source: "facebook.com", visits: 28 },
        { source: "direct", visits: 21 }
      ],
      cloudflarePanel: {
        requests: 412,
        uniques: 181,
        bandwidthMB: 31
      }
    },
    "7d": {
      totalViews: 1142,
      pageAnalytics: [
        { path: "/", views: 924 },
        { path: "/contact-us", views: 136 },
        { path: "/#donate", views: 82 }
      ],
      browserUsage: [
        { name: "Chrome", views: 668 },
        { name: "Safari", views: 301 },
        { name: "Edge", views: 173 }
      ],
      deviceTypes: [
        { name: "Mobile", views: 738 },
        { name: "Desktop", views: 348 },
        { name: "Tablet", views: 56 }
      ],
      topReferrers: [
        { source: "google.com", visits: 442 },
        { source: "facebook.com", visits: 156 },
        { source: "direct", visits: 118 }
      ],
      cloudflarePanel: {
        requests: 2848,
        uniques: 1236,
        bandwidthMB: 186
      }
    },
    "14d": {
      totalViews: 2476,
      pageAnalytics: [
        { path: "/", views: 2042 },
        { path: "/contact-us", views: 258 },
        { path: "/#donate", views: 176 }
      ],
      browserUsage: [
        { name: "Chrome", views: 1458 },
        { name: "Safari", views: 642 },
        { name: "Edge", views: 376 }
      ],
      deviceTypes: [
        { name: "Mobile", views: 1598 },
        { name: "Desktop", views: 766 },
        { name: "Tablet", views: 112 }
      ],
      topReferrers: [
        { source: "google.com", visits: 896 },
        { source: "facebook.com", visits: 322 },
        { source: "direct", visits: 248 }
      ],
      cloudflarePanel: {
        requests: 6180,
        uniques: 2724,
        bandwidthMB: 417
      }
    },
    "30d": {
      totalViews: 4832,
      pageAnalytics: [
        { path: "/", views: 4120 },
        { path: "/contact-us", views: 421 },
        { path: "/#donate", views: 291 }
      ],
      browserUsage: [
        { name: "Chrome", views: 2880 },
        { name: "Safari", views: 1094 },
        { name: "Edge", views: 558 }
      ],
      deviceTypes: [
        { name: "Mobile", views: 3084 },
        { name: "Desktop", views: 1573 },
        { name: "Tablet", views: 175 }
      ],
      topReferrers: [
        { source: "google.com", visits: 1772 },
        { source: "facebook.com", visits: 642 },
        { source: "direct", visits: 514 }
      ],
      cloudflarePanel: {
        requests: 12014,
        uniques: 5210,
        bandwidthMB: 842
      }
    }
  },
  newsletters: [],
  siteContent: {
    published: defaultSiteContent,
    draft: defaultSiteContent,
    updatedAt: "2026-05-25T00:00:00.000Z",
    publishedAt: "2026-05-25T00:00:00.000Z"
  }
};