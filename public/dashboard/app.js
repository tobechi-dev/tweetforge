// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  updateTime();
  setInterval(updateTime, 1000);
  loadDashboardData();
  setupTriggerButton();
  setupCopyButtons();
});

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  document.getElementById('current-time').textContent = timeStr;
}

async function loadDashboardData() {
  try {
    const [stats, drafts, activity, health] = await Promise.all([
      fetchAPI('/api/stats'),
      fetchAPI('/api/drafts'),
      fetchAPI('/api/activity'),
      fetchAPI('/api/health'),
    ]);

    updateStats(stats);
    updateDrafts(drafts);
    updateActivity(activity);
    updateHealth(health);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

async function fetchAPI(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

function updateStats(stats) {
  animateNumber('total-drafts', stats.totalDrafts || 0);
  animateNumber('success-rate', stats.successRate || 100, '%');
  document.getElementById('last-run').textContent = stats.lastRun
    ? timeAgo(new Date(stats.lastRun))
    : 'Never';
  animateNumber('events-today', stats.eventsToday || 0);
}

function updateDrafts(drafts) {
  const container = document.getElementById('drafts-list');
  if (!drafts || drafts.length === 0) {
    container.innerHTML = '<p class="text-zinc-400 text-sm">No drafts yet. Click "Run Now" to generate drafts.</p>';
    return;
  }

  container.innerHTML = drafts
    .map(
      (draft, idx) => `
    <div class="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all animate-fade-in stagger-${Math.min(idx + 1, 4)}">
      <div class="flex items-start justify-between mb-2">
        ${getCharBadge(draft.charCount)}
        <span class="text-xs text-zinc-500">${draft.repo}</span>
      </div>
      <p class="text-sm text-zinc-300 mb-3 leading-relaxed">${escapeHtml(draft.content)}</p>
      <div class="flex items-center justify-between">
        <span class="text-xs text-zinc-500">${timeAgo(new Date(draft.timestamp))}</span>
        <button
          onclick="copyDraft('${draft.id}', \`${escapeForTemplateLiteral(draft.content)}\`)"
          class="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-1.5 group"
        >
          <i data-lucide="copy" class="w-3 h-3 group-hover:scale-110 transition-transform"></i>
          Copy
        </button>
      </div>
    </div>
  `
    )
    .join('');

  lucide.createIcons();
}

function getCharBadge(charCount) {
  const colorClass =
    charCount < 250
      ? 'bg-brand-emerald/20 text-brand-emerald'
      : charCount <= 280
      ? 'bg-brand-amber/20 text-brand-amber'
      : 'bg-brand-rose/20 text-brand-rose';

  return `<span class="text-xs ${colorClass} px-2 py-1 rounded-full font-medium">${charCount}/280</span>`;
}

function updateActivity(activities) {
  const container = document.getElementById('activity-feed');
  if (!activities || activities.length === 0) {
    container.innerHTML = '<p class="text-zinc-400 text-sm">No recent activity.</p>';
    return;
  }

  const iconMap = {
    commit: 'git-commit',
    pr_merge: 'git-pull-request',
    pr_open: 'git-pull-request',
    issue_close: 'check-circle',
    release: 'tag',
    create_tag: 'tag',
  };

  container.innerHTML = activities
    .slice(0, 5)
    .map(
      (activity) => `
    <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
      <i data-lucide="${iconMap[activity.type] || 'activity'}" class="w-4 h-4 text-brand-emerald mt-0.5 flex-shrink-0"></i>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-zinc-300 truncate">${escapeHtml(activity.description)}</p>
        <p class="text-xs text-zinc-500 mt-0.5">${activity.repo} • ${timeAgo(new Date(activity.timestamp))}</p>
      </div>
    </div>
  `
    )
    .join('');

  lucide.createIcons();
}

function updateHealth(health) {
  const statusEl = document.querySelector('[data-health="github"]');
  if (statusEl) {
    const isOperational = health.github;
    statusEl.className = `w-2 h-2 rounded-full ${isOperational ? 'bg-brand-emerald' : 'bg-brand-rose'}`;
    statusEl.nextElementSibling.textContent = isOperational ? 'Operational' : 'Issues';
  }
}

function setupTriggerButton() {
  const btn = document.getElementById('trigger-btn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Running...';
    lucide.createIcons();

    try {
      const result = await fetchAPI('/api/trigger');
      if (result.success) {
        showToast('Pipeline triggered successfully!');
        setTimeout(() => loadDashboardData(), 3000);
      } else {
        showToast(result.message || 'Failed to trigger pipeline', 'error');
      }
    } catch (error) {
      showToast('Error triggering pipeline', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i> Run Now';
      lucide.createIcons();
    }
  });
}

function setupCopyButtons() {
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('[data-copy]');
    if (!btn) return;

    const content = btn.getAttribute('data-copy');
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      await fetch(`/api/drafts/${btn.getAttribute('data-id')}/copy`, { method: 'POST' });
      showToast('Copied to clipboard!');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  });
}

async function copyDraft(id, content) {
  try {
    await navigator.clipboard.writeText(content);
    await fetch(`/api/drafts/${id}/copy`, { method: 'POST' });
    showToast('Copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy', 'error');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.textContent = message;
  toast.classList.remove('hidden');
  toast.style.borderColor =
    type === 'error' ? 'rgba(251, 113, 133, 0.3)' : 'rgba(52, 211, 153, 0.3)';
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function animateNumber(elementId, targetValue, suffix = '') {
  const el = document.getElementById(elementId);
  const duration = 1000;
  const start = parseInt(el.textContent) || 0;
  const increment = (targetValue - start) / (duration / 16);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
      current = targetValue;
      clearInterval(timer);
    }
    el.textContent = Math.round(current) + suffix;
  }, 16);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeForTemplateLiteral(text) {
  return text.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}
