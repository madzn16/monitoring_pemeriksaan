
/*
 * SIMPEL — Executive Monitoring Dashboard
 * Sumber data: data.csv dari Google Sheets/GitHub Pages.
 *
 * Kolom yang disarankan:
 * id, title, inspectorate, unit, start_date, target_date, end_date,
 * status, year, personnel_name, personnel_id, examination_type,
 * stage, violation_level, notes.
 */
const CONFIG = {
  DATA_CSV_URL: "./data.csv",
  USE_SAMPLE_DATA_ON_ERROR: true,
  REFRESH_INTERVAL_MINUTES: 5,

  // Ambang awal early warning, sesuaikan dengan kebijakan/SLA resmi.
  WARNING_DAYS_BEFORE_TARGET: 7,
  WARNING_LONG_RUNNING_DAYS: 30
};

const SAMPLE_DATA = [
  {id:"SIM-2026-001",title:"SIM-2026-001",inspectorate:"Inspektorat I",unit:"Biro Umum",start_date:"2026-01-12",target_date:"2026-03-15",end_date:"2026-02-25",status:"SELESAI",personnel_name:"Personel Contoh A",examination_type:"Pelanggaran Disiplin",stage:"Selesai",violation_level:"Ringan",year:"2026"},
  {id:"SIM-2026-002",title:"SIM-2026-002",inspectorate:"Inspektorat II",unit:"Biro Keuangan",start_date:"2026-09-01",target_date:"2026-10-15",status:"DALAM PEMERIKSAAN",personnel_name:"Personel Contoh B",examination_type:"Pelanggaran Disiplin",stage:"Pemeriksaan",violation_level:"Sedang",year:"2026"},
  {id:"SIM-2026-003",title:"SIM-2026-003",inspectorate:"Inspektorat III",unit:"Biro Logistik",start_date:"2026-10-01",target_date:"2026-10-25",status:"DALAM VERIFIKASI",personnel_name:"Personel Contoh C",examination_type:"Perceraian",stage:"Verifikasi",violation_level:"",year:"2026"},
  {id:"SIM-2026-004",title:"SIM-2026-004",inspectorate:"Inspektorat I",unit:"Biro Umum",start_date:"2026-08-05",target_date:"2026-09-15",end_date:"2026-09-10",status:"SELESAI",personnel_name:"Personel Contoh D",examination_type:"Pengunduran Diri",stage:"Selesai",violation_level:"",year:"2026"},
  {id:"SIM-2026-005",title:"SIM-2026-005",inspectorate:"Inspektorat II",unit:"Biro SDM",start_date:"2026-09-20",target_date:"2026-10-22",status:"DALAM PEMERIKSAAN",personnel_name:"Personel Contoh E",examination_type:"Pelanggaran Disiplin",stage:"Analisis",violation_level:"Berat",year:"2026"},
  {id:"SIM-2026-006",title:"SIM-2026-006",inspectorate:"Inspektorat III",unit:"Biro Keuangan",start_date:"2026-07-01",target_date:"2026-08-15",status:"DALAM PEMERIKSAAN",personnel_name:"Personel Contoh F",examination_type:"Perceraian",stage:"Analisis",violation_level:"",year:"2026"},
  {id:"SIM-2026-007",title:"SIM-2026-007",inspectorate:"Inspektorat I",unit:"Biro SDM",start_date:"2026-10-10",target_date:"2026-10-28",status:"DALAM VERIFIKASI",personnel_name:"Personel Contoh G",examination_type:"Pelanggaran Disiplin",stage:"Verifikasi",violation_level:"Ringan",year:"2026"},
  {id:"SIM-2025-008",title:"SIM-2025-008",inspectorate:"Inspektorat II",unit:"Biro Logistik",start_date:"2025-04-07",target_date:"2025-06-01",end_date:"2025-05-25",status:"SELESAI",personnel_name:"Personel Contoh H",examination_type:"Pengunduran Diri",stage:"Selesai",violation_level:"",year:"2025"}
];

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let trendChartInstance = null;
let riskChartInstance = null;
let typeChartInstance = null;

const $ = id => document.getElementById(id);
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const TYPE_NAMES = ["Pelanggaran Disiplin", "Perceraian", "Pengunduran Diri"];

