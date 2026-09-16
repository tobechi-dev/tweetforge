"use strict";

/* ------------------------------------------------------------------ *
 * TweetForge dashboard
 * - Real health from /api/health (never hardcodes "Operational")
 * - Resilient data loading (allSettled, per-endpoint errors)
 * - Event-delegated copy + trigger, no inline onclick
 * - Polling with visibility-aware teardown
 * ------------------------------------------------------------------ */

const POLL_INTERVAL_MS = 30_000;
const API = {
  stats: "/api/stats",
  drafts: "/api/drafts",
  activity: "/api/activity",
  health: "/api/health",
  trigger: "/api/trigger",
};

const state = {
  pollingTimer: null,
  lastDrafts: [],
  lastHealth: null,
};

/* ----------------------------- boot ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  tickClock();
  setInterval(tickClock, 1000);

  bindEvents();
  refreshAll();
  startPolling();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPolling();
    else {
      refreshAll();
      startPolling();
    }
  });
});

/* ---------------------------- clock ----------------------------- */

function tickClock() {
  const el = document.getElementById("current-time");
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/* -------------------------- data layer -------------------------- */

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    ...options,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg = (body && body.message) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function refreshAll() {
  const [stats, drafts, activity, health] = await Promise.allSettled([
    fetchJSON(API.stats),
    fetchJSON(API.drafts),
    fetchJSON(API.activity),
    fetchJSON(API.health),
  ]);

  if (stats.status === "fulfilled") renderStats(stats.value);
  else renderStatsError(stats.reason);

  if (drafts.status === "fulfilled") renderDrafts(drafts.value);
  else renderDraftsError(drafts.reason);

  if (activity.status === "fulfilled") renderActivity(activity.value);
  else renderActivityError(activity.reason);

  if (health.status === "fulfilled") renderHealth(health.value);
  else renderHealthError(health.reason);
}

function startPolling() {
  stopPolling();
  state.pollingTimer = setInterval(refreshAll, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (state.pollingTimer) clearInterval(state.pollingTimer);
  state.pollingTimer = null;
}

/* --------------------------- renderers -------------------------- */

function renderStats(stats) {
  const s = stats || {};
  animateNumber("total-drafts", Number(s.totalDrafts) || 0);
  animateNumber("success-rate", Number(s.successRate ?? 100), "%");
  setText("last-run", s.lastRun ? timeAgo(new Date(s.lastRun)) : "Never");
  animateNumber("events-today", Number(s.eventsToday) || 0);

  if (typeof s.draftsToday === "number") {
    setText("drafts-delta", `${s.draftsToday} today`);
  }
}
function renderStatsError(err) {
  console.warn("[stats]", err);
  setText("total-drafts", "—");
  setText("success-rate", "—");
  setText("last-run", "—");
  setText("events-today", "—");
}

function renderDrafts(drafts) {
  state.lastDrafts = Array.isArray(drafts) ? drafts : [];
  const container = document.getElementById("drafts-list");
  const subtitle = document.getElementById("drafts-subtitle");

  if (state.lastDrafts.length === 0) {
    subtitle.textContent = "No drafts yet";
    container.innerHTML = emptyState(
      "sparkles",
      "No drafts generated yet",
      'Click "Run now" to trigger the pipeline.',
    );
    if (window.lucide) lucide.createIcons();
    return;
  }

  subtitle.textContent = `${state.lastDrafts.length} draft${state.lastDrafts.length === 1 ? "" : "s"}`;
  container.innerHTML = state.lastDrafts.map(draftCard).join("");
  if (window.lucide) lucide.createIcons();
}
function renderDraftsError(err) {
  console.warn("[drafts]", err);
  document.getElementById("drafts-subtitle").textContent = "Unavailable";
  document.getElementById("drafts-list").innerHTML = emptyState(
    "alert-circle",
    "Could not load drafts",
    err?.message || "Unknown error",
    "error",
  );
  if (window.lucide) lucide.createIcons();
}

function draftCard(draft, idx) {
  const id = escapeAttr(String(draft.id ?? idx));
  const charCount = Number(draft.charCount) || (draft.content?.length ?? 0);
  const ts = draft.timestamp ? timeAgo(new Date(draft.timestamp)) : "";

  return `
    <article class="p-4 bg-white/[0.03] hover:bg-white/[0.05] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
      <div class="flex items-start justify-between gap-3 mb-2">
        ${charBadge(charCount)}
        <span class="text-[11px] text-zinc-500 truncate">${escapeHtml(draft.repo || "unknown")}</span>
      </div>
      <p class="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap mb-3">${escapeHtml(draft.content || "")}</p>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-zinc-500">${ts}</span>
        <button
          type="button"
          class="copy-btn text-[11px] px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
          data-draft-id="${id}"
        >
          <i data-lucide="copy" class="w-3 h-3"></i>
          Copy
        </button>
      </div>
    </article>
  `;
}

function charBadge(count) {
  const cls =
    count < 250
      ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/20"
      : count <= 280
        ? "bg-brand-amber/15 text-brand-amber border-brand-amber/20"
        : "bg-brand-rose/15 text-brand-rose border-brand-rose/20";
  return `<span class="text-[10px] font-mono ${cls} border px-2 py-0.5 rounded-full">${count}/280</span>`;
}

function renderActivity(activities) {
  const list = Array.isArray(activities) ? activities.slice(0, 8) : [];
  const container = document.getElementById("activity-feed");

  if (list.length === 0) {
    container.innerHTML = emptyState(
      "inbox",
      "No recent activity",
      "GitHub events will appear here.",
    );
    if (window.lucide) lucide.createIcons();
    return;
  }

  const icons = {
    commit: "git-commit",
    pr_merge: "git-merge",
    pr_open: "git-pull-request",
    issue_close: "check-circle",
    release: "tag",
    create_tag: "tag",
  };

  container.innerHTML = list
    .map(
      (a) => `
    <div class="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
      <i data-lucide="${icons[a.type] || "activity"}" class="w-3.5 h-3.5 text-brand-emerald mt-0.5 shrink-0"></i>
      <div class="min-w-0 flex-1">
        <p class="text-xs text-zinc-300 truncate">${escapeHtml(a.description || "")}</p>
        <p class="text-[10px] text-zinc-500 mt-0.5 truncate">
          ${escapeHtml(a.repo || "")}${a.timestamp ? " · " + timeAgo(new Date(a.timestamp)) : ""}
        </p>
      </div>
    </div>
  `,
    )
    .join("");

  if (window.lucide) lucide.createIcons();
}
function renderActivityError(err) {
  console.warn("[activity]", err);
  document.getElementById("activity-feed").innerHTML = emptyState(
    "alert-circle",
    "Activity unavailable",
    err?.message || "Unknown error",
    "error",
  );
  if (window.lucide) lucide.createIcons();
}

/* --------------------------- health ----------------------------- *
 * Contract expected from /api/health:
 * {
 *   github:      { configured: boolean, reachable?: boolean, status?: 'operational'|'degraded'|'error'|'unconfigured', message?: string },
 *   huggingface: { ... same ... },
 *   discord:     { ... same ... }
 * }
 * Also tolerates flat booleans: { github: true, huggingface: false, ... }
 * ------------------------------------------------------------------ */

function normalizeHealth(raw) {
  const services = raw?.services || {};
  const order = ["github", "huggingface", "discord"];
  return order.map((key) => {
    const v = services[key] || {};
    const stateMap = {
      operational: "ok",
      degraded: "warn",
      error: "err",
      unconfigured: "warn",
      unknown: "idle",
    };
    return {
      key,
      label: v.label || key,
      state: stateMap[v.state] || "idle",
      detail: v.message || prettyState(v.state),
    };
  });
}

function prettyState(s) {
  return (
    {
      operational: "Operational",
      degraded: "Degraded",
      error: "Error",
      unconfigured: "Not configured",
      unknown: "Unknown",
    }[s] || "Unknown"
  );
}

function renderHealth(raw) {
  state.lastHealth = raw;
  const rows = normalizeHealth(raw);
  const container = document.getElementById("health-list");

  container.innerHTML = rows
    .map(
      ({ key, label, state, detail }) => `
    <div class="flex items-center justify-between" data-health="${key}">
      <div class="flex items-center gap-2.5">
        <span class="status-dot ${state}"></span>
        <span class="text-xs text-zinc-300">${escapeHtml(label)}</span>
      </div>
      <span class="text-[10px] uppercase tracking-wider ${
        state === "ok"
          ? "text-brand-emerald"
          : state === "warn"
            ? "text-brand-amber"
            : state === "err"
              ? "text-brand-rose"
              : "text-zinc-500"
      }">${escapeHtml(detail)}</span>
    </div>
  `,
    )
    .join("");

  // Global status = worst of the three
  const worst = rows.some((r) => r.state === "err")
    ? "err"
    : rows.some((r) => r.state === "warn")
      ? "warn"
      : rows.every((r) => r.state === "ok")
        ? "ok"
        : "idle";

  const dot = document.getElementById("global-status-dot");
  dot.className = `status-dot ${worst}`;
  setText(
    "global-status-label",
    worst === "ok"
      ? "All systems operational"
      : worst === "warn"
        ? "Partial configuration"
        : worst === "err"
          ? "Systems degraded"
          : "Checking…",
  );
}

function renderHealthError(err) {
  console.warn("[health]", err);
  document.getElementById("health-list").innerHTML = emptyState(
    "alert-triangle",
    "Health check failed",
    err?.message || "Unknown error",
    "error",
  );
  const dot = document.getElementById("global-status-dot");
  dot.className = "status-dot err";
  setText("global-status-label", "Health check failed");
  if (window.lucide) lucide.createIcons();
}

/* ---------------------------- events ---------------------------- */

function bindEvents() {
  document.getElementById("trigger-btn")?.addEventListener("click", onTrigger);
  document.getElementById("refresh-health")?.addEventListener("click", () => {
    fetchJSON(API.health).then(renderHealth).catch(renderHealthError);
  });

  // Delegated copy handler — works for cards rendered at any time
  document.getElementById("drafts-list")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;

    const id = btn.getAttribute("data-draft-id");
    const draft = state.lastDrafts.find((d) => String(d.id) === id);
    if (!draft) return;

    const original = btn.innerHTML;
    btn.disabled = true;

    try {
      await copyToClipboard(draft.content || "");
      // Best-effort telemetry; don't fail the UX if it 404s
      fetch(`/api/drafts/${encodeURIComponent(id)}/copy`, {
        method: "POST",
      }).catch(() => {});
      btn.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-brand-emerald"></i> Copied`;
      showToast("Copied to clipboard");
    } catch {
      btn.innerHTML = `<i data-lucide="x" class="w-3 h-3 text-brand-rose"></i> Failed`;
      showToast("Failed to copy", "error");
    } finally {
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
  });
}

async function onTrigger() {
  const btn = document.getElementById("trigger-btn");
  const label = document.getElementById("trigger-label");
  const original = label.textContent;

  btn.disabled = true;
  label.textContent = "Running…";
  btn.querySelector("i")?.setAttribute("data-lucide", "loader-2");
  if (window.lucide) lucide.createIcons();

  try {
    const result = await fetchJSON(API.trigger, { method: "POST" });
    if (result && result.success === false) {
      showToast(result.message || "Pipeline rejected", "error");
    } else {
      showToast("Pipeline triggered");
      // give the pipeline a moment, then refresh
      setTimeout(refreshAll, 2500);
    }
  } catch (err) {
    showToast(err?.message || "Failed to trigger pipeline", "error");
  } finally {
    btn.disabled = false;
    label.textContent = original;
    btn.querySelector("i")?.setAttribute("data-lucide", "play");
    if (window.lucide) lucide.createIcons();
  }
}

/* --------------------------- utilities -------------------------- */

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Fallback for non-secure contexts
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function emptyState(icon, title, subtitle, tone = "muted") {
  const color = tone === "error" ? "text-brand-rose" : "text-zinc-500";
  return `
    <div class="text-center py-8 px-4">
      <i data-lucide="${icon}" class="w-6 h-6 mx-auto mb-2 ${color}"></i>
      <p class="text-sm text-zinc-300">${escapeHtml(title)}</p>
      <p class="text-xs text-zinc-500 mt-1">${escapeHtml(subtitle || "")}</p>
    </div>`;
}

function timeAgo(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "unknown";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function animateNumber(id, target, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Number(String(el.textContent).replace(/[^\d.-]/g, "")) || 0;
  if (start === target) {
    el.textContent = target + suffix;
    return;
  }

  const duration = 700;
  const t0 = performance.now();
  const from = start;
  const to = target;

  function step(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const msg = document.getElementById("toast-message");
  const icon = document.getElementById("toast-icon");
  if (!toast || !msg) return;

  msg.textContent = message;
  if (icon) {
    icon.setAttribute("data-lucide", type === "error" ? "alert-circle" : "check-circle");
    icon.setAttribute(
      "class",
      `w-4 h-4 shrink-0 ${type === "error" ? "text-brand-rose" : "text-brand-emerald"}`,
    );
  }
  if (window.lucide) lucide.createIcons();

  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function escapeHtml(v) {
  const d = document.createElement("div");
  d.textContent = v == null ? "" : String(v);
  return d.innerHTML;
}
function escapeAttr(v) {
  return escapeHtml(v).replace(/"/g, "&quot;");
}
