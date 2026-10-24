// Code Observatory - scan results dashboard
// Reads data/results.csv and lazily fetches reports from data/reports/.

import uPlot from './lib/dist/uPlot.esm.js';

const RESULTS_URL = 'data/results.csv';
const reportUrl = (repo) => `data/reports/${repo.replace(/\//g, '_')}.json`;
const logUrl = (repo) => `data/reports/${repo.replace(/\//g, '_')}.log`;

let rows = [];
let sortKey = 'score';
let sortDir = -1;
const charts = [];

// ---------- helpers ----------

function grade(score) {
  if (score == null || isNaN(score)) return null;
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const out = [];
  for (const line of lines.slice(1)) {
    const parts = line.replace(/\r$/, '').split(',');
    if (parts.length < 4 || !parts[0]) continue;
    const [repo, scanned_at, score, status] = parts;
    const parsed = score === '' ? null : parseFloat(score);
    out.push({
      repo,
      scanned_at,
      status: status.trim(),
      score: isNaN(parsed) ? null : parsed,
      grade: grade(parsed),
    });
  }
  return out;
}

function fmtScore(s) {
  return s == null ? '—' : s.toFixed(1);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatMetric(v) {
  if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
  return String(v);
}

// ---------- header meta and stat cards ----------

function renderMeta() {
  const last = rows.reduce((acc, r) => (r.scanned_at > acc ? r.scanned_at : acc), '');
  const parts = [`<span>${rows.length} scan${rows.length === 1 ? '' : 's'}</span>`];
  if (last) parts.push(`<span>last scan ${escapeHtml(fmtDate(last))}</span>`);
  document.getElementById('meta').innerHTML = parts.join('');
}

function renderStats() {
  const ok = rows.filter((r) => r.score != null);
  const failed = rows.filter((r) => r.status === 'failed');
  const avg = ok.length ? ok.reduce((a, r) => a + r.score, 0) / ok.length : null;
  const best = ok.length ? ok.reduce((a, r) => Math.max(a, r.score), -Infinity) : null;
  const stats = [
    ['Scans', rows.length],
    ['Scanned', ok.length],
    ['Failed', failed.length],
    ['Average score', fmtScore(avg)],
    ['Best score', fmtScore(best)],
  ];
  document.getElementById('stats').innerHTML = stats
    .map(([label, value]) =>
      `<div class="stat-card"><div class="stat-value">${value}</div>` +
      `<div class="stat-label">${label}</div></div>`)
    .join('');
}

// ---------- charts ----------

function renderCharts() {
  for (const c of charts) c.u.destroy();
  charts.length = 0;
  const ok = rows.filter((r) => r.score != null);

  renderDistribution(ok);
  renderTimeline(ok);
}

function renderDistribution(ok) {
  const el = document.getElementById('chart-distribution');
  el.innerHTML = '';
  if (!ok.length) {
    el.innerHTML = '<p class="loading">No scores yet.</p>';
    return;
  }
  const buckets = new Array(10).fill(0);
  for (const r of ok) buckets[Math.min(9, Math.max(0, Math.floor(r.score / 10)))]++;
  const labels = buckets.map((_, i) => `${i * 10}–${i * 10 + 9}`);

  const u = new uPlot({
    width: el.clientWidth || 500,
    height: 260,
    legend: { show: false },
    padding: [10, 10, 0, 0],
    scales: {
      x: { distr: 2 },
      y: { range: (u, min, max) => [0, Math.max(4, Math.ceil(max))] },
    },
    axes: [
      {
        stroke: '#adb5bd',
        grid: { show: false },
        ticks: { show: false },
        gap: 8,
        values: (u, splits) => splits.map((i) => labels[i] ?? ''),
      },
      {
        stroke: '#adb5bd',
        grid: { stroke: '#f1f3f5' },
        ticks: { show: false },
        size: 30,
        values: (u, splits) => splits.map((v) => (Number.isInteger(v) ? v : '')),
      },
    ],
    series: [
      {},
      {
        label: 'Scans',
        stroke: '#4e79a7',
        fill: 'rgba(78,121,167,0.55)',
        width: 1,
        paths: uPlot.paths.bars({ size: [0.85, 100] }),
        points: { show: false },
      },
    ],
  }, [labels.map((_, i) => i), buckets], el);
  charts.push({ u, el });
}

function renderTimeline(ok) {
  const el = document.getElementById('chart-timeline');
  el.innerHTML = '';
  const timed = ok.slice().sort((a, b) => new Date(a.scanned_at) - new Date(b.scanned_at));
  if (!timed.length) {
    el.innerHTML = '<p class="loading">No scores yet.</p>';
    return;
  }
  const xs = timed.map((r) => new Date(r.scanned_at).getTime());
  const ys = timed.map((r) => r.score);

  const u = new uPlot({
    width: el.clientWidth || 500,
    height: 260,
    legend: { show: false },
    padding: [10, 10, 0, 0],
    cursor: { points: { size: 8 } },
    scales: { x: { time: true }, y: { range: () => [0, 100] } },
    axes: [
      {
        stroke: '#adb5bd',
        grid: { stroke: '#f1f3f5' },
        ticks: { show: false },
        values: (u, splits) => splits.map((s) => new Date(s).toLocaleDateString()),
      },
      {
        stroke: '#adb5bd',
        grid: { stroke: '#f1f3f5' },
        ticks: { show: false },
        size: 30,
        values: (u, splits) => splits.map((v) => (Number.isInteger(v) ? v : '')),
      },
    ],
    series: [
      {},
      {
        label: 'Score',
        stroke: '#e94560',
        width: 2,
        fill: 'rgba(233,69,96,0.08)',
        points: { show: true, size: 6 },
      },
    ],
  }, [xs, ys], el);
  charts.push({ u, el });
}

// ---------- leaderboard table ----------

function filteredRows() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const status = document.getElementById('status-filter').value;
  return rows.filter((r) =>
    (status === 'all' || r.status === status) &&
    (!q || r.repo.toLowerCase().includes(q)));
}