function normKey(key) {
  return String(key ?? "").trim().toLowerCase().replace(/[\s\-./]+/g, "_");
}

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    const val = obj[normKey(key)];
    if (val !== undefined && String(val).trim() !== "") return String(val).trim();
  }
  return fallback;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];

    if (c === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if ((c === ";" || c === ",") && !quoted) {
      // CSV utama memakai titik koma; koma didukung sebagai fallback.
      if (c === ";" || !text.includes(";")) {
        row.push(cell); cell = "";
      } else {
        cell += c;
      }
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = []; cell = "";
    } else {
      cell += c;
    }
  }

  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows.shift().map(normKey);
  return rows.map(cells =>
    Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]))
  );
}

function normalizeType(value) {
  const s = String(value || "").toLowerCase().trim();

  if (s.includes("disiplin")) return "Pelanggaran Disiplin";
  if (s.includes("perceraian") || s.includes("cerai")) return "Perceraian";
  if (s.includes("pengunduran") || s.includes("mengundurkan diri")) return "Pengunduran Diri";

  // Jangan mengategorikan jenis lain secara otomatis sebagai pelanggaran disiplin.
  return value || "Tidak ditentukan";
}

function normalizeDateValue(value) {
  if (!value) return "";

  const s = String(value).trim();
  // Menangani format yyyy-mm-dd dan yyyy-mm-ddTHH:mm:ss.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  }

  // Menangani format dd/mm/yyyy atau dd-mm-yyyy.
  const local = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (local) {
    return `${local[3]}-${String(local[2]).padStart(2, "0")}-${String(local[1]).padStart(2, "0")}`;
  }

  return s;
}

function normalizeRow(raw, index) {
  const o = {};
  Object.entries(raw).forEach(([k, v]) => o[normKey(k)] = v);

  const start = normalizeDateValue(pick(o, ["start_date", "tanggal_mulai", "started_at", "mulai"]));
  const end = normalizeDateValue(pick(o, ["end_date", "tanggal_selesai", "completed_at", "selesai_tanggal"]));
  const target = normalizeDateValue(pick(o, ["target_date", "tanggal_target", "planned_end_date", "batas_waktu"]));
  const id = pick(o, ["id", "nomor_pemeriksaan", "nomor", "title"], String(index + 1));

  let year = pick(o, ["year", "tahun", "tahun_pemeriksaan"], "");
  if (!year && start) year = start.slice(0, 4);

  return {
    id,
    title: pick(o, ["title", "judul", "nomor_pemeriksaan", "nomor"], id),
    inspectorate: pick(o, ["inspectorate", "inspektorat", "inspektorat_penanganan", "instansi_pemeriksa"], "Belum diisi"),
    unit: pick(o, ["unit", "unit_kerja", "unit_yang_diperiksa", "nama_unit"], "Belum diisi"),
    start_date: start,
    target_date: target,
    end_date: end,
    status: pick(o, ["status", "status_pemeriksaan", "status_penanganan"], "Belum ditentukan"),
    year,
    personnel_name: pick(o, ["personnel_name", "nama_personel", "personel_yang_diperiksa", "personel", "nama"], "Tidak dicantumkan"),
    personnel_id: pick(o, ["personnel_id", "nrp", "nip", "personel_id"], ""),
    examination_type: normalizeType(pick(o, ["examination_type", "jenis_pemeriksaan", "jenis"], "Tidak ditentukan")),
    stage: pick(o, ["stage", "tahap", "tahap_pemeriksaan", "current_stage"], "Tidak ditentukan"),
    violation_level: pick(o, ["violation_level", "tingkat_pelanggaran", "kategori_pelanggaran", "tingkat", "severity"], ""),
    notes: pick(o, ["notes", "keterangan", "catatan"], "")
  };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString("id-ID");
}

