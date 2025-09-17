// popup.js
const STORAGE_KEY = 'activityData';
window.addEventListener("load", render);
document.getElementById("rangeSelect").addEventListener("change", render);

document.addEventListener('DOMContentLoaded', () => {
  const rangeSelect = document.getElementById('rangeSelect');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');

  rangeSelect.addEventListener('change', render);
  exportBtn.addEventListener('click', exportData);
  clearBtn.addEventListener('click', clearData);

  render();
});

async function fetchStorage() {
  const res = await chrome.storage.local.get([STORAGE_KEY]);
  return res[STORAGE_KEY] || {};
}

function isoToDate(iso) {
  return new Date(iso + 'T00:00:00');
}

function getRangeDates(range) {
  const today = new Date();
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // midnight
  const dates = [];
  if (range === 'today') {
    dates.push(day0.toISOString().slice(0,10));
  } else if (range === 'week') {
    // last 7 days including today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(day0);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0,10));
    }
  } else if (range === 'month') {
    const start = new Date(day0);
    start.setDate(1);
    const days = (new Date(day0.getFullYear(), day0.getMonth()+1, 0)).getDate();
    for (let i=0;i<days;i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0,10));
    }
  }
  return dates;
}

function aggregateForRange(data, range) {
  const dates = getRangeDates(range);
  const agg = {}; // domain -> ms
  for (const dateKey of dates) {
    const dayObj = data[dateKey];
    if (!dayObj) continue;
    for (const [domain, ms] of Object.entries(dayObj)) {
      agg[domain] = (agg[domain] || 0) + ms;
    }
  }
  return agg;
}

function msToHuman(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  if (s || parts.length === 0) parts.push(s + 's');
  return parts.join(' ');
}

async function render() {
  const data = await fetchStorage();
  const range = document.getElementById('rangeSelect').value;
  const tbody = document.getElementById('topBody');
  const agg = aggregateForRange(data, range);

  const entries = Object.entries(agg).sort((a,b) => b[1]-a[1]);
//   const topList = document.getElementById('topList');
    tbody.innerHTML = '';
  if (entries.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.textContent = 'No data for this range.';
    td.style.padding = '8px';
    tr.appendChild(td);
    tbody.appendChild(tr);
    // topList.textContent = 'No data for this range.';
    tbody.appendChild('');
  } else {
    const topN = Math.min(10, entries.length);

    
    for (let i = 0; i < topN; i++) {
      const [domain, ms] = entries[i];

        const tr = document.createElement('tr');
        const tdSite = document.createElement('td');
        tdSite.textContent = `${i + 1}. ${domain}`;
        tdSite.style.padding = '6px';
        tdSite.style.borderBottom = '1px solid #333';

        const tdHours = document.createElement('td');
        tdHours.textContent = msToHuman(ms);
        tdHours.style.padding = '6px';
        tdHours.style.borderBottom = '1px solid #333';
        tdHours.style.textAlign = 'right';   // aligns under “Hours”

        tr.appendChild(tdSite);
        tr.appendChild(tdHours);
        tbody.appendChild(tr);
    }    
  }

  // Draw simple bar chart on canvas
  drawBarChart(entries.slice(0,8));

  // Raw data
  const rawData = document.getElementById('rawData');
  rawData.innerHTML = '';
  const dateKeys = Object.keys(data).sort((a,b)=>b.localeCompare(a)); // newest first
  if (dateKeys.length === 0) {
    rawData.textContent = 'No stored data.';
  } else {
    for (const d of dateKeys.slice(0,20)) {
      const day = document.createElement('div');
      const items = Object.entries(data[d]).sort((a,b)=>b[1]-a[1]).slice(0,5);
      const itemsStr = items.map(it => `${it[0]}: ${msToHuman(it[1])}`).join(' | ');
      day.textContent = `${d} → ${itemsStr}`;
      rawData.appendChild(day);
    }
  }
}

function drawBarChart(entries) {
  const canvas = document.getElementById('barCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!entries || entries.length === 0) {
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('No chart data', 10, 30);
    return;
  }

  // Sort descending
  entries = entries.sort((a, b) => b[1] - a[1]);

  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const max = Math.max(...values);

  const padding = 50;
  const chartW = canvas.width - padding * 2;
  const chartH = canvas.height - padding * 2;

  const barWidth = chartW / values.length * 0.6;
  const gap = chartW / values.length * 0.4;

  // Axes
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + chartH);
  ctx.lineTo(padding + chartW, padding + chartH);
  ctx.stroke();

  for (let i = 0; i < values.length; i++) {
    const barX = padding + i * (barWidth + gap) + gap / 2;
    const barHeight = max === 0 ? 0 : (values[i] / max) * (chartH - 20);
    const barY = padding + chartH - barHeight;

    // 🔹 Bar
    ctx.fillStyle = '#1976d2';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // 🔹 Duration above bar (center aligned with bar)
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(msToHuman(values[i]), barX + barWidth / 2, barY - 6);

    // 🔹 Website label (truncate >13 chars)
    let label = labels[i];
    if (label.length > 13) {
      label = label.slice(0, 13) + '...';
    }

    // Place centered under bar
    ctx.save();
    ctx.translate(barX + barWidth / 2, padding + chartH + 15);
    ctx.rotate(-Math.PI / 6); // tilt 30° if needed
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center'; // ✅ keep centered with bar
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}







async function exportData() {
  const storage = await chrome.storage.local.get([STORAGE_KEY]);
  const data = storage[STORAGE_KEY] || {};
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearData() {
  if (!confirm('Clear all locally stored activity data? This cannot be undone.')) return;
  await chrome.storage.local.remove([STORAGE_KEY]);
  render();
}
