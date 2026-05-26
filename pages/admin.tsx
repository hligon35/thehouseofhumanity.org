import Image from "next/image";
import Head from "next/head";
import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { getAdminUsername, getDashboardData } from "@/lib/admin-store";
import { getSessionFromRequest } from "@/lib/session";
import type { AdminData, NewsletterQueueItem, SiteEditorContent, Subscriber, TrafficRangeKey } from "@/lib/types";

type TabKey = "traffic" | "newsletter" | "editor" | "help";
type HelpSectionKey = "navigation" | "traffic" | "newsletter" | "editor";
type AuthMode = "login" | "forgot" | "reset";
type EditorTabKey = "about" | "newsletter" | "events" | "shop" | "colors" | "images";
type EventsMode = "page" | "cards";
type ShopMode = "page" | "products";

type AdminPageProps = {
  authenticated: boolean;
  username: string | null;
  data: AdminData | null;
};

type NewsletterFormState = {
  subject: string;
  body: string;
  scheduledForLocal: string;
};

const adminLogoSrc = "/website/images/THOHlogo.png";

const navItems: Array<{ key: TabKey; label: string; description: string; iconSrc: string; iconAlt: string }> = [
  { key: "traffic", label: "Web Traffic", description: "Subscribers, browsers, devices, and referrers", iconSrc: "/icons/webAnalytics.png", iconAlt: "Web traffic icon" },
  { key: "newsletter", label: "Newsletter", description: "Compose sends, manage recipients, and process queue", iconSrc: "/icons/newsletter.png", iconAlt: "Newsletter icon" },
  { key: "editor", label: "Site Editor", description: "Draft, publish, and update live website sections", iconSrc: "/icons/webEditor.png", iconAlt: "Site editor icon" },
  { key: "help", label: "Help", description: "Quick instructions for every control family", iconSrc: "/icons/help.png", iconAlt: "Help icon" }
];

const helpSections: Record<HelpSectionKey, { title: string; items: Array<{ label: string; body: string }> }> = {
  navigation: {
    title: "Dashboard Navigation",
    items: [
      { label: "Drawer navigation", body: "Use the drawer to move between traffic, newsletter, site editor, and help screens." },
      { label: "Mobile drawer", body: "Open the slide-out menu from the House of Humanity header and close it by tapping the overlay or the close control." }
    ]
  },
  traffic: {
    title: "Web Traffic Controls",
    items: [
      { label: "Analytics layout", body: "The Web Traffic tab keeps subscriber management and analytics in one place while keeping the Cloudflare panel separate." },
      { label: "Add subscriber", body: "Use the plus button in Subscribers to reveal the add-subscriber form only when needed." }
    ]
  },
  newsletter: {
    title: "Newsletter Controls",
    items: [
      { label: "Compose", body: "Schedule newsletters in your local timezone, choose recipients manually or in bulk, and manage queued items below the composer." },
      { label: "Process queue", body: "Process Due Newsletters Now will send up to eight due queued items in one run and will ask for confirmation first." }
    ]
  },
  editor: {
    title: "Site Editor Controls",
    items: [
      { label: "Draft actions", body: "Save Draft stores changes without affecting the live site, Reset restores the published version, and Publish pushes the current draft live." },
      { label: "Focused editing", body: "Only the selected help topic is shown so admins can focus on the controls they are using." }
    ]
  }
};

const emptyNewsletterForm: NewsletterFormState = {
  subject: "",
  body: "",
  scheduledForLocal: ""
};

const editorTabs: Array<{ key: EditorTabKey; label: string }> = [
  { key: "about", label: "About Section" },
  { key: "newsletter", label: "Newsletter" },
  { key: "events", label: "Events" },
  { key: "shop", label: "Shop" },
  { key: "colors", label: "Colors" },
  { key: "images", label: "Images" }
];

const trafficRanges: Array<{ key: TrafficRangeKey; label: string }> = [
  { key: "24h", label: "Past 24 hrs" },
  { key: "7d", label: "Past 7 days" },
  { key: "14d", label: "Past 14 days" },
  { key: "30d", label: "Past 30 days" }
];

function toLocalInputValue(iso?: string) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoString(localValue: string) {
  return new Date(localValue).toISOString();
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`admin-brand ${compact ? "admin-brand--compact" : ""}`}>
      <div className="admin-brand-mark">
        <Image src={adminLogoSrc} alt="The House of Humanity logo" width={72} height={72} className="admin-brand-logo" priority={compact} />
      </div>
      <div className="admin-brand-copy">
        <p className="admin-sidebar-label">Admin</p>
        <strong>The House of Humanity</strong>
      </div>
    </div>
  );
}

function IconLabel({ src, alt, label, size = 18 }: { src: string; alt: string; label: string; size?: number }) {
  return (
    <span className="admin-button-content">
      <Image src={src} alt={alt} width={size} height={size} className="admin-button-icon" />
      <span>{label}</span>
    </span>
  );
}