function dateForSort(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start, end) {
  const a = dateForSort(start), b = dateForSort(end);
  if (!a || !b) return null;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function daysFromStart(row) {
  if (!row.start_date) return null;
  return daysBetween(row.start_date, row.end_date || todayISO());
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "-";
  const d = dateForSort(value);
  return d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : value;
}

function statusKind(status) {
  const s = String(status).toLowerCase();
  if (isCompletedStatus(s)) return "success";
  if (s.includes("terlambat") || s.includes("overdue")) return "danger";
  if (s.includes("verifikasi") || s.includes("menunggu") || s.includes("pending")) return "warning";
  if (s.includes("draft") || s.includes("belum")) return "neutral";
  return "info";
}

function isCompletedStatus(value) {
  return /selesai|completed|closed|ditutup/i.test(String(value));
}

function isCompleted(row) {
  return isCompletedStatus(row.status) || Boolean(row.end_date);
}

function isVerification(row) {
  return /verifikasi|verification/i.test(row.status);
}

function isInProgress(row) {
  return !isCompleted(row) &&
    /pemeriksaan|analisis|rekomendasi|proses|berjalan|verifikasi|menunggu/i.test(row.status);
}

function uniqueCount(rows, fn) {
  return new Set(rows.map(fn).filter(v =>
    v && v !== "Tidak dicantumkan" && v !== "-"
  )).size;
}

function levelKind(row, level) {
  return String(row.violation_level).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(level);
}

function populateSelect(id, values, defaultLabel) {
  const select = $(id);
  const current = select.value;
  select.innerHTML = `<option value="">${defaultLabel}</option>` +
    values.filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "id"))
      .map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`)
      .join("");

  if (values.includes(current)) select.value = current;
}

function setupFilters() {
  populateSelect("yearFilter", [...new Set(allRows.map(r => r.year).filter(Boolean))], "Semua Tahun");
  populateSelect("inspectorateFilter", [...new Set(allRows.map(r => r.inspectorate).filter(v => v !== "Belum diisi"))], "Semua Inspektorat");
  populateSelect("unitFilter", [...new Set(allRows.map(r => r.unit).filter(v => v !== "Belum diisi"))], "Semua Unit Kerja");
  populateSelect("statusFilter", [...new Set(allRows.map(r => r.status).filter(Boolean))], "Semua Status");
}

function applyFilters() {
  const year = $("yearFilter").value;
  const inspectorate = $("inspectorateFilter").value;
  const unit = $("unitFilter").value;
  const status = $("statusFilter").value;

  filteredRows = allRows.filter(r =>
    (!year || r.year === year) &&
    (!inspectorate || r.inspectorate === inspectorate) &&
    (!unit || r.unit === unit) &&
    (!status || r.status === status)
  );

  currentPage = 1;
  renderDashboard();
}

function renderDashboard() {
  const rows = filteredRows;
  const light = rows.filter(r => r.examination_type === "Pelanggaran Disiplin" && levelKind(r, "ringan")).length;
  const medium = rows.filter(r => r.examination_type === "Pelanggaran Disiplin" && (levelKind(r, "sedang") || levelKind(r, "medium"))).length;
  const heavy = rows.filter(r => r.examination_type === "Pelanggaran Disiplin" && (levelKind(r, "berat") || levelKind(r, "heavy") || levelKind(r, "severe"))).length;

  const warnings = getWarnings(rows);

  $("kpiTotal").textContent = fmtNum(rows.length);
  $("kpiVerification").textContent = fmtNum(rows.filter(isVerification).length);
  $("kpiInProgress").textContent = fmtNum(rows.filter(r => !isCompleted(r) && (isInProgress(r) || isVerification(r))).length);
  $("kpiCompleted").textContent = fmtNum(rows.filter(isCompleted).length);
  $("kpiPersonnel").textContent = fmtNum(uniqueCount(rows, r => r.personnel_id || r.personnel_name));
  $("kpiLight").textContent = fmtNum(light);
  $("kpiMediumHeavy").textContent = fmtNum(medium + heavy);
  $("mediumHeavyNote").textContent = `Sedang: ${fmtNum(medium)} · Berat: ${fmtNum(heavy)}`;
  $("kpiAttention").textContent = fmtNum(warnings.length);

  $("periodLabel").textContent = $("yearFilter").value ? `Tahun ${$("yearFilter").value}` : "Semua periode";
  $("warningPeriodLabel").textContent = $("periodLabel").textContent;
  $("footerPeriod").textContent = `Dashboard Monitoring · ${$("periodLabel").textContent}`;

  renderWarnings(rows);
  renderPerformance(rows);
  renderTrend(rows);
  renderRisk([light, medium, heavy]);
  renderTypeTrend(rows);
  renderTable();
}

function getWarnings(rows) {
  const today = todayISO();

  return rows.map(row => {
    const age = daysFromStart(row);
    const remaining = row.target_date ? daysBetween(today, row.target_date) : null;
    const overdueDays = row.target_date && !isCompleted(row)
      ? daysBetween(row.target_date, today)
      : null;

    let warning = "";
    let severity = "";

    if (!isCompleted(row) && row.target_date && row.target_date < today) {
      warning = `Terlambat ${overdueDays} hari`;
      severity = "danger";
    } else if (!isCompleted(row) && remaining !== null && remaining <= CONFIG.WARNING_DAYS_BEFORE_TARGET) {
      warning = `Tenggat ${remaining} hari lagi`;
      severity = "warning";
    } else if (!isCompleted(row) && age !== null && age > CONFIG.WARNING_LONG_RUNNING_DAYS) {
      warning = `Berjalan ${age} hari`;
      severity = "info";
    }

    return { ...row, age, remaining, overdueDays, warning, severity };
  }).filter(row => row.warning)
    .sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity] ||
        (b.age || 0) - (a.age || 0);
    });
}

function renderWarnings(rows) {
  const warnings = getWarnings(rows);
  const overdue = warnings.filter(r => r.severity === "danger").length;
  const dueSoon = warnings.filter(r => r.severity === "warning").length;
  const longRunning = warnings.filter(r => r.severity === "info").length;

  $("warningOverdue").textContent = fmtNum(overdue);
  $("warningDueSoon").textContent = fmtNum(dueSoon);
  $("warningLongRunning").textContent = fmtNum(longRunning);

  $("warningTable").innerHTML = warnings.length
    ? warnings.map(r => `
      <tr>
        <td><strong>${escapeHTML(r.title || r.id)}</strong>
          <div class="small muted">${escapeHTML(r.examination_type)}</div>
        </td>
        <td>${escapeHTML(r.inspectorate)}
          <div class="small muted">${escapeHTML(r.unit)}</div>
        </td>
        <td><span class="status-badge status-${statusKind(r.status)}">${escapeHTML(r.status)}</span></td>
        <td>${r.age === null ? "-" : `${fmtNum(r.age)} hari`}</td>
        <td>${displayDate(r.target_date)}</td>
        <td><span class="alert-badge alert-${r.severity}">${escapeHTML(r.warning)}</span></td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">
        <strong>Tidak ada peringatan berdasarkan data saat ini.</strong>
        <div class="small">Pastikan tanggal mulai dan tanggal target telah diisi dengan benar.</div>
      </div></td></tr>`;

  $("warningNote").textContent =
    `Ambang: tenggat dalam ${CONFIG.WARNING_DAYS_BEFORE_TARGET} hari dan lama penanganan lebih dari ${CONFIG.WARNING_LONG_RUNNING_DAYS} hari. ` +
    `Peringatan tidak menggantikan evaluasi substantif pimpinan.`;
}

function renderPerformance(rows) {
  const groups = new Map();

  rows.forEach(row => {
    const name = row.inspectorate || "Belum diisi";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  });

  const stats = [...groups.entries()].map(([name, items]) => {
    const total = items.length;
    const completed = items.filter(isCompleted).length;
    const open = total - completed;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    const durations = items
      .filter(r => isCompleted(r) && r.start_date && r.end_date)
      .map(r => daysBetween(r.start_date, r.end_date))
      .filter(n => n !== null);

    const averageDays = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    return { name, total, completed, open, rate, averageDays, durationCount: durations.length };
  }).sort((a, b) => b.total - a.total);

  $("performanceTable").innerHTML = stats.length
    ? stats.map(s => `
      <tr>
        <td><strong>${escapeHTML(s.name)}</strong></td>
        <td>${fmtNum(s.total)}</td>
        <td><strong>${fmtNum(s.completed)}</strong></td>
        <td class="performance-cell">
          ${s.rate}%
          <div class="performance-bar"><span style="width:${s.rate}%"></span></div>
        </td>
        <td>${s.averageDays === null ? "Belum cukup data" : `${fmtNum(s.averageDays)} hari`}
          <div class="small muted">${s.durationCount ? `${s.durationCount} kasus dengan tanggal lengkap` : "Tanggal mulai/selesai belum lengkap"}</div>
        </td>
        <td>${fmtNum(s.open)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">Belum ada data kinerja inspektorat.</div></td></tr>`;
}