function sortedRows() {
  const list = filteredRows();
  const dir = sortDir;
  list.sort((a, b) => {
    switch (sortKey) {
      case 'repo': return dir * a.repo.localeCompare(b.repo);
      case 'grade': return dir * (a.grade || '—').localeCompare(b.grade || '—');
      case 'scanned_at': return dir * a.scanned_at.localeCompare(b.scanned_at);
      case 'status': return dir * a.status.localeCompare(b.status);
      default: {
        if (a.score == null && b.score == null) return a.repo.localeCompare(b.repo);
        if (a.score == null) return 1;
        if (b.score == null) return -1;
        return dir * (a.score - b.score);
      }
    }
  });
  return list;
}

function renderTable() {
  const body = document.getElementById('leaderboard-body');
  const list = sortedRows();
  document.getElementById('empty').classList.toggle('hidden', list.length > 0);
  body.innerHTML = list.map((r, i) => {
    const g = r.grade;
    const badge = g
      ? `<span class="badge grade-${g}">${g}</span>`
      : '<span class="badge grade-none">—</span>';
    const scoreCls = g ? `score-${g}` : '';
    const statusCls = r.status === 'ok' ? 'status-ok' : 'status-failed';
    const statusTxt = r.status === 'ok' ? 'scanned' : 'failed';
    return `<tr data-repo="${r.repo}">` +
      `<td class="num">${i + 1}</td>` +
      `<td><a class="repo-link" href="https://github.com/${r.repo}" target="_blank" rel="noopener">${r.repo}</a></td>` +
      `<td>${badge}</td>` +
      `<td class="num ${scoreCls}">${fmtScore(r.score)}</td>` +
      `<td>${escapeHtml(fmtDate(r.scanned_at))}</td>` +
      `<td class="${statusCls}">${statusTxt}</td>` +
      `<td><button class="view-btn" data-repo="${r.repo}" type="button">View</button></td>` +
      '</tr>';
  }).join('');

  document.querySelectorAll('thead th[data-key]').forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.remove();
    if (th.dataset.key === sortKey) {
      th.insertAdjacentHTML('beforeend',
        `<span class="sort-arrow">${sortDir === -1 ? '▼' : '▲'}</span>`);
    }
  });
}