export default function AdminPage({ authenticated, username, data }: AdminPageProps) {
  const initialUsername = username ?? "admin";
  const [activeTab, setActiveTab] = useState<TabKey>("traffic");
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [loginState, setLoginState] = useState({ username: initialUsername, password: "", error: "", notice: "", loading: false });
  const [forgotState, setForgotState] = useState({ username: initialUsername, error: "", message: "", resetLink: "", loading: false });
  const [resetState, setResetState] = useState({ token: "", password: "", confirmPassword: "", error: "", message: "", loading: false });
  const [dashboardData, setDashboardData] = useState<AdminData | null>(data);
  const [trafficAddVisible, setTrafficAddVisible] = useState(false);
  const [newsletterAddVisible, setNewsletterAddVisible] = useState(false);
  const [trafficEmail, setTrafficEmail] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterForm, setNewsletterForm] = useState<NewsletterFormState>(emptyNewsletterForm);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const [editingNewsletterId, setEditingNewsletterId] = useState<string | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteEditorContent | null>(data?.siteContent.draft ?? null);
  const [helpSection, setHelpSection] = useState<HelpSectionKey>("navigation");
  const [editorTab, setEditorTab] = useState<EditorTabKey>("about");
  const [eventsMode, setEventsMode] = useState<EventsMode>("page");
  const [shopMode, setShopMode] = useState<ShopMode>("page");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(data?.siteContent.draft.events.items[0]?.id ?? null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(data?.siteContent.draft.shop.products[0]?.id ?? null);
  const [, setStatusMessage] = useState("");
  const [timeZone, setTimeZone] = useState("Local time");
  const [trafficRange, setTrafficRange] = useState<TrafficRangeKey>("24h");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    setDashboardData(data);
    setSiteDraft(data?.siteContent.draft ?? null);
    setSelectedEventId(data?.siteContent.draft.events.items[0]?.id ?? null);
    setSelectedProductId(data?.siteContent.draft.shop.products[0]?.id ?? null);
  }, [data]);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time");
  }, []);

  useEffect(() => {
    if (authenticated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const token = params.get("token") ?? "";

    if (mode === "reset") {
      setAuthMode("reset");
      setResetState((current) => ({ ...current, token, error: token ? "" : "This reset link is invalid or has expired." }));
      return;
    }

    if (mode === "forgot") {
      setAuthMode("forgot");
    }
  }, [authenticated]);

  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      ...init
    });

    const payload: unknown = await response.json();
    if (!response.ok) {
      const errorMessage =
        typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Request failed";
      throw new Error(errorMessage);
    }

    return payload as T;
  }

  function updateDashboard(partial: Partial<AdminData>) {
    setDashboardData((current) => (current ? { ...current, ...partial } : current));
  }

  function resetNewsletterComposer() {
    setNewsletterForm(emptyNewsletterForm);
    setSelectedSubscriberIds([]);
    setEditingNewsletterId(null);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState((current) => ({ ...current, loading: true, error: "", notice: "" }));

    try {
      await requestJson<{ ok: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: loginState.username, password: loginState.password })
      });
      window.location.reload();
    } catch (error) {
      setLoginState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Login failed"
      }));
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotState((current) => ({ ...current, loading: true, error: "", message: "", resetLink: "" }));

    try {
      const response = await requestJson<{ message: string; resetLink: string | null }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ username: forgotState.username })
      });

      setForgotState((current) => ({
        ...current,
        loading: false,
        message: response.message,
        resetLink: response.resetLink ?? ""
      }));
    } catch (error) {
      setForgotState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to prepare reset link."
      }));
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetState.token) {
      setResetState((current) => ({ ...current, error: "This reset link is invalid or has expired." }));
      return;
    }

    if (resetState.password !== resetState.confirmPassword) {
      setResetState((current) => ({ ...current, error: "Passwords do not match." }));
      return;
    }

    setResetState((current) => ({ ...current, loading: true, error: "", message: "" }));

    try {
      await requestJson<{ ok: boolean }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetState.token, password: resetState.password })
      });

      setResetState((current) => ({
        ...current,
        loading: false,
        password: "",
        confirmPassword: "",
        message: "Password updated. Return to login and sign in with the new password."
      }));
      setLoginState((current) => ({ ...current, password: "", error: "", notice: "Password updated. Sign in with the new password." }));
    } catch (error) {
      setResetState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to reset password."
      }));
    }
  }

  async function handleLogout() {
    await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    window.location.reload();
  }

  async function handleAddSubscriber(source: "traffic" | "newsletter") {
    const email = source === "traffic" ? trafficEmail : newsletterEmail;
    setBusyAction("subscriber");

    try {
      const response = await requestJson<{ subscriber: Subscriber; subscribers: Subscriber[] }>("/api/subscribers", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      updateDashboard({ subscribers: response.subscribers });
      if (source === "traffic") {
        setTrafficEmail("");
        setTrafficAddVisible(false);
        setStatusMessage(`Added ${response.subscriber.email} to subscribers.`);
      } else {
        setNewsletterEmail("");
        setNewsletterAddVisible(false);
        setSelectedSubscriberIds((current) => Array.from(new Set([...current, response.subscriber.id])));
        setStatusMessage(`Added and selected ${response.subscriber.email}.`);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to add subscriber.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleScheduleNewsletter() {
    if (!window.confirm(editingNewsletterId ? "Save changes to this queued newsletter?" : "Schedule this newsletter?")) {
      return;
    }

    setBusyAction("newsletter");
    try {
      const payload = {
        ...(editingNewsletterId ? { id: editingNewsletterId } : {}),
        subject: newsletterForm.subject,
        body: newsletterForm.body,
        scheduledForIso: toIsoString(newsletterForm.scheduledForLocal),
        recipientIds: selectedSubscriberIds
      };

      const response = await requestJson<{ newsletters: NewsletterQueueItem[] }>("/api/newsletters", {
        method: editingNewsletterId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      updateDashboard({ newsletters: response.newsletters });
      resetNewsletterComposer();
      setStatusMessage(editingNewsletterId ? "Queued newsletter updated." : "Newsletter scheduled.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save newsletter.");
    } finally {
      setBusyAction("");
    }
  }

  function handleEditNewsletter(newsletter: NewsletterQueueItem) {
    setActiveTab("newsletter");
    setEditingNewsletterId(newsletter.id);
    setNewsletterForm({
      subject: newsletter.subject,
      body: newsletter.body,
      scheduledForLocal: toLocalInputValue(newsletter.scheduledForIso)
    });
    setSelectedSubscriberIds(newsletter.recipientIds);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteNewsletter(id: string) {
    if (!window.confirm("Delete this queued newsletter?")) {
      return;
    }

    setBusyAction(id);
    try {
      const response = await requestJson<{ newsletters: NewsletterQueueItem[] }>(`/api/newsletters?id=${id}`, {
        method: "DELETE"
      });
      updateDashboard({ newsletters: response.newsletters });
      if (editingNewsletterId === id) {
        resetNewsletterComposer();
      }
      setStatusMessage("Queued newsletter deleted.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete newsletter.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleProcessNewsletters() {
    if (!window.confirm("Process up to 8 due newsletters now?")) {
      return;
    }

    setBusyAction("process");
    try {
      const response = await requestJson<{ processed: Array<{ id: string; delivered: number; mode: string }>; newsletters: NewsletterQueueItem[] }>(
        "/api/newsletters/process",
        { method: "POST", body: JSON.stringify({}) }
      );
      updateDashboard({ newsletters: response.newsletters });
      setStatusMessage(
        response.processed.length > 0
          ? `Processed ${response.processed.length} queued newsletter${response.processed.length === 1 ? "" : "s"}.`
          : "No due newsletters were ready to process."
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to process newsletters.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveDraft() {
    if (!siteDraft) {
      return;
    }

    setBusyAction("draft-save");
    try {
      const response = await requestJson<{ siteContent: AdminData["siteContent"] }>("/api/site-content", {
        method: "PUT",
        body: JSON.stringify({ action: "save", draft: siteDraft })
      });
      updateDashboard({ siteContent: response.siteContent });
      setSiteDraft(response.siteContent.draft);
      setStatusMessage("Draft saved.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleResetDraft() {
    setBusyAction("draft-reset");
    try {
      const response = await requestJson<{ siteContent: AdminData["siteContent"] }>("/api/site-content", {
        method: "PUT",
        body: JSON.stringify({ action: "reset" })
      });
      updateDashboard({ siteContent: response.siteContent });
      setSiteDraft(response.siteContent.draft);
      setStatusMessage("Draft reset to published content.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to reset draft.");
    } finally {
      setBusyAction("");
    }
  }

  async function handlePublishDraft() {
    if (!window.confirm("Publish these site editor changes to the live site?")) {
      return;
    }

    setBusyAction("draft-publish");
    try {
      const response = await requestJson<{ siteContent: AdminData["siteContent"] }>("/api/site-content", {
        method: "PUT",
        body: JSON.stringify({ action: "publish" })
      });
      updateDashboard({ siteContent: response.siteContent });
      setSiteDraft(response.siteContent.draft);
      setStatusMessage("Changes published to the live site feed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to publish changes.");
    } finally {
      setBusyAction("");
    }
  }

  function updateSiteDraft(updater: (current: SiteEditorContent) => SiteEditorContent) {
    setSiteDraft((current) => (current ? updater(current) : current));
  }

  function addEventCard() {
    const nextId = `event-${Date.now()}`;
    updateSiteDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        items: [
          ...current.events.items,
          {
            id: nextId,
            title: "New event card",
            description: "Add event details, media notes, and a call to action.",
            ctaLabel: "Learn more",
            ctaHref: "#contact",
            imageSrc: current.events.items[0]?.imageSrc ?? "images/THOHTGevent.webp",
            imageAlt: "Community event preview"
          }
        ]
      }
    }));
    setSelectedEventId(nextId);
    setEventsMode("cards");
  }

  function updateEventCard(eventId: string, updater: (event: SiteEditorContent["events"]["items"][number]) => SiteEditorContent["events"]["items"][number]) {
    updateSiteDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        items: current.events.items.map((item) => (item.id === eventId ? updater(item) : item))
      }
    }));
  }

  function moveEventCard(eventId: string, direction: -1 | 1) {
    updateSiteDraft((current) => {
      const index = current.events.items.findIndex((item) => item.id === eventId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.events.items.length) {
        return current;
      }

      const items = [...current.events.items];
      const [item] = items.splice(index, 1);
      items.splice(target, 0, item);
      return {
        ...current,
        events: {
          ...current.events,
          items
        }
      };
    });
  }

  function deleteEventCard(eventId: string) {
    updateSiteDraft((current) => {
      if (current.events.items.length === 1) {
        return current;
      }

      const items = current.events.items.filter((item) => item.id !== eventId);
      setSelectedEventId(items[0]?.id ?? null);
      return {
        ...current,
        events: {
          ...current.events,
          items
        }
      };
    });
  }

  function addProductCard() {
    const nextId = `product-${Date.now()}`;
    updateSiteDraft((current) => ({
      ...current,
      shop: {
        ...current.shop,
        products: [
          ...current.shop.products,
          {
            id: nextId,
            title: "New support item",
            description: "Describe the item or giving option here.",
            priceLabel: "$0",
            ctaLabel: "Open link",
            ctaHref: "#donate",
            featured: false
          }
        ]
      }
    }));
    setSelectedProductId(nextId);
    setShopMode("products");
  }

  function updateProductCard(productId: string, updater: (product: SiteEditorContent["shop"]["products"][number]) => SiteEditorContent["shop"]["products"][number]) {
    updateSiteDraft((current) => ({
      ...current,
      shop: {
        ...current.shop,
        products: current.shop.products.map((product) => (product.id === productId ? updater(product) : product))
      }
    }));
  }

  function moveProductCard(productId: string, direction: -1 | 1) {
    updateSiteDraft((current) => {
      const index = current.shop.products.findIndex((product) => product.id === productId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.shop.products.length) {
        return current;
      }

      const products = [...current.shop.products];
      const [item] = products.splice(index, 1);
      products.splice(target, 0, item);
      return {
        ...current,
        shop: {
          ...current.shop,
          products
        }
      };
    });
  }

  function deleteProductCard(productId: string) {
    updateSiteDraft((current) => {
      if (current.shop.products.length === 1) {
        return current;
      }

      const products = current.shop.products.filter((product) => product.id !== productId);
      setSelectedProductId(products[0]?.id ?? null);
      return {
        ...current,
        shop: {
          ...current.shop,
          products
        }
      };
    });
  }

  if (!authenticated) {
    const authTitle = authMode === "forgot" ? "Forgot Password" : authMode === "reset" ? "Reset Password" : "Website Admin Dashboard";
    const authCopy =
      authMode === "forgot"
        ? "Enter the admin username to prepare a password reset link."
        : authMode === "reset"
          ? "Create a new password for the House of Humanity admin dashboard."
          : "Manage traffic, newsletters, website content, and support docs for The House of Humanity.";

    return (
      <>
        <Head>
          <title>{`${authTitle} | The House of Humanity`}</title>
        </Head>
        <main className="admin-login-shell">
          <section className="admin-login-card">
            <AdminBrand />
            <div className="admin-auth-intro">
              <h1>{authTitle}</h1>
              <p>{authCopy}</p>
            </div>

            {authMode === "login" ? (
              <form className="admin-login-form" onSubmit={handleLogin}>
                <label>
                  Username
                  <input
                    type="text"
                    value={loginState.username}
                    onChange={(event) => setLoginState((current) => ({ ...current, username: event.target.value }))}
                    autoComplete="username"
                  />
                </label>
                <label>
                  Password
                  <span className="admin-password-row">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      value={loginState.password}
                      onChange={(event) => setLoginState((current) => ({ ...current, password: event.target.value }))}
                      autoComplete="current-password"
                    />
                    <button type="button" className="admin-inline-text-button" onClick={() => setShowLoginPassword((current) => !current)}>
                      {showLoginPassword ? "Hide" : "Peek"}
                    </button>
                  </span>
                </label>
                <button type="button" className="admin-auth-link admin-auth-link--inline" onClick={() => setAuthMode("forgot")}>
                  Forgot password?
                </button>
                {loginState.error ? <p className="admin-auth-banner admin-auth-banner--warning">{loginState.error}</p> : null}
                {loginState.notice ? <p className="admin-auth-banner admin-auth-banner--info">{loginState.notice}</p> : null}
                <button className="admin-primary-button admin-primary-button--full" type="submit" disabled={loginState.loading}>
                  {loginState.loading ? "Signing in..." : "Sign in"}
                </button>
              </form>
            ) : null}

            {authMode === "forgot" ? (
              <>
                <form className="admin-login-form" onSubmit={handleForgotPassword}>
                  <label>
                    Username
                    <input
                      type="text"
                      value={forgotState.username}
                      onChange={(event) => setForgotState((current) => ({ ...current, username: event.target.value }))}
                      autoComplete="username"
                    />
                  </label>
                  {forgotState.error ? <p className="admin-auth-banner admin-auth-banner--warning">{forgotState.error}</p> : null}
                  {forgotState.message ? <p className="admin-auth-note">{forgotState.message}</p> : null}
                  {forgotState.resetLink ? (
                    <p className="admin-auth-note">
                      Local preview reset link: <a href={forgotState.resetLink}>{forgotState.resetLink}</a>
                    </p>
                  ) : null}
                  <button className="admin-primary-button admin-primary-button--full" type="submit" disabled={forgotState.loading}>
                    {forgotState.loading ? "Preparing link..." : "Prepare reset link"}
                  </button>
                </form>
                <p className="admin-auth-footer">
                  <button type="button" className="admin-auth-link" onClick={() => setAuthMode("login")}>
                    Return to login
                  </button>
                </p>
              </>
            ) : null}

            {authMode === "reset" ? (
              <>
                <form className="admin-login-form" onSubmit={handleResetPassword}>
                  <label>
                    New Password
                    <span className="admin-password-row">
                      <input
                        type={showResetPassword ? "text" : "password"}
                        value={resetState.password}
                        onChange={(event) => setResetState((current) => ({ ...current, password: event.target.value }))}
                        autoComplete="new-password"
                      />
                      <button type="button" className="admin-inline-text-button" onClick={() => setShowResetPassword((current) => !current)}>
                        {showResetPassword ? "Hide" : "Peek"}
                      </button>
                    </span>
                  </label>
                  <label>
                    Confirm Password
                    <input
                      type="password"
                      value={resetState.confirmPassword}
                      onChange={(event) => setResetState((current) => ({ ...current, confirmPassword: event.target.value }))}
                      autoComplete="new-password"
                    />
                  </label>
                  {resetState.error ? <p className="admin-auth-banner admin-auth-banner--warning">{resetState.error}</p> : null}
                  {resetState.message ? <p className="admin-auth-banner admin-auth-banner--info">{resetState.message}</p> : null}
                  <button className="admin-primary-button admin-primary-button--full" type="submit" disabled={resetState.loading}>
                    {resetState.loading ? "Updating password..." : "Update password"}
                  </button>
                </form>
                <p className="admin-auth-footer">
                  <button
                    type="button"
                    className="admin-auth-link"
                    onClick={() => {
                      setAuthMode("login");
                      if (typeof window !== "undefined") {
                        window.history.replaceState(null, "", "/admin");
                      }
                    }}
                  >
                    Return to login
                  </button>
                </p>
              </>
            ) : null}
          </section>
        </main>
      </>
    );
  }

  if (!dashboardData || !siteDraft) {
    return null;
  }

  const selectedHelp = helpSections[helpSection];
  const activeNavItem = navItems.find((item) => item.key === activeTab);
  const selectedEvent = siteDraft.events.items.find((item) => item.id === selectedEventId) ?? siteDraft.events.items[0];
  const selectedProduct = siteDraft.shop.products.find((item) => item.id === selectedProductId) ?? siteDraft.shop.products[0];
  const selectedTrafficAnalytics = dashboardData.analytics[trafficRange];

  return (
    <>
      <Head>
        <title>Admin Dashboard | The House of Humanity</title>
      </Head>
      <div className={`admin-shell ${drawerCollapsed ? "is-collapsed" : ""}`}>
        <aside className="admin-sidebar admin-sidebar--desktop" aria-label="Admin navigation">
          <div className="admin-sidebar-header">
            {drawerCollapsed ? (
              <div className="admin-sidebar-header-main admin-sidebar-header-main--collapsed">
                <div className="admin-brand-mark admin-brand-mark--solo">
                  <Image src={adminLogoSrc} alt="The House of Humanity logo" width={60} height={60} className="admin-brand-logo" priority />
                </div>
                <p className="admin-sidebar-marker">THOH</p>
              </div>
            ) : (
              <AdminBrand compact />
            )}
            <button
              type="button"
              className="admin-drawer-toggle"
              onClick={() => setDrawerCollapsed((current) => !current)}
              aria-label={drawerCollapsed ? "Expand navigation" : "Collapse navigation"}
              title={drawerCollapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {drawerCollapsed ? "Open" : "Close"}
            </button>
          </div>
          <div className="admin-nav-scroll">
            <nav className="admin-nav-list">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`admin-nav-item ${activeTab === item.key ? "is-active" : ""}`}
                  aria-label={item.label}
                  onClick={() => setActiveTab(item.key)}
                  title={item.label}
                >
                  <span className="admin-nav-icon">
                    <Image src={item.iconSrc} alt={item.iconAlt} width={20} height={20} className="admin-nav-icon-image" />
                  </span>
                  {drawerCollapsed ? null : (
                    <span className="admin-nav-meta">
                      <span className="admin-nav-label">{item.label}</span>
                      <span className="admin-nav-description">{item.description}</span>
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <button className={`admin-logout-button ${drawerCollapsed ? "admin-logout-button--collapsed" : ""}`} type="button" onClick={handleLogout} aria-label="Logout">
            <Image src="/icons/logout.png" alt="" width={18} height={18} aria-hidden="true" />
            {drawerCollapsed ? null : <span>Logout</span>}
          </button>
        </aside>

        <div className="admin-main-wrap">
          <header className="admin-mobile-header">
            <button type="button" className="admin-mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              Menu
            </button>
            <div className="admin-mobile-brand">
              <Image src={adminLogoSrc} alt="The House of Humanity logo" width={44} height={44} className="admin-mobile-logo" priority />
              <span>The House of Humanity</span>
            </div>
            <button className="admin-logout-button admin-logout-button--mobile" type="button" onClick={handleLogout} aria-label="Logout">
              <Image src="/icons/logout.png" alt="" width={18} height={18} aria-hidden="true" />
            </button>
          </header>

          {mobileNavOpen ? <button type="button" className="admin-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" /> : null}

          <aside className={`admin-sidebar admin-sidebar--mobile ${mobileNavOpen ? "is-open" : ""}`} aria-label="Mobile admin navigation">
            <div className="admin-sidebar-header">
              <AdminBrand compact />
              <button type="button" className="admin-close-button" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                Close
              </button>
            </div>
            <nav className="admin-nav-list">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`admin-nav-item ${activeTab === item.key ? "is-active" : ""}`}
                  aria-label={item.label}
                  onClick={() => {
                    setActiveTab(item.key);
                    setMobileNavOpen(false);
                  }}
                >
                  <span className="admin-nav-icon">
                    <Image src={item.iconSrc} alt={item.iconAlt} width={20} height={20} className="admin-nav-icon-image" />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="admin-main-content">
            <div className="admin-main-inner">
            <section className="admin-page-heading">
              <div>
                <p className="admin-eyebrow admin-eyebrow--dark">Signed in as {username}</p>
                <h1>{activeNavItem?.label}</h1>
              </div>
            </section>

            {activeTab === "traffic" ? (
              <section className="admin-grid-layout">
                <article className="admin-panel admin-panel--span-two">
                  <div className="admin-panel-header">
                    <div>
                      <h2>Subscribers</h2>
                      <p>Email signups with immediate persistence through /api/subscribers.</p>
                    </div>
                    <button type="button" className="admin-plus-button" onClick={() => setTrafficAddVisible((current) => !current)} aria-label="Add subscriber">
                      +
                    </button>
                  </div>
                  {trafficAddVisible ? (
                    <div className="admin-inline-form">
                      <input type="email" value={trafficEmail} onChange={(event) => setTrafficEmail(event.target.value)} placeholder="subscriber@example.org" />
                      <button type="button" className="admin-primary-button" onClick={() => void handleAddSubscriber("traffic")} disabled={busyAction === "subscriber"}>
                        Submit
                      </button>
                      <button type="button" className="admin-secondary-button" onClick={() => setTrafficAddVisible(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : null}
                  <div className="admin-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.subscribers.map((subscriber) => (
                          <tr key={subscriber.id}>
                            <td>{subscriber.email}</td>
                            <td>{new Date(subscriber.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="admin-panel">
                  <div className="admin-panel-header">
                    <div>
                      <h2>Total Views</h2>
                      <p>Filter the traffic snapshot for the period you want to review.</p>
                    </div>
                  </div>
                  <div className="admin-editor-segmented" role="tablist" aria-label="Web traffic range">
                    {trafficRanges.map((range) => (
                      <button
                        key={range.key}
                        type="button"
                        className={`admin-editor-segment ${trafficRange === range.key ? "is-active" : ""}`}
                        onClick={() => setTrafficRange(range.key)}
                        aria-pressed={trafficRange === range.key}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  <div className="admin-metric-value">{selectedTrafficAnalytics.totalViews.toLocaleString()}</div>
                </article>

                <article className="admin-panel admin-panel--cloudflare">
                  <h2>Cloudflare Analytics</h2>
                  <ul className="admin-stat-list">
                    <li>Requests: {selectedTrafficAnalytics.cloudflarePanel.requests.toLocaleString()}</li>
                    <li>Uniques: {selectedTrafficAnalytics.cloudflarePanel.uniques.toLocaleString()}</li>
                    <li>Bandwidth: {selectedTrafficAnalytics.cloudflarePanel.bandwidthMB.toLocaleString()} MB</li>
                  </ul>
                </article>

                <article className="admin-panel">
                  <h2>Page Analytics</h2>
                  <ul className="admin-stat-list">
                    {selectedTrafficAnalytics.pageAnalytics.map((entry) => (
                      <li key={entry.path}>{entry.path}: {entry.views.toLocaleString()}</li>
                    ))}
                  </ul>
                </article>

                <article className="admin-panel">
                  <h2>Browser Usage</h2>
                  <ul className="admin-stat-list">
                    {selectedTrafficAnalytics.browserUsage.map((entry) => (
                      <li key={entry.name}>{entry.name}: {entry.views.toLocaleString()}</li>
                    ))}
                  </ul>
                </article>

                <article className="admin-panel">
                  <h2>Device Types</h2>
                  <ul className="admin-stat-list">
                    {selectedTrafficAnalytics.deviceTypes.map((entry) => (
                      <li key={entry.name}>{entry.name}: {entry.views.toLocaleString()}</li>
                    ))}
                  </ul>
                </article>

                <article className="admin-panel">
                  <h2>Top Referrers</h2>
                  <ul className="admin-stat-list">
                    {selectedTrafficAnalytics.topReferrers.map((entry) => (
                      <li key={entry.source}>{entry.source}: {entry.visits.toLocaleString()}</li>
                    ))}
                  </ul>
                </article>
              </section>
            ) : null}

            {activeTab === "newsletter" ? (
              <section className="admin-grid-layout admin-grid-layout--newsletter">
                <article className="admin-panel admin-panel--span-two">
                  <div className="admin-panel-header">
                    <div>
                      <h2>{editingNewsletterId ? "Edit Queued Newsletter" : "Schedule Newsletter"}</h2>
                      <p>Scheduler uses your local time zone: {timeZone}.</p>
                    </div>
                    <button type="button" className="admin-primary-button" onClick={() => void handleProcessNewsletters()} disabled={busyAction === "process"} aria-label="Process due newsletters now" title="Process due newsletters now">
                      <IconLabel src="/icons/newsletter.png" alt="Newsletter processing icon" label="Process Due Newsletters Now" />
                    </button>
                  </div>
                  <div className="admin-form-grid">
                    <label>
                      Subject
                      <input
                        type="text"
                        value={newsletterForm.subject}
                        onChange={(event) => setNewsletterForm((current) => ({ ...current, subject: event.target.value }))}
                      />
                    </label>
                    <label>
                      Scheduled Date/Time
                      <input
                        type="datetime-local"
                        value={newsletterForm.scheduledForLocal}
                        onChange={(event) => setNewsletterForm((current) => ({ ...current, scheduledForLocal: event.target.value }))}
                      />
                    </label>
                    <label className="admin-form-grid-span-two">
                      Newsletter Body
                      <textarea
                        rows={8}
                        value={newsletterForm.body}
                        onChange={(event) => setNewsletterForm((current) => ({ ...current, body: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="admin-panel-header admin-panel-header--subsection">
                    <div>
                      <h3>Subscribers</h3>
                      <p>Select recipients or add a new subscriber and auto-select them immediately.</p>
                    </div>
                    <button type="button" className="admin-plus-button" onClick={() => setNewsletterAddVisible((current) => !current)} aria-label="Add newsletter subscriber">
                      +
                    </button>
                  </div>
                  {newsletterAddVisible ? (
                    <div className="admin-inline-form">
                      <input type="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="subscriber@example.org" />
                      <button type="button" className="admin-primary-button" onClick={() => void handleAddSubscriber("newsletter")} disabled={busyAction === "subscriber"}>
                        Submit
                      </button>
                      <button type="button" className="admin-secondary-button" onClick={() => setNewsletterAddVisible(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : null}
                  <div className="admin-selection-toolbar">
                    <button type="button" className="admin-secondary-button" onClick={() => setSelectedSubscriberIds(dashboardData.subscribers.map((subscriber) => subscriber.id))}>
                      Select All
                    </button>
                    <button type="button" className="admin-secondary-button" onClick={() => setSelectedSubscriberIds([])}>
                      Clear Selection
                    </button>
                  </div>
                  <div className="admin-checkbox-list">
                    {dashboardData.subscribers.map((subscriber) => (
                      <label key={subscriber.id} className="admin-checkbox-row">
                        <input
                          type="checkbox"
                          checked={selectedSubscriberIds.includes(subscriber.id)}
                          onChange={() =>
                            setSelectedSubscriberIds((current) =>
                              current.includes(subscriber.id)
                                ? current.filter((id) => id !== subscriber.id)
                                : [...current, subscriber.id]
                            )
                          }
                        />
                        <span>{subscriber.email}</span>
                      </label>
                    ))}
                  </div>
                  <div className="admin-button-row">
                    <button type="button" className="admin-primary-button" onClick={() => void handleScheduleNewsletter()} disabled={busyAction === "newsletter"}>
                      {editingNewsletterId ? "Save Queued Newsletter Changes" : "Schedule Newsletter"}
                    </button>
                    {editingNewsletterId ? (
                      <button type="button" className="admin-secondary-button" onClick={resetNewsletterComposer}>
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </article>

                <article className="admin-panel admin-panel--span-two">
                  <h2>Queued Newsletters</h2>
                  <div className="admin-stack-list">
                    {dashboardData.newsletters.length === 0 ? <p>No newsletters are queued yet.</p> : null}
                    {dashboardData.newsletters.map((newsletter) => (
                      <div key={newsletter.id} className="admin-list-card">
                        <div>
                          <strong>{newsletter.subject}</strong>
                          <p>{new Date(newsletter.scheduledForIso).toLocaleString()}</p>
                          <p>Status: {newsletter.status}</p>
                          <p>Recipients: {newsletter.recipientIds.length}</p>
                        </div>
                        <div className="admin-button-row">
                          {newsletter.status === "queued" ? (
                            <button type="button" className="admin-secondary-button" onClick={() => handleEditNewsletter(newsletter)}>
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="admin-secondary-button"
                            onClick={() => void handleDeleteNewsletter(newsletter.id)}
                            disabled={busyAction === newsletter.id}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            ) : null}

            {activeTab === "editor" ? (
              <section className="admin-grid-layout admin-grid-layout--editor">
                <article className="admin-panel admin-panel--span-two admin-editor-surface">
                  <div className="admin-editor-toolbar-wrap">
                    <div className="admin-editor-toolbar">
                      <div className="admin-editor-tablist" aria-label="Site editor tabs">
                        {editorTabs.map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            className={`admin-editor-tab ${editorTab === tab.key ? "is-active" : ""}`}
                            onClick={() => setEditorTab(tab.key)}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div className="admin-editor-status-chips">
                        <span className="admin-editor-chip">
                          <span className="admin-editor-chip-dot admin-editor-chip-dot--draft" />
                          Draft ready
                        </span>
                        <span className="admin-editor-chip">
                          <span className="admin-editor-chip-dot" />
                          Last saved {new Date(dashboardData.siteContent.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="admin-editor-icon-row">
                        <button type="button" className="admin-editor-icon-button" onClick={() => void handlePublishDraft()} disabled={busyAction === "draft-publish"} aria-label="Publish changes" title="Publish changes">
                          <Image src="/icons/publish.png" alt="" width={18} height={18} aria-hidden="true" />
                        </button>
                        <button type="button" className="admin-editor-icon-button" onClick={() => void handleResetDraft()} disabled={busyAction === "draft-reset"} aria-label="Reset draft" title="Reset draft">
                          <Image src="/icons/reset.png" alt="" width={18} height={18} aria-hidden="true" />
                        </button>
                        <button type="button" className="admin-editor-icon-button" onClick={() => void handleSaveDraft()} disabled={busyAction === "draft-save"} aria-label="Save draft" title="Save draft">
                          <Image src="/icons/save.png" alt="" width={18} height={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {editorTab === "about" ? (
                    <div className="admin-form-grid">
                      <label>
                        Title
                        <input type="text" value={siteDraft.about.title} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, title: event.target.value } }))} />
                      </label>
                      <label>
                        Subtitle
                        <input type="text" value={siteDraft.about.subtitle} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, subtitle: event.target.value } }))} />
                      </label>
                      <label>
                        Mission Heading
                        <input type="text" value={siteDraft.about.missionHeading} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, missionHeading: event.target.value } }))} />
                      </label>
                      <label>
                        Vision Heading
                        <input type="text" value={siteDraft.about.visionHeading} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, visionHeading: event.target.value } }))} />
                      </label>
                      <label className="admin-form-grid-span-two">
                        Mission Body
                        <textarea rows={5} value={siteDraft.about.missionBody} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, missionBody: event.target.value } }))} />
                      </label>
                      <label className="admin-form-grid-span-two">
                        Vision Body
                        <textarea rows={5} value={siteDraft.about.visionBody} onChange={(event) => updateSiteDraft((current) => ({ ...current, about: { ...current.about, visionBody: event.target.value } }))} />
                      </label>
                    </div>
                  ) : null}

                  {editorTab === "newsletter" ? (
                    <div className="admin-form-stack">
                      <label>
                        Title
                        <input type="text" value={siteDraft.newsletter.title} onChange={(event) => updateSiteDraft((current) => ({ ...current, newsletter: { ...current.newsletter, title: event.target.value } }))} />
                      </label>
                      <label>
                        CTA Label
                        <input type="text" value={siteDraft.newsletter.ctaLabel} onChange={(event) => updateSiteDraft((current) => ({ ...current, newsletter: { ...current.newsletter, ctaLabel: event.target.value } }))} />
                      </label>
                      <label>
                        Body
                        <textarea rows={8} value={siteDraft.newsletter.body} onChange={(event) => updateSiteDraft((current) => ({ ...current, newsletter: { ...current.newsletter, body: event.target.value } }))} />
                      </label>
                    </div>
                  ) : null}

                  {editorTab === "events" ? (
                    <div className="admin-form-stack">
                      <div className="admin-editor-segmented">
                        <button type="button" className={`admin-editor-segment ${eventsMode === "page" ? "is-active" : ""}`} onClick={() => setEventsMode("page")}>Events Page</button>
                        <button type="button" className={`admin-editor-segment ${eventsMode === "cards" ? "is-active" : ""}`} onClick={() => setEventsMode("cards")}>Event Cards</button>
                      </div>

                      {eventsMode === "page" ? (
                        <div className="admin-form-grid">
                          <label>
                            Heading
                            <input type="text" value={siteDraft.events.heading} onChange={(event) => updateSiteDraft((current) => ({ ...current, events: { ...current.events, heading: event.target.value } }))} />
                          </label>
                          <label className="admin-form-grid-span-two">
                            Intro
                            <textarea rows={6} value={siteDraft.events.intro} onChange={(event) => updateSiteDraft((current) => ({ ...current, events: { ...current.events, intro: event.target.value } }))} />
                          </label>
                        </div>
                      ) : (
                        <div className="admin-collection-layout">
                          <div className="admin-collection-editor">
                            <div className="admin-panel-header">
                              <div>
                                <h3>Event Cards</h3>
                                <p>Select a card to edit its content and order.</p>
                              </div>
                              <button type="button" className="admin-secondary-button" onClick={addEventCard}>Add Card</button>
                            </div>
                            <div className="admin-stack-list">
                              {siteDraft.events.items.map((item, index) => (
                                <div key={item.id} className={`admin-collection-card ${selectedEvent?.id === item.id ? "is-active" : ""}`}>
                                  <button type="button" className="admin-collection-card-select" onClick={() => setSelectedEventId(item.id)}>
                                    <strong>{item.title}</strong>
                                    <span>{item.ctaLabel}</span>
                                  </button>
                                  <div className="admin-button-row">
                                    <button type="button" className="admin-secondary-button" onClick={() => moveEventCard(item.id, -1)} disabled={index === 0}>Up</button>
                                    <button type="button" className="admin-secondary-button" onClick={() => moveEventCard(item.id, 1)} disabled={index === siteDraft.events.items.length - 1}>Down</button>
                                    <button type="button" className="admin-secondary-button" onClick={() => deleteEventCard(item.id)} disabled={siteDraft.events.items.length === 1}>Delete</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {selectedEvent ? (
                              <div className="admin-form-stack">
                                <label>
                                  Title
                                  <input type="text" value={selectedEvent.title} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, title: event.target.value }))} />
                                </label>
                                <label>
                                  Badge / CTA Label
                                  <input type="text" value={selectedEvent.ctaLabel} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, ctaLabel: event.target.value }))} />
                                </label>
                                <label>
                                  CTA Href
                                  <input type="text" value={selectedEvent.ctaHref} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, ctaHref: event.target.value }))} />
                                </label>
                                <label>
                                  Image Src
                                  <input type="text" value={selectedEvent.imageSrc} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, imageSrc: event.target.value }))} />
                                </label>
                                <label>
                                  Image Alt
                                  <input type="text" value={selectedEvent.imageAlt} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, imageAlt: event.target.value }))} />
                                </label>
                                <label>
                                  Description
                                  <textarea rows={6} value={selectedEvent.description} onChange={(event) => updateEventCard(selectedEvent.id, (current) => ({ ...current, description: event.target.value }))} />
                                </label>
                              </div>
                            ) : null}
                          </div>
                          <div className="admin-collection-preview">
                            {selectedEvent ? (
                              <article className="admin-preview-card">
                                <p className="admin-eyebrow admin-eyebrow--dark">Event Preview</p>
                                <h3>{selectedEvent.title}</h3>
                                <p>{selectedEvent.description}</p>
                                <p><strong>{selectedEvent.ctaLabel}</strong> {"->"} {selectedEvent.ctaHref}</p>
                                <p>{selectedEvent.imageSrc}</p>
                              </article>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {editorTab === "shop" ? (
                    <div className="admin-form-stack">
                      <div className="admin-editor-segmented">
                        <button type="button" className={`admin-editor-segment ${shopMode === "page" ? "is-active" : ""}`} onClick={() => setShopMode("page")}>Shop Page</button>
                        <button type="button" className={`admin-editor-segment ${shopMode === "products" ? "is-active" : ""}`} onClick={() => setShopMode("products")}>Products</button>
                      </div>

                      {shopMode === "page" ? (
                        <div className="admin-form-grid">
                          <label>
                            Heading
                            <input type="text" value={siteDraft.shop.heading} onChange={(event) => updateSiteDraft((current) => ({ ...current, shop: { ...current.shop, heading: event.target.value } }))} />
                          </label>
                          <label>
                            CTA Label
                            <input type="text" value={siteDraft.shop.ctaLabel} onChange={(event) => updateSiteDraft((current) => ({ ...current, shop: { ...current.shop, ctaLabel: event.target.value } }))} />
                          </label>
                          <label>
                            CTA Href
                            <input type="text" value={siteDraft.shop.ctaHref} onChange={(event) => updateSiteDraft((current) => ({ ...current, shop: { ...current.shop, ctaHref: event.target.value } }))} />
                          </label>
                          <label className="admin-form-grid-span-two">
                            Body
                            <textarea rows={6} value={siteDraft.shop.body} onChange={(event) => updateSiteDraft((current) => ({ ...current, shop: { ...current.shop, body: event.target.value } }))} />
                          </label>
                        </div>
                      ) : (
                        <div className="admin-collection-layout">
                          <div className="admin-collection-editor">
                            <div className="admin-panel-header">
                              <div>
                                <h3>Products</h3>
                                <p>Add, reorder, and update support items.</p>
                              </div>
                              <button type="button" className="admin-secondary-button" onClick={addProductCard}>Add Product</button>
                            </div>
                            <div className="admin-stack-list">
                              {siteDraft.shop.products.map((product, index) => (
                                <div key={product.id} className={`admin-collection-card ${selectedProduct?.id === product.id ? "is-active" : ""}`}>
                                  <button type="button" className="admin-collection-card-select" onClick={() => setSelectedProductId(product.id)}>
                                    <strong>{product.title}</strong>
                                    <span>{product.priceLabel}</span>
                                  </button>
                                  <div className="admin-button-row">
                                    <button type="button" className="admin-secondary-button" onClick={() => moveProductCard(product.id, -1)} disabled={index === 0}>Up</button>
                                    <button type="button" className="admin-secondary-button" onClick={() => moveProductCard(product.id, 1)} disabled={index === siteDraft.shop.products.length - 1}>Down</button>
                                    <button type="button" className="admin-secondary-button" onClick={() => deleteProductCard(product.id)} disabled={siteDraft.shop.products.length === 1}>Delete</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {selectedProduct ? (
                              <div className="admin-form-stack">
                                <label>
                                  Title
                                  <input type="text" value={selectedProduct.title} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, title: event.target.value }))} />
                                </label>
                                <label>
                                  Price Label
                                  <input type="text" value={selectedProduct.priceLabel} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, priceLabel: event.target.value }))} />
                                </label>
                                <label>
                                  CTA Label
                                  <input type="text" value={selectedProduct.ctaLabel} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, ctaLabel: event.target.value }))} />
                                </label>
                                <label>
                                  CTA Href
                                  <input type="text" value={selectedProduct.ctaHref} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, ctaHref: event.target.value }))} />
                                </label>
                                <label>
                                  Description
                                  <textarea rows={6} value={selectedProduct.description} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, description: event.target.value }))} />
                                </label>
                                <label className="admin-checkbox-toggle">
                                  <input type="checkbox" checked={selectedProduct.featured} onChange={(event) => updateProductCard(selectedProduct.id, (current) => ({ ...current, featured: event.target.checked }))} />
                                  Featured product
                                </label>
                              </div>
                            ) : null}
                          </div>
                          <div className="admin-collection-preview">
                            {selectedProduct ? (
                              <article className="admin-preview-card">
                                <p className="admin-eyebrow admin-eyebrow--dark">Product Preview</p>
                                <h3>{selectedProduct.title}</h3>
                                <p>{selectedProduct.description}</p>
                                <p><strong>{selectedProduct.priceLabel}</strong></p>
                                <p>{selectedProduct.ctaLabel} {"->"} {selectedProduct.ctaHref}</p>
                              </article>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {editorTab === "colors" ? (
                    <div className="admin-form-grid">
                      {Object.entries(siteDraft.colors).map(([key, value]) => (
                        <label key={key}>
                          {key}
                          <input
                            type="text"
                            value={value}
                            onChange={(event) =>
                              updateSiteDraft((current) => ({
                                ...current,
                                colors: { ...current.colors, [key]: event.target.value }
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {editorTab === "images" ? (
                    <div className="admin-form-grid">
                      <label>
                        Founder Image Src
                        <input type="text" value={siteDraft.images.founder.src} onChange={(event) => updateSiteDraft((current) => ({ ...current, images: { ...current.images, founder: { ...current.images.founder, src: event.target.value } } }))} />
                      </label>
                      <label>
                        Founder Image Alt
                        <input type="text" value={siteDraft.images.founder.alt} onChange={(event) => updateSiteDraft((current) => ({ ...current, images: { ...current.images, founder: { ...current.images.founder, alt: event.target.value } } }))} />
                      </label>
                      <label>
                        Newsletter Image Src
                        <input type="text" value={siteDraft.images.newsletter.src} onChange={(event) => updateSiteDraft((current) => ({ ...current, images: { ...current.images, newsletter: { ...current.images.newsletter, src: event.target.value } } }))} />
                      </label>
                      <label>
                        Newsletter Image Alt
                        <input type="text" value={siteDraft.images.newsletter.alt} onChange={(event) => updateSiteDraft((current) => ({ ...current, images: { ...current.images, newsletter: { ...current.images.newsletter, alt: event.target.value } } }))} />
                      </label>
                    </div>
                  ) : null}
                </article>
              </section>
            ) : null}

            {activeTab === "help" ? (
              <section className="admin-grid-layout">
                <article className="admin-panel admin-panel--span-two">
                  <div className="admin-panel-header">
                    <div>
                      <h2>Admin Help</h2>
                      <p>Select a documented control area to view its instructions.</p>
                    </div>
                    <div className="admin-help-pill-row" aria-label="Help section selector">
                      <button type="button" className={`admin-help-pill ${helpSection === "navigation" ? "is-active" : ""}`} onClick={() => setHelpSection("navigation")}>Navigation</button>
                      <button type="button" className={`admin-help-pill ${helpSection === "traffic" ? "is-active" : ""}`} onClick={() => setHelpSection("traffic")}>Traffic</button>
                      <button type="button" className={`admin-help-pill ${helpSection === "newsletter" ? "is-active" : ""}`} onClick={() => setHelpSection("newsletter")}>Newsletter</button>
                      <button type="button" className={`admin-help-pill ${helpSection === "editor" ? "is-active" : ""}`} onClick={() => setHelpSection("editor")}>Editor</button>
                    </div>
                  </div>
                </article>
                <article className="admin-panel admin-panel--span-two">
                  <h2>{selectedHelp.title}</h2>
                  <div className="admin-help-items">
                    {selectedHelp.items.map((item) => (
                      <article key={item.label} className="admin-help-item">
                        <strong>{item.label}</strong>
                        <p>{item.body}</p>
                      </article>
                    ))}
                  </div>
                </article>
              </section>
            ) : null}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (context) => {
  const session = getSessionFromRequest(context.req);
  if (!session) {
    const adminUsername = await getAdminUsername();

    return {
      props: {
        authenticated: false,
        username: adminUsername,
        data: null
      }
    };
  }

  const data = await getDashboardData();
  return {
    props: {
      authenticated: true,
      username: session.username,
      data
    }
  };
};