function chartBase() {
  return {
    chart: {
      height: 300,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      foreColor: "#9bb1c9",
      fontFamily: "inherit"
    },
    grid: { borderColor: "rgba(105,190,255,.12)", strokeDashArray: 4 },
    tooltip: { theme: "dark" },
    dataLabels: { enabled: false },
    legend: { labels: { colors: "#9bb1c9" } },
    xaxis: {
      labels: { style: { colors: "#9bb1c9" } },
      axisBorder: { color: "rgba(105,190,255,.12)" },
      axisTicks: { color: "rgba(105,190,255,.12)" }
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: { style: { colors: "#9bb1c9" }, formatter: v => Math.round(v) }
    }
  };
}

function monthKeysForRows(rows) {
  const selectedYear = $("yearFilter").value;
  if (selectedYear) {
    return Array.from({ length: 12 }, (_, i) =>
      `${selectedYear}-${String(i + 1).padStart(2, "0")}`
    );
  }

  const keys = [...new Set(rows.map(r => {
    const d = dateForSort(r.start_date);
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "";
  }).filter(Boolean))].sort();

  return keys.slice(-12);
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function renderTrend(rows) {
  const keys = monthKeysForRows(rows);
  const counts = new Map(keys.map(k => [k, 0]));

  rows.forEach(r => {
    const d = dateForSort(r.start_date);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null; }
  $("trendChart").classList.toggle("hidden", !keys.length);
  $("trendEmpty").classList.toggle("hidden", keys.length > 0);
  if (!keys.length) return;

  const options = {
    ...chartBase(),
    chart: { ...chartBase().chart, type: "area" },
    series: [{ name: "Pemeriksaan", data: keys.map(k => counts.get(k) || 0) }],
    xaxis: { ...chartBase().xaxis, categories: keys.map(monthLabel), labels: { style: { colors: "#9bb1c9" }, rotate: -25 } },
    colors: ["#22d3ee"],
    stroke: { curve: "smooth", width: 3 },
    fill: { type: "gradient", gradient: { opacityFrom: .35, opacityTo: .03, stops: [0, 90, 100] } },
    markers: { size: 3 },
    tooltip: { theme: "dark", y: { formatter: v => `${v} kasus` } }
  };

  trendChartInstance = new ApexCharts($("trendChart"), options);
  trendChartInstance.render();
}

function renderRisk(values) {
  if (riskChartInstance) { riskChartInstance.destroy(); riskChartInstance = null; }

  const total = values.reduce((a, b) => a + b, 0);
  $("riskChart").classList.toggle("hidden", total === 0);
  $("riskEmpty").classList.toggle("hidden", total > 0);
  $("riskTotal").textContent = fmtNum(total);
  if (!total) return;

  riskChartInstance = new ApexCharts($("riskChart"), {
    chart: { type: "donut", height: 280, background: "transparent", foreColor: "#9bb1c9", fontFamily: "inherit" },
    series: values,
    labels: ["Ringan", "Sedang", "Berat"],
    colors: ["#34d399", "#fbbf24", "#f87171"],
    stroke: { show: true, colors: ["#0d1d33"], width: 3 },
    dataLabels: { enabled: false },
    legend: { position: "bottom", labels: { colors: "#9bb1c9" } },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            name: { show: true, color: "#9bb1c9" },
            value: { show: true, color: "#fff", fontSize: "24px", formatter: v => Math.round(v) },
            total: { show: true, label: "Total", color: "#9bb1c9", formatter: w => w.globals.seriesTotals.reduce((a, b) => a + b, 0) }
          }
        }
      }
    },
    tooltip: { theme: "dark", y: { formatter: v => `${v} kasus` } }
  });

  riskChartInstance.render();
}

