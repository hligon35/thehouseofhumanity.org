"use strict";

function sanitize(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function showFormMessage(form, message, type) {
  const region = form.querySelector("[data-form-message], #formMessage");
  if (!region) return;
  region.textContent = message;
  region.dataset.type = type || "info";
  region.hidden = false;
  region.style.display = "block";
}

function showNotice(message, type) {
  const existing = document.querySelector(".thoh-site-notice");
  if (existing) existing.remove();
  const notice = document.createElement("div");
  notice.className = "thoh-site-notice thoh-site-notice--" + (type || "info");
  notice.setAttribute("role", type === "error" ? "alert" : "status");
  notice.textContent = message;
  document.body.appendChild(notice);
  window.setTimeout(function () { notice.remove(); }, 6000);
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (window.__thohTurnstilePromise) return window.__thohTurnstilePromise;
  window.__thohTurnstilePromise = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[data-thoh-turnstile]');
    var script = existing || document.createElement("script");
    var settled = false;
    var waitForApi = window.setInterval(function () {
      if (!settled && window.turnstile) {
        settled = true;
        window.clearInterval(waitForApi);
        resolve(window.turnstile);
      }
    }, 100);
    var timeout = window.setTimeout(function () {
      if (!settled) {
        settled = true;
        window.clearInterval(waitForApi);
        reject(new Error("Security verification is unavailable."));
      }
    }, 10000);
    script.addEventListener("load", function () {
      if (!settled && window.turnstile) {
        settled = true;
        window.clearInterval(waitForApi);
        window.clearTimeout(timeout);
        resolve(window.turnstile);
      }
    }, { once: true });
    script.addEventListener("error", function () {
      if (!settled) {
        settled = true;
        window.clearInterval(waitForApi);
        window.clearTimeout(timeout);
        reject(new Error("Security verification is unavailable."));
      }
    }, { once: true });
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.thohTurnstile = "true";
      document.head.appendChild(script);
    }
  });
  return window.__thohTurnstilePromise;
}

function resetTurnstile(form) {
  if (window.turnstile && form.__thohTurnstileWidget !== undefined) {
    window.turnstile.reset(form.__thohTurnstileWidget);
  }
  delete form.dataset.turnstileToken;
  var button = form.querySelector('button[type="submit"]');
  if (button && form.dataset.turnstileRequired === "true") button.disabled = true;
}

async function setupTurnstileProtection(form) {
  var button = form.querySelector('button[type="submit"]');
  var container = form.querySelector("[data-turnstile-container]");
  form.dataset.formStartedAt = String(Date.now());
  try {
    var configResponse = await fetch("/api/contact-config?ts=" + Date.now(), {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!configResponse.ok) throw new Error("Security verification could not be configured.");
    var config = await configResponse.json();
    if (!config.enabled) {
      if (button) button.disabled = false;
      return;
    }
    form.dataset.turnstileRequired = "true";
    if (!container || !config.siteKey || config.siteKey.indexOf("replace-with-") === 0) {
      throw new Error("Security verification is not configured. Please contact the site administrator.");
    }
    if (button) button.disabled = true;
    var turnstile = await loadTurnstileScript();
    form.__thohTurnstileWidget = turnstile.render(container, {
      sitekey: config.siteKey,
      appearance: "always",
      theme: "light",
      callback: function (token) {
        form.dataset.turnstileToken = token;
        if (button) button.disabled = false;
      },
      "expired-callback": function () { resetTurnstile(form); },
      "error-callback": function () { resetTurnstile(form); }
    });
  } catch (error) {
    if (button) button.disabled = true;
    showFormMessage(form, error instanceof Error ? error.message : "Security verification is unavailable.", "error");
  }
}

function trackEvent(eventType, metadata) {
  try {
    const visitorKey = "thoh_analytics_visitor";
    let visitorId = sessionStorage.getItem(visitorKey);
    if (!visitorId) {
      visitorId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
      sessionStorage.setItem(visitorKey, visitorId);
    }
    return fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventType: eventType,
        path: window.location.pathname,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        visitorId: visitorId,
        metadata: metadata || {}
      })
    }).catch(function () { return null; });
  } catch (_) {
    return Promise.resolve(null);
  }
}

