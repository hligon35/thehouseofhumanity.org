import Head from "next/head";
import Image from "next/image";
import Script from "next/script";
import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  getDashboardData
} from "@/lib/admin-store";
import {
  getAdminIdentity, getLocalAdminUsername, isLocalAdminLoginEnabled
} from "@/lib/session";
import { getRuntimeEnv } from "@/lib/runtime-env";
import type {
  ActivityEvent, AdminData, ContactSubmission, NewsletterQueueItem, SiteEditorContent, SubmissionStatus
} from "@/lib/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type Tab = "overview" | "submissions" | "newsletter" | "content" | "activity" | "help";
type Props = {
  authenticated: boolean;
  principal: { username: string; email: string; authType: "cloudflare-access" | "local" | "google" } | null;
  data: AdminData | null;
  localLoginEnabled: boolean;
  localUsername: string;
  googleClientId: string;
};

function localInput(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Request failed.";
    throw new Error(message);
  }
  return payload as T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="thoh-field"><span>{label}</span>{children}</label>;
}

function Login({ localLoginEnabled, localUsername, googleClientId }: { localLoginEnabled: boolean; localUsername: string; googleClientId: string }) {
  const [username, setUsername] = useState(localUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      await requestJson("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(response: { credential: string }) {
    setError("");
    try {
      await requestJson("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in with Google.");
    }
  }

  function initializeGoogleButton() {
    if (!googleClientId || !googleButtonRef.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 260 });
  }

  useEffect(() => {
    if (window.google?.accounts?.id) initializeGoogleButton();
  }, [googleClientId]);

  return (
    <main className="thoh-login-shell">
      {googleClientId ? (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initializeGoogleButton} />
      ) : null}
      <section className="thoh-login-card">
        <Image src="/website/images/THOHlogo.png" alt="The House of Humanity" width={92} height={92} priority />
        <p className="thoh-kicker">Secure administration</p>
        <h1>The House of Humanity</h1>
        <p className="thoh-muted">Sign in with your approved Google account to access the dashboard.</p>
        {error ? <p className="thoh-alert thoh-alert--error">{error}</p> : null}
        {googleClientId ? (
          <div ref={googleButtonRef} className="thoh-google-signin" />
        ) : (
          <div className="thoh-access-note"><strong>Google sign-in is not configured</strong><p>Set GOOGLE_CLIENT_ID to enable sign-in.</p></div>
        )}
        {localLoginEnabled ? (
          <form className="thoh-form" onSubmit={submit}>
            <Field label="Username"><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></Field>
            <Field label="Password"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></Field>
            <button className="thoh-button thoh-button--primary" disabled={loading}>{loading ? "Signing in..." : "Sign in locally"}</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

export default function AdminPage({ authenticated, principal, data, localLoginEnabled, localUsername, googleClientId }: Props) {
  const [dashboard, setDashboard] = useState<AdminData | null>(data);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionStatus | "all">("all");
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [newsletter, setNewsletter] = useState({ subject: "", body: "", scheduledForLocal: "" });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [editingNewsletter, setEditingNewsletter] = useState<string | null>(null);
  const [draft, setDraft] = useState<SiteEditorContent | null>(data?.siteContent.draft ?? null);

  const submissions = useMemo(() => {
    const query = submissionQuery.trim().toLowerCase();
    return (dashboard?.submissions ?? []).filter((item) => {
      const matchesFilter = submissionFilter === "all" || item.status === submissionFilter;
      const matchesQuery = !query || [item.name, item.email, item.topic, item.message].some((value) => value.toLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [dashboard?.submissions, submissionFilter, submissionQuery]);

  if (!authenticated || !principal || !dashboard || !draft) {
    return <Login localLoginEnabled={localLoginEnabled} localUsername={localUsername} googleClientId={googleClientId} />;
  }

  function showSuccess(message: string) { setStatus(message); setError(""); }
  function showError(message: string) { setError(message); setStatus(""); }

  async function refresh() {
    const result = await requestJson<{ data: AdminData }>("/api/admin/dashboard");
    setDashboard(result.data);
    setDraft(result.data.siteContent.draft);
  }

  async function logout() {
    await requestJson("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.reload();
  }

  async function updateSubmission(item: ContactSubmission, action: "read" | "archive" | "restore") {
    setBusy("submission-" + item.id);
    try {
      const result = await requestJson<{ submissions: ContactSubmission[] }>("/api/submissions", {
        method: "PATCH", body: JSON.stringify({ id: item.id, action })
      });
      setDashboard((current) => current ? { ...current, submissions: result.submissions } : current);
      showSuccess(action === "archive" ? "Submission archived." : action === "restore" ? "Submission restored." : "Submission marked read.");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to update submission."); }
    finally { setBusy(""); }
  }

  function resetNewsletter() {
    setNewsletter({ subject: "", body: "", scheduledForLocal: "" });
    setSelectedRecipients([]);
    setEditingNewsletter(null);
  }

  function editNewsletter(item: NewsletterQueueItem) {
    setEditingNewsletter(item.id);
    setNewsletter({ subject: item.subject, body: item.body, scheduledForLocal: localInput(item.scheduledForIso) });
    setSelectedRecipients(item.recipientIds);
    setActiveTab("newsletter");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveNewsletter(event: FormEvent) {
    event.preventDefault();
    setBusy("newsletter");
    try {
      const body = {
        subject: newsletter.subject, body: newsletter.body, scheduledForIso: toIso(newsletter.scheduledForLocal),
        recipientIds: selectedRecipients, ...(editingNewsletter ? { id: editingNewsletter } : {})
      };
      const result = await requestJson<{ newsletters: NewsletterQueueItem[] }>("/api/newsletters", {
        method: editingNewsletter ? "PUT" : "POST", body: JSON.stringify(body)
      });
      setDashboard((current) => current ? { ...current, newsletters: result.newsletters } : current);
      resetNewsletter();
      showSuccess(editingNewsletter ? "Newsletter updated." : "Newsletter scheduled.");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to save newsletter."); }
    finally { setBusy(""); }
  }

  async function sendTest() {
    setBusy("test");
    try {
      await requestJson("/api/newsletters/test", {
        method: "POST", body: JSON.stringify({ subject: newsletter.subject, body: newsletter.body, email: testEmail })
      });
      showSuccess("Test newsletter sent."); setTestEmail("");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to send test."); }
    finally { setBusy(""); }
  }

  async function processNewsletters() {
    setBusy("process");
    try {
      const result = await requestJson<{ processed: Array<{ status: string }>; newsletters: NewsletterQueueItem[] }>("/api/newsletters/process", { method: "POST", body: "{}" });
      setDashboard((current) => current ? { ...current, newsletters: result.newsletters } : current);
      showSuccess(result.processed.length ? "Due newsletters processed." : "No due newsletters were ready.");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to process newsletters."); }
    finally { setBusy(""); }
  }

  async function deleteNewsletter(id: string) {
    if (!window.confirm("Delete this unsent newsletter?")) return;
    setBusy(id);
    try {
      const result = await requestJson<{ newsletters: NewsletterQueueItem[] }>("/api/newsletters?id=" + encodeURIComponent(id), { method: "DELETE" });
      setDashboard((current) => current ? { ...current, newsletters: result.newsletters } : current);
      showSuccess("Newsletter deleted.");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to delete newsletter."); }
    finally { setBusy(""); }
  }

  async function saveContent(action: "save" | "reset" | "publish") {
    if (!draft) return;
    if (action === "publish" && !window.confirm("Publish this content to the live website?")) return;
    setBusy("content-" + action);
    try {
      const result = await requestJson<{ siteContent: AdminData["siteContent"] }>("/api/site-content", {
        method: "PUT", body: JSON.stringify({ action, ...(action === "save" ? { draft } : {}) })
      });
      setDashboard((current) => current ? { ...current, siteContent: result.siteContent } : current);
      setDraft(result.siteContent.draft);
      showSuccess(action === "publish" ? "Content published." : action === "reset" ? "Draft reset." : "Draft saved.");
    } catch (err) { showError(err instanceof Error ? err.message : "Unable to update content."); }
    finally { setBusy(""); }
  }

  function updateDraft(updater: (current: SiteEditorContent) => SiteEditorContent) {
    setDraft((current) => current ? updater(current) : current);
  }

  const nav: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Overview" }, { key: "submissions", label: "Submissions" },
    { key: "newsletter", label: "Newsletter" }, { key: "content", label: "Site content" },
    { key: "activity", label: "Activity log" }, { key: "help", label: "Help" }
  ];

  const snapshot = dashboard.analytics["7d"];
  const newSubmissions = dashboard.submissions.filter((item) => item.status === "new").length;

  return (
    <>
      <Head><title>Admin Dashboard | The House of Humanity</title></Head>
      <div className="thoh-admin-shell">
        <aside className="thoh-sidebar">
          <div className="thoh-sidebar-brand">
            <Image src="/website/images/THOHlogo.png" alt="" width={54} height={54} />
            <div><span>Admin</span><strong>The House of Humanity</strong></div>
          </div>
          <nav className="thoh-nav" aria-label="Admin navigation">
            {nav.map((item) => <button key={item.key} className={activeTab === item.key ? "is-active" : ""} onClick={() => setActiveTab(item.key)}>{item.label}{item.key === "submissions" && newSubmissions ? <b>{newSubmissions}</b> : null}</button>)}
          </nav>
          <button className="thoh-logout" onClick={() => void logout()}>Sign out</button>
        </aside>

        <main className="thoh-admin-main">
          <header className="thoh-admin-header">
            <div><p className="thoh-kicker">The House of Humanity</p><h1>{nav.find((item) => item.key === activeTab)?.label}</h1></div>
            <div className="thoh-identity"><span>{principal.email}</span><small>{principal.authType === "cloudflare-access" ? "Cloudflare Access" : "Local development"}</small></div>
          </header>
          {status ? <div className="thoh-alert thoh-alert--success" role="status">{status}</div> : null}
          {error ? <div className="thoh-alert thoh-alert--error" role="alert">{error}</div> : null}

          {activeTab === "overview" ? (
            <section className="thoh-stack">
              <div className="thoh-card-grid">
                <article className="thoh-stat-card"><span>New submissions</span><strong>{newSubmissions}</strong><small>Needs review</small></article>
                <article className="thoh-stat-card"><span>Subscribers</span><strong>{dashboard.subscribers.length}</strong><small>D1 newsletter list</small></article>
                <article className="thoh-stat-card"><span>Views · 7 days</span><strong>{snapshot.totalViews}</strong><small>First-party analytics</small></article>
                <article className="thoh-stat-card"><span>Queued newsletters</span><strong>{dashboard.newsletters.filter((item) => item.status === "queued").length}</strong><small>Scheduled for delivery</small></article>
              </div>
              <div className="thoh-two-column">
                <article className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Inbox</p><h2>Recent website messages</h2></div><button className="thoh-link-button" onClick={() => setActiveTab("submissions")}>Open inbox</button></div>
                  {dashboard.submissions.slice(0, 5).map((item) => <button className="thoh-list-row thoh-list-row--button" key={item.id} onClick={() => setActiveTab("submissions")}><span><strong>{item.name}</strong><small>{item.topic} · {prettyDate(item.createdAt)}</small></span><em className={"thoh-status thoh-status--" + item.status}>{item.status}</em></button>)}
                  {!dashboard.submissions.length ? <p className="thoh-muted">No website messages yet.</p> : null}
                </article>
                <article className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Traffic</p><h2>Most visited pages</h2></div></div>
                  {snapshot.pageAnalytics.map((item) => <div className="thoh-list-row" key={item.path}><span><strong>{item.path}</strong><small>Page views</small></span><b>{item.views}</b></div>)}
                  {!snapshot.pageAnalytics.length ? <p className="thoh-muted">Analytics will appear as visitors use the site.</p> : null}
                </article>
              </div>
            </section>
          ) : null}

          {activeTab === "submissions" ? (
            <section className="thoh-stack">
              <div className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Website messages</p><h2>Contact submissions inbox</h2><p className="thoh-muted">This is a website-submissions inbox, not an external mailbox.</p></div><button className="thoh-button" onClick={() => void refresh()}>Refresh</button></div>
                <div className="thoh-toolbar"><input aria-label="Search submissions" placeholder="Search name, email, topic, or message" value={submissionQuery} onChange={(event) => setSubmissionQuery(event.target.value)} /><div className="thoh-chip-row">{(["all", "new", "read", "archived"] as const).map((filter) => <button key={filter} className={submissionFilter === filter ? "is-active" : ""} onClick={() => setSubmissionFilter(filter)}>{filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}</button>)}</div></div>
                <div className="thoh-submission-list">{submissions.map((item) => <article className={"thoh-submission " + (item.status === "new" ? "is-new" : "")} key={item.id}><div className="thoh-submission-top"><div><h3>{item.topic}</h3><p><strong>{item.name}</strong> · <a href={"mailto:" + item.email}>{item.email}</a>{item.phone ? " · " + item.phone : ""}</p></div><span className={"thoh-status thoh-status--" + item.status}>{item.status}</span></div><p className="thoh-message">{item.message || "No message provided."}</p><div className="thoh-row-actions"><small>{prettyDate(item.createdAt)}</small>{item.status === "new" ? <button onClick={() => void updateSubmission(item, "read")} disabled={busy === "submission-" + item.id}>Mark read</button> : null}{item.status !== "archived" ? <button onClick={() => void updateSubmission(item, "archive")} disabled={busy === "submission-" + item.id}>Archive</button> : <button onClick={() => void updateSubmission(item, "restore")} disabled={busy === "submission-" + item.id}>Restore</button>}</div></article>)}</div>
                {!submissions.length ? <p className="thoh-muted thoh-empty">No submissions match this view.</p> : null}
              </div>
            </section>
          ) : null}

          {activeTab === "newsletter" ? (
            <section className="thoh-two-column">
              <article className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Resend delivery</p><h2>{editingNewsletter ? "Edit scheduled newsletter" : "Create newsletter"}</h2></div>{editingNewsletter ? <button className="thoh-link-button" onClick={resetNewsletter}>Cancel edit</button> : null}</div>
                <form className="thoh-form" onSubmit={(event) => void saveNewsletter(event)}><Field label="Subject"><input value={newsletter.subject} onChange={(event) => setNewsletter((current) => ({ ...current, subject: event.target.value }))} required /></Field><Field label="Message"><textarea rows={12} value={newsletter.body} onChange={(event) => setNewsletter((current) => ({ ...current, body: event.target.value }))} required /></Field><Field label="Schedule"><input type="datetime-local" value={newsletter.scheduledForLocal} onChange={(event) => setNewsletter((current) => ({ ...current, scheduledForLocal: event.target.value }))} required /><small>Your local timezone: {"Browser local time"}</small></Field><div className="thoh-card-subheading"><strong>Recipients</strong><div className="thoh-row-actions"><button type="button" onClick={() => setSelectedRecipients(dashboard.subscribers.map((item) => item.id))}>Select all</button><button type="button" onClick={() => setSelectedRecipients([])}>Clear</button></div></div><div className="thoh-recipient-list">{dashboard.subscribers.map((item) => <label key={item.id}><input type="checkbox" checked={selectedRecipients.includes(item.id)} onChange={(event) => setSelectedRecipients((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />{item.email}</label>)}</div><button className="thoh-button thoh-button--primary" disabled={busy === "newsletter"}>{editingNewsletter ? "Update schedule" : "Schedule newsletter"}</button></form>
                <div className="thoh-test-box"><strong>Preview / test</strong><p className="thoh-preview">{newsletter.body || "Your newsletter preview will appear here."}</p><div className="thoh-inline-form"><input type="email" placeholder="test recipient@example.org" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} /><button className="thoh-button" disabled={!newsletter.subject || !newsletter.body || !testEmail || busy === "test"} onClick={() => void sendTest()}>Send test</button></div></div>
              </article>
              <article className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Outbox</p><h2>Scheduled and sent</h2></div><button className="thoh-button" onClick={() => void processNewsletters()} disabled={busy === "process"}>Process due</button></div>{dashboard.newsletters.map((item) => <div className="thoh-queue-row" key={item.id}><div><strong>{item.subject}</strong><small>{item.status} · {prettyDate(item.scheduledForIso)}</small></div><div className="thoh-row-actions">{item.status === "queued" || item.status === "failed" ? <><button onClick={() => editNewsletter(item)}>Edit</button><button onClick={() => void deleteNewsletter(item.id)} disabled={busy === item.id}>Delete</button></> : null}</div></div>)}{!dashboard.newsletters.length ? <p className="thoh-muted">No newsletters created yet.</p> : null}</article>
            </section>
          ) : null}

          {activeTab === "content" ? (
            <section className="thoh-stack">
              <div className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Draft and publish</p><h2>Website content editor</h2><p className="thoh-muted">Changes stay in D1 as a draft until you publish them.</p></div><div className="thoh-row-actions"><button className="thoh-button" onClick={() => void saveContent("reset")} disabled={busy.startsWith("content-")}>Reset</button><button className="thoh-button" onClick={() => void saveContent("save")} disabled={busy.startsWith("content-")}>Save draft</button><button className="thoh-button thoh-button--primary" onClick={() => void saveContent("publish")} disabled={busy.startsWith("content-")}>Publish</button></div></div></div>
              <div className="thoh-two-column">
                <article className="thoh-card"><h2>About</h2><div className="thoh-form"><Field label="Title"><input value={draft.about.title} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, title: event.target.value } }))} /></Field><Field label="Subtitle"><input value={draft.about.subtitle} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, subtitle: event.target.value } }))} /></Field><Field label="Mission heading"><input value={draft.about.missionHeading} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, missionHeading: event.target.value } }))} /></Field><Field label="Mission"><textarea rows={6} value={draft.about.missionBody} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, missionBody: event.target.value } }))} /></Field><Field label="Vision heading"><input value={draft.about.visionHeading} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, visionHeading: event.target.value } }))} /></Field><Field label="Vision"><textarea rows={6} value={draft.about.visionBody} onChange={(event) => updateDraft((current) => ({ ...current, about: { ...current.about, visionBody: event.target.value } }))} /></Field></div></article>
                <article className="thoh-card"><h2>Newsletter and support</h2><div className="thoh-form"><Field label="Newsletter title"><input value={draft.newsletter.title} onChange={(event) => updateDraft((current) => ({ ...current, newsletter: { ...current.newsletter, title: event.target.value } }))} /></Field><Field label="Newsletter body"><textarea rows={5} value={draft.newsletter.body} onChange={(event) => updateDraft((current) => ({ ...current, newsletter: { ...current.newsletter, body: event.target.value } }))} /></Field><Field label="Events heading"><input value={draft.events.heading} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, heading: event.target.value } }))} /></Field><Field label="Events intro"><textarea rows={4} value={draft.events.intro} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, intro: event.target.value } }))} /></Field><Field label="Support heading"><input value={draft.shop.heading} onChange={(event) => updateDraft((current) => ({ ...current, shop: { ...current.shop, heading: event.target.value } }))} /></Field><Field label="Support body"><textarea rows={5} value={draft.shop.body} onChange={(event) => updateDraft((current) => ({ ...current, shop: { ...current.shop, body: event.target.value } }))} /></Field><Field label="Support link"><input value={draft.shop.ctaHref} onChange={(event) => updateDraft((current) => ({ ...current, shop: { ...current.shop, ctaHref: event.target.value } }))} /></Field></div></article>
              </div>
              <article className="thoh-card"><h2>Featured event</h2><div className="thoh-form"><Field label="Title"><input value={draft.events.items[0].title} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, items: [{ ...current.events.items[0], title: event.target.value }] } }))} /></Field><Field label="Description"><textarea rows={5} value={draft.events.items[0].description} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, items: [{ ...current.events.items[0], description: event.target.value }] } }))} /></Field><Field label="Image path"><input value={draft.events.items[0].imageSrc} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, items: [{ ...current.events.items[0], imageSrc: event.target.value }] } }))} /></Field><Field label="Call-to-action link"><input value={draft.events.items[0].ctaHref} onChange={(event) => updateDraft((current) => ({ ...current, events: { ...current.events, items: [{ ...current.events.items[0], ctaHref: event.target.value }] } }))} /></Field></div></article>
            </section>
          ) : null}

          {activeTab === "activity" ? <section className="thoh-card"><div className="thoh-card-heading"><div><p className="thoh-kicker">Audit trail</p><h2>Admin activity</h2></div><button className="thoh-button" onClick={() => void refresh()}>Refresh</button></div>{dashboard.activity.map((item: ActivityEvent) => <div className="thoh-activity-row" key={item.id}><span><strong>{item.action.replace(/_/g, " ")}</strong><small>{item.entityType}{item.entityId ? " · " + item.entityId : ""}</small></span><span><small>{item.actor}</small><small>{prettyDate(item.createdAt)}</small></span></div>)}{!dashboard.activity.length ? <p className="thoh-muted">No activity recorded yet.</p> : null}</section> : null}

          {activeTab === "help" ? <section className="thoh-card thoh-help"><p className="thoh-kicker">Operating guide</p><h2>Keep the dashboard focused</h2><ul><li>Review new website messages in Submissions, mark them read, and archive completed conversations.</li><li>Use Newsletter to preview, test, schedule, and process outbound updates through Resend.</li><li>Use Site content to save a draft first, then publish only when the live copy is ready.</li><li>Activity log records sign-ins, submissions, content changes, and newsletter operations.</li><li>Production sign-in is handled by Cloudflare Access; local credentials are for development only.</li></ul></section> : null}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const principal = await getAdminIdentity(context.req);
  const localLoginEnabled = await isLocalAdminLoginEnabled();
  const localUsername = await getLocalAdminUsername();
  const googleClientId = (await getRuntimeEnv()).GOOGLE_CLIENT_ID ?? "";
  if (!principal) return { props: { authenticated: false, principal: null, data: null, localLoginEnabled, localUsername, googleClientId } };
  return { props: { authenticated: true, principal, data: await getDashboardData(), localLoginEnabled, localUsername, googleClientId } };
};