function renderTypeTrend(rows) {
  const keys = monthKeysForRows(rows);
  const colors = ["#22d3ee", "#a78bfa", "#f59e0b"];

  if (typeChartInstance) { typeChartInstance.destroy(); typeChartInstance = null; }

  $("typeComparisonLabel").textContent = $("unitFilter").value || "Semua unit kerja";

  const validRows = rows.filter(r => TYPE_NAMES.includes(r.examination_type) && r.start_date);
  $("typeComparisonChart").classList.toggle("hidden", validRows.length === 0 || keys.length === 0);
  $("typeComparisonEmpty").classList.toggle("hidden", validRows.length > 0 && keys.length > 0);
  if (!validRows.length || !keys.length) return;

  const series = TYPE_NAMES.map(type => {
    const counts = new Map(keys.map(k => [k, 0]));
    validRows.filter(r => r.examination_type === type).forEach(r => {
      const d = dateForSort(r.start_date);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    });
    return { name: type, data: keys.map(k => counts.get(k) || 0) };
  });

  const options = {
    ...chartBase(),
    chart: { ...chartBase().chart, type: "line", height: 340 },
    series,
    colors,
    stroke: { curve: "smooth", width: 3 },
    markers: { size: 4, hover: { size: 6 } },
    xaxis: { ...chartBase().xaxis, categories: keys.map(monthLabel), labels: { style: { colors: "#9bb1c9" }, rotate: -25 } },
    legend: { position: "top", labels: { colors: "#9bb1c9" } },
    tooltip: { theme: "dark", y: { formatter: v => `${v} kasus` } }
  };

  typeChartInstance = new ApexCharts($("typeComparisonChart"), options);
  typeChartInstance.render();
}

