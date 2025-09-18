// popup.js
const STORAGE_KEY = "activityData";
// document.addEventListener("DOMContentLoaded", ()>render());
// window.addEventListener("load", render);
// document.getElementById("rangeSelect").addEventListener("change", render);
document.addEventListener("DOMContentLoaded", async () => {
  const rangeSelect = document.getElementById("rangeSelect");

  rangeSelect.value = "today";
  await render();

  // ✅ Call donut + table renderer too
  // If you want from chrome.storage:
  const storageData = await fetchStorage();
  renderChartAndTable(storageData);
  rangeSelect.addEventListener("change", render);
});

document.addEventListener("DOMContentLoaded", () => {
  const rangeSelect = document.getElementById("rangeSelect");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");

  rangeSelect.addEventListener("change", render);
  exportBtn.addEventListener("click", exportData);
  clearBtn.addEventListener("click", clearData);

  render();
});

async function fetchStorage() {
  const res = await chrome.storage.local.get([STORAGE_KEY]);
  return res[STORAGE_KEY] || {};
}

function isoToDate(iso) {
  return new Date(iso + "T00:00:00");
}

function getRangeDates(range) {
  const now = new Date();
  const today = new Date().toISOString().slice(0, 10);
  const dates = [];
  if (range === "today") {
    dates.push(today);
  } else if (range === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
  } else if (range === "month") {
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const daysInMonth = new Date(year, month - 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      dates.push(d.toISOString().slice(0, 10));
    }
    console.log("month", dates);
  }
  return dates;
}

function aggregateForRange(data, range) {
  const dates = getRangeDates(range);
  console.log("range11", dates);
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
  if (h) parts.push(h + "h");
  if (m) parts.push(m + "m");
  if (s || parts.length === 0) parts.push(s + "s");
  return parts.join(" ");
}


let currentPage = 0;   // 🔹 track page
const pageSize = 10;   // 🔹 10 rows per page
let entries = [];      // 🔹 store all entries globally

async function render() {
  const data = await fetchStorage();
  const range = document.getElementById("rangeSelect").value;
  const tbody = document.getElementById("topBody");
  const agg = aggregateForRange(data, range);

  // 🔹 store entries for pagination
  entries = Object.entries(agg).sort((a, b) => b[1] - a[1]);
  currentPage = 0; // reset to first page
  renderTable();
  renderRawData(data);
  drawBarChart(entries.slice(0, 8)); // still keep top 8 for chart
}

function renderTable() {
  const tbody = document.getElementById("topBody");
  tbody.innerHTML = "";

  if (entries.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "No data for this range.";
    td.style.padding = "8px";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // 🔹 slice entries for current page
  const start = currentPage * pageSize;
  const paginated = entries.slice(start, start + pageSize);

  paginated.forEach(([domain, ms], i) => {
    const tr = document.createElement("tr");

    const tdSite = document.createElement("td");
    tdSite.textContent = `${start + i + 1}. ${domain}`;
    tdSite.style.padding = "6px";
    tdSite.style.borderBottom = "1px solid #333";

    const tdHours = document.createElement("td");
    tdHours.textContent = msToHuman(ms);
    tdHours.style.padding = "6px";
    tdHours.style.borderBottom = "1px solid #333";
    tdHours.style.textAlign = "right";

    tr.appendChild(tdSite);
    tr.appendChild(tdHours);
    tbody.appendChild(tr);
  
    
  });
}

function renderRawData(data) {
  const rawData = document.getElementById("rawData");
  rawData.innerHTML = "";
  const dateKeys = Object.keys(data).sort((a, b) => b.localeCompare(a));
  if (dateKeys.length === 0) {
    rawData.textContent = "No stored data.";
    return;
  }
  for (const d of dateKeys.slice(0, 20)) {
    const day = document.createElement("div");
    const items = Object.entries(data[d])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const itemsStr = items
      .map((it) => `${it[0]}: ${msToHuman(it[1])}`)
      .join(" | ");
    day.textContent = `${d} → ${itemsStr}`;
    rawData.appendChild(day);
  }
}

// 🔹 Pagination buttons
document.querySelector("#summary button:nth-of-type(1)").addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    renderTable();
  }
});