function closeMenu(navMenu, navToggle, backdrop) {
  navMenu.classList.remove("active");
  navToggle.classList.remove("active");
  navToggle.setAttribute("aria-expanded", "false");
  if (backdrop) backdrop.classList.remove("active");
  document.body.style.overflow = "";
  document.body.style.touchAction = "";
}

function initNavigation() {
  const navMenu = document.getElementById("nav-menu");
  const navToggle = document.getElementById("nav-toggle");
  if (!navMenu || !navToggle) return;
  let backdrop = document.querySelector(".nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);
  }
  navToggle.addEventListener("click", function () {
    const open = navMenu.classList.toggle("active");
    navToggle.classList.toggle("active", open);
    navToggle.setAttribute("aria-expanded", String(open));
    backdrop.classList.toggle("active", open);
    document.body.style.overflow = open ? "hidden" : "";
    document.body.style.touchAction = open ? "none" : "";
  });
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", function () { closeMenu(navMenu, navToggle, backdrop); });
  });
  backdrop.addEventListener("click", function () { closeMenu(navMenu, navToggle, backdrop); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && navMenu.classList.contains("active")) {
      closeMenu(navMenu, navToggle, backdrop);
      navToggle.focus();
    }
  });
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      const targetId = link.getAttribute("href");
      const target = targetId ? document.querySelector(targetId) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", targetId);
    });
  });
}

function initPublicForms() {
  document.querySelectorAll("form[data-turnstile-form]").forEach(function (form) {
    void setupTurnstileProtection(form);
    if (!form.matches("form.contact-form")) return;
    const pageUrl = form.querySelector('[name="PageURL"]');
    if (pageUrl) pageUrl.value = window.location.href;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value) return;
      const name = form.querySelector('[name="Name"]');
      const email = form.querySelector('[name="Email"]');
      const topic = form.querySelector('[name="Topic"]');
      const message = form.querySelector('[name="Message"]');
      const phone = form.querySelector('[name="Phone"]');
      const submittedTopic = topic.value;
      if (!name.value.trim() || !/^\S+@\S+\.\S+$/.test(email.value.trim()) || !topic.value) {
        showFormMessage(form, "Please provide your name, a valid email, and a topic.", "error");
        return;
      }
      if (form.dataset.turnstileRequired === "true" && !form.dataset.turnstileToken) {
        showFormMessage(form, "Please complete the security check and try again.", "error");
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      const original = button ? button.textContent : "Send";
      if (button) { button.disabled = true; button.textContent = "Sending..."; }
      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Name: sanitize(name.value, 120), Email: sanitize(email.value, 254), Phone: sanitize(phone ? phone.value : "", 40),
            Topic: sanitize(submittedTopic, 120), Message: sanitize(message ? message.value : "", 4000),
            PageURL: window.location.href, website: "", formStartedAt: form.dataset.formStartedAt || "",
            "cf-turnstile-response": form.dataset.turnstileToken || ""
          })
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(result.error || "Unable to send your message.");
        form.reset();
        resetTurnstile(form);
        form.dataset.formStartedAt = String(Date.now());
        showFormMessage(form, "Thanks — we received your message and will follow up soon.", "success");
        showNotice("Thanks — we received your message.", "success");
        trackEvent("contact_form_submit", { topic: submittedTopic });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Unable to send your message.";
        showFormMessage(form, messageText, "error");
        showNotice(messageText, "error");
      } finally {
        if (form.dataset.turnstileRequired === "true") resetTurnstile(form);
        if (button) { button.disabled = form.dataset.turnstileRequired === "true"; button.textContent = original; }
      }
    });
  });
}

function initAnalytics() {
  trackEvent("page_view", { title: document.title });
  document.addEventListener("click", function (event) {
    const link = event.target.closest("a");
    if (link && link.hostname && link.hostname !== window.location.hostname) {
      trackEvent("external_link_click", { url: link.href, text: link.textContent.trim().slice(0, 120) });
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initNavigation();
  initPublicForms();
  initAnalytics();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
});