function renderTable() {
  const q = $("searchInput").value.trim().toLowerCase();
  const rows = filteredRows.filter(r =>
    [r.id, r.title, r.personnel_name, r.personnel_id, r.unit, r.inspectorate, r.examination_type, r.stage, r.status]
      .join(" ").toLowerCase().includes(q)
  );

  const pageSize = Number($("pageSize").value) || 10;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  $("tableCount").textContent = `${fmtNum(rows.length)} data`;
  $("pageLabel").textContent = `Halaman ${currentPage} dari ${pages}`;
  $("prevPage").disabled = currentPage <= 1;
  $("nextPage").disabled = currentPage >= pages;

  $("dataTable").innerHTML = pageRows.length ? pageRows.map((r, i) => `
    <tr>
      <td>${(currentPage - 1) * pageSize + i + 1}</td>
      <td><strong>${escapeHTML(r.title || r.id)}</strong></td>
      <td>${escapeHTML(r.personnel_name)}
        ${r.personnel_id ? `<div class="small muted">ID: ${escapeHTML(r.personnel_id)}</div>` : ""}
      </td>
      <td>${escapeHTML(r.unit)}</td>
      <td>${escapeHTML(r.examination_type)}</td>
      <td>${escapeHTML(r.stage)}</td>
      <td><span class="status-badge status-${statusKind(r.status)}">${escapeHTML(r.status)}</span></td>
      <td>${escapeHTML(displayDate(r.start_date))}</td>
    </tr>
  `).join("") : `
    <tr><td colspan="8"><div class="empty-state">
      <strong>Belum ada data pemeriksaan</strong>
      <div class="small">Tidak ada data yang sesuai dengan filter atau pencarian.</div>
    </div></td></tr>`;
}

async function loadData() {
  $("connectionStatus").textContent = "MEMUAT DATA";

  try {
    const response = await fetch(`${CONFIG.DATA_CSV_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csv = await response.text();
    const raw = parseCSV(csv);
    if (!raw.length) throw new Error("CSV kosong atau header tidak terbaca");

    allRows = raw.map(normalizeRow);
    $("connectionStatus").textContent = "DATA TERBARU TERSEDIA";
    $("dataMessage").textContent =
      `Data berhasil dimuat: ${fmtNum(allRows.length)} baris. Data dibaca dari data.csv.`;
  } catch (error) {
    console.error("Gagal memuat data.csv:", error);

    if (!CONFIG.USE_SAMPLE_DATA_ON_ERROR) {
      allRows = [];
      $("connectionStatus").textContent = "GAGAL MEMUAT DATA";
      $("dataMessage").textContent =
        "Data tidak dapat dimuat. Periksa ketersediaan data.csv dan format kolomnya.";
    } else {
      allRows = SAMPLE_DATA.map(normalizeRow);
      $("connectionStatus").textContent = "MODE CONTOH";
      $("dataMessage").textContent =
        "data.csv belum dapat dimuat. Dashboard menampilkan data contoh, bukan data aktual.";
    }
  }

  setupFilters();
  filteredRows = [...allRows];
  renderDashboard();
  $("lastUpdated").textContent = `Pembaruan halaman: ${new Date().toLocaleString("id-ID")}`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("applyFilters").addEventListener("click", applyFilters);

  ["yearFilter", "inspectorateFilter", "unitFilter", "statusFilter"].forEach(id =>
    $(id).addEventListener("change", applyFilters)
  );

  $("resetFilters").addEventListener("click", () => {
    ["yearFilter", "inspectorateFilter", "unitFilter", "statusFilter"].forEach(id => $(id).value = "");
    $("searchInput").value = "";
    currentPage = 1;
    applyFilters();
  });

  $("searchInput").addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });

  $("pageSize").addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  $("prevPage").addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  });

  $("nextPage").addEventListener("click", () => {
    currentPage++;
    renderTable();
  });

  loadData();

  if (CONFIG.REFRESH_INTERVAL_MINUTES > 0) {
    setInterval(loadData, CONFIG.REFRESH_INTERVAL_MINUTES * 60000);
  }
});
