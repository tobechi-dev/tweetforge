// Initialize Lucide icons
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  updateTime();
  setInterval(updateTime, 1000);
  loadDashboardData();
  setupTriggerButton();
});

function updateTime() {
  const now = new Date();
  document.getElementById('current-time').textContent =
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

async function loadDashboardData() {
  try {
    const [stats, drafts, activity] = await Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/drafts').then(r => r.json()),
      fetch('/api/activity').then(r => r.json()),
    ]);

    updateStats(stats);
    updateDrafts(drafts);
    updateActivity(activity);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

function updateStats(stats) {
  document.getElementById('total-drafts').textContent = stats.totalDrafts || 0;
  document.getElementById('success-rate').textContent = `${stats.successRate || 100}%`;
  document.getElementById('last-run').textContent = stats.lastRun
    ? timeAgo(new Date(stats.lastRun))
    : 'Never';
  document.getElementById('events-today').textContent = stats.eventsToday || 0;
}

function updateDrafts(drafts) {
  const container = document.getElementById('drafts-list');
  if (!drafts || drafts.length === 0) {
    container.innerHTML = '<p class="text-zinc-400 text-sm">No drafts yet. Run the pipeline to generate drafts.</p>';
    return;
  }

  container.innerHTML = drafts.map((draft, idx) => {
    const colorClass = draft.charCount < 250 ? 'bg-brand-emerald/20 text-brand-emerald'
      : draft.charCount <= 280 ? 'bg-brand-amber/20 text-brand-amber'
      : 'bg-brand-rose/20 text-brand-rose';

    return `
      <div class="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all animate-fade-in stagger-${idx + 1}">
        <div class="flex items-start justify-between mb-2">
          <span class="text-xs ${colorClass} px-2 py-1 rounded-full">${draft.charCount}/280</span>
          <span class="text-xs text-zinc-500">${draft.repo}</span>
        </div>
        <p class="text-sm text-zinc-300 mb-3">${escapeHtml(draft.content)}</p>
        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-500">${timeAgo(new Date(draft.timestamp))}</span>
          <button onclick="copyDraft('${draft.id}', \`${draft.content.replace(/`/g, '\\`')}\`)" class="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3"></i> Copy
          </button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
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
    issue_close: 'check-circle',
    release: 'tag',
  };

  container.innerHTML = activities.slice(0, 5).map(activity => `
    <div class="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
      <i data-lucide="${iconMap[activity.type] || 'activity'}" class="w-4 h-4 text-brand-emerald mt-0.5"></i>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-zinc-300 truncate">${escapeHtml(activity.description)}</p>
        <p class="text-xs text-zinc-500">${activity.repo} • ${timeAgo(new Date(activity.timestamp))}</p>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function setupTriggerButton() {
  const btn = document.getElementById('trigger-btn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Running...';
    lucide.createIcons();

    try {
      const response = await fetch('/api/trigger', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        showToast('Pipeline triggered successfully!');
        setTimeout(loadDashboardData, 2000);
      } else {
        showToast('Failed to trigger pipeline', 'error');
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
  toast.style.borderColor = type === 'error' ? 'rgba(251, 113, 133, 0.3)' : 'rgba(52, 211, 153, 0.3)';
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