document.querySelector("#summary button:nth-of-type(2)").addEventListener("click", () => {
  if ((currentPage + 1) * pageSize < entries.length) {
    currentPage++;
    renderTable();
  }
});


function drawBarChart(entries) {
  const canvas = document.getElementById("barCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!entries || entries.length === 0) {
    ctx.fillStyle = "#666";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No Data Available", canvas.width / 2, canvas.height / 2);
    return;
  }

  // Sort descending
  entries = entries.sort((a, b) => b[1] - a[1]);

  const labels = entries.map((e) => e[0]);
  const values = entries.map((e) => e[1]);
  const max = Math.max(...values);

  const padding = 60; // more padding
  const bottomSpace = 50; // extra space for labels
  const topSpace = 40; // extra space for hours
  const chartW = canvas.width - padding * 2;
  const chartH = canvas.height - padding - bottomSpace - topSpace;

  const barWidth = (chartW / values.length) * 0.5;
  const gap = (chartW / values.length) * 0.5;

  // Axes
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + chartH);
  ctx.lineTo(padding + chartW, padding + chartH);
  ctx.stroke();

  for (let i = 0; i < values.length; i++) {
    const barX = padding + i * (barWidth + gap) + gap / 2;
    const barHeight = max === 0 ? 0 : (values[i] / max) * chartH;
    const barY = padding + chartH - barHeight;

    // 🔹 Bar
    ctx.fillStyle = "#1976d2";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 🔹 Hours above bar (large, padded)
    const text = msToHuman(values[i]);
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 12;
    const boxPadding = 3;

    const textX = barX + barWidth / 2;
    const textY = barY - 14;

    ctx.fillStyle = "rgba(255,255,255,0.9)"; // white bg
    ctx.fillRect(
      textX - textWidth / 2 - boxPadding,
      textY - textHeight / 2 - boxPadding,
      textWidth + boxPadding * 2,
      textHeight + boxPadding * 2
    );

    ctx.fillStyle = "#000";
    ctx.fillText(text, textX, textY);

    // 🔹 Website label (small, tilted)
    let label = labels[i];
    if (label.length > 13) {
      label = label.slice(0, 13) + "...";
    }

    ctx.save();
    ctx.translate(barX + barWidth / 2, padding + chartH + 20); // place below
    ctx.rotate(-Math.PI / 4); // 30° tilt
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#000";
    ctx.textAlign = "right";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

async function exportData() {
  const storage = await chrome.storage.local.get([STORAGE_KEY]);
  const data = storage[STORAGE_KEY] || {};
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearData() {
  if (
    !confirm("Clear all locally stored activity data? This cannot be undone.")
  )
    return;
  await chrome.storage.local.remove([STORAGE_KEY]);
  drawBarChart([]);
  render();
}

function renderChartAndTable(data) {
  console.log("data", data);
  const dateKeys = Object.keys(data).sort((a, b) => b.localeCompare(a));
  if (dateKeys.length === 0) {
    document.getElementById("todayStats").textContent = "No stored data.";
    return;
  }

  // Take latest day
  const latestDay = dateKeys[0];
  const items = Object.entries(data[latestDay])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const sites = items.map((it) => it[0].slice(0, 16) + "...");
  const hours = items.map((it) => parseFloat((it[1] / 3600000).toFixed(2)));

  const total = hours.reduce((a, b) => a + b, 0);

  // ✅ Donut Chart
  const ctx = document.getElementById("todayDonut").getContext("2d");
  if (window.todayChart) window.todayChart.destroy();
  window.todayChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sites,
      datasets: [
        {
          data: hours,
          backgroundColor: [
            "#ff0000",
            "#4285f4",
            "#6e5494",
            "#34a853",
            "#fbbc05",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true, // <-- important
      maintainAspectRatio: false,
      layout: {
      padding: 20   // ✅ adds 20px padding on all sides
    },
      plugins: {
        legend: {
          position: "right",
          labels: {
            padding: 20, // space between legend and chart
          },
        },
      },
      cutout: "60%",
    },
  });
}