function exportCsv() {
  const lines = ['repo,scanned_at,score,status'];
  for (const r of sortedRows()) {
    lines.push(`${r.repo},${r.scanned_at},${r.score ?? ''},${r.status}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'codegrade-scans.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- report detail modal ----------

function openModal() {
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

async function openDetail(repo) {
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  title.textContent = repo;
  body.innerHTML = '<p class="loading">Loading report…</p>';
  openModal();

  let report = null;
  try {
    const res = await fetch(reportUrl(repo), { cache: 'no-store' });
    if (res.ok) report = await res.json();
  } catch (e) {
    report = null;
  }

  if (report) {
    body.innerHTML = renderReport(repo, report);
    return;
  }

  let logText = 'No report or log available for this scan.';
  try {
    const res = await fetch(logUrl(repo), { cache: 'no-store' });
    if (res.ok) logText = await res.text();
  } catch (e) {
    logText = 'No report or log available for this scan.';
  }
  body.innerHTML =
    '<p class="status-failed">This scan failed — the repository could not be cloned or graded.</p>' +
    '<div class="report-section"><h3>Scan log</h3>' +
    `<pre class="log-view">${escapeHtml(logText)}</pre></div>`;
}

function renderReport(repo, report) {
  const g = grade(report.score) || 'none';
  const checks = report.checks || [];
  const failing = checks.filter((c) => c.filesFailing > 0);
  const passing = checks.length - failing.length;

  const categories = (report.categories || []).map((c) =>
    `<div class="category-row">` +
    `<span>${escapeHtml(c.name)}</span>` +
    `<div class="category-bar"><div style="width:${Math.max(0, Math.min(100, c.score))}%"></div></div>` +
    `<span class="num">${c.score.toFixed(1)}</span>` +
    `</div>`).join('');

  const failingChecks = failing.map((c) => {
    const viols = (c.violations || []).slice(0, 200);
    const more = (c.violations || []).length - viols.length;
    const items = viols.map((v) =>
      `<li>${escapeHtml(v.path)}${v.line > 0 ? ':' + v.line : ''}</li>`).join('');
    const moreItem = more > 0 ? `<li>… and ${more} more</li>` : '';
    return `<details class="check-row">` +
      `<summary><span class="badge grade-F">${c.filesFailing}</span>` +
      `${escapeHtml(c.id)} — ${escapeHtml(c.description)}</summary>` +
      `<ul class="violations">${items}${moreItem}</ul>` +
      `</details>`;
  }).join('');

  const metrics = (report.metrics || []).map((m) =>
    `<div class="metric">` +
    `<span>${escapeHtml(m.description || m.id)}</span>` +
    `<span class="metric-value">${formatMetric(m.value)}</span>` +
    `</div>`).join('');

  return `
    <div class="report-summary">
      <div>
        <span class="report-score score-${g}">${report.score.toFixed(1)}</span>
        <span class="badge grade-${g}">${g === 'none' ? '—' : g}</span>
      </div>
      <div class="report-facts">
        <div class="fact"><strong>${report.files}</strong>Java files</div>
        <div class="fact"><strong>${escapeHtml(report.duration)}</strong>scan time</div>
        <div class="fact"><strong>${escapeHtml(fmtDate(report.iso8601))}</strong>scanned</div>
      </div>
      <div class="report-links">
        <a href="https://github.com/${repo}" target="_blank" rel="noopener">GitHub</a>
        <a href="${reportUrl(repo)}" target="_blank" rel="noopener">Raw JSON</a>
        <a href="${logUrl(repo)}" target="_blank" rel="noopener">Log</a>
      </div>
    </div>
    ${categories ? `<div class="report-section"><h3>Category scores</h3>${categories}</div>` : ''}
    <div class="report-section"><h3>Checks (${passing} passing, ${failing.length} failing)</h3>
      ${failingChecks || '<p class="loading">All checks passed.</p>'}
    </div>
    ${metrics ? `<div class="report-section"><h3>Metrics</h3><div class="metrics-grid">${metrics}</div></div>` : ''}
  `;
}

// ---------- wiring ----------

function init() {
  document.getElementById('search').addEventListener('input', renderTable);
  document.getElementById('status-filter').addEventListener('change', renderTable);
  document.getElementById('export').addEventListener('click', exportCsv);

  document.querySelectorAll('thead th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key === 'rank' ? 'score' : th.dataset.key;
      if (key === sortKey) {
        sortDir = -sortDir;
      } else {
        sortKey = key;
        sortDir = (key === 'repo' || key === 'status' || key === 'grade') ? 1 : -1;
      }
      renderTable();
    });
  });

  document.getElementById('leaderboard-body').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const target = e.target.closest('[data-repo]');
    if (target && target.dataset.repo) openDetail(target.dataset.repo);
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      for (const { u, el } of charts) {
        if (el.clientWidth > 0) u.setSize({ width: el.clientWidth, height: 260 });
      }
    }, 200);
  });
}

async function load() {
  try {
    const res = await fetch(RESULTS_URL, { cache: 'no-store' });
    rows = parseCsv(await res.text());
  } catch (e) {
    rows = [];
  }
  renderMeta();
  renderStats();
  renderCharts();
  renderTable();
}

init();
load();
