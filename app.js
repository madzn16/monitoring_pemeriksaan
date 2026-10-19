/*
 * DASHBOARD MONITORING PEMERIKSAAN
 * Sumber: Google Sheets yang dipublikasikan sebagai CSV.
 *
 * Keamanan: data yang dipublikasikan dapat diakses publik. Gunakan hanya data
 * agregat/anonim yang memang diizinkan untuk dibuka. Jangan simpan rahasia,
 * kredensial, atau data personel sensitif di spreadsheet publik.
 */
const CONFIG = {
  // Ganti dengan URL CSV Google Sheets Anda setelah mengikuti README.md.
  // Contoh: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
  GOOGLE_SHEETS_CSV_URL: "",
  // Data contoh digunakan selama URL CSV masih kosong atau gagal diambil.
  USE_SAMPLE_DATA_ON_ERROR: true,
  INITIAL_ROWS: 8
};

const SAMPLE_DATA = [
  {id:"PM-2026-001",title:"Pemeriksaan kepatuhan administrasi",inspectorate:"Inspektorat I",unit:"Unit A",start_date:"2026-01-12",target_date:"2026-02-20",end_date:"2026-02-18",status:"SELESAI",year:"2026"},
  {id:"PM-2026-002",title:"Pemeriksaan tindak lanjut rekomendasi",inspectorate:"Inspektorat II",unit:"Unit B",start_date:"2026-01-25",target_date:"2026-03-15",end_date:"",status:"DALAM PEMERIKSAAN",year:"2026"},
  {id:"PM-2026-003",title:"Pemeriksaan tata kelola aset",inspectorate:"Inspektorat III",unit:"Unit C",start_date:"2026-02-03",target_date:"2026-03-10",end_date:"",status:"TERLAMBAT",year:"2026"},
  {id:"PM-2026-004",title:"Pemeriksaan proses administrasi",inspectorate:"Inspektorat I",unit:"Unit B",start_date:"2026-02-14",target_date:"2026-04-05",end_date:"2026-04-02",status:"SELESAI",year:"2026"},
  {id:"PM-2026-005",title:"Pemeriksaan pemenuhan prosedur",inspectorate:"Inspektorat II",unit:"Unit D",start_date:"2026-03-08",target_date:"2026-05-10",end_date:"",status:"DALAM ANALISIS",year:"2026"},
  {id:"PM-2026-006",title:"Pemeriksaan administrasi umum",inspectorate:"Inspektorat I",unit:"Unit A",start_date:"2026-04-11",target_date:"2026-06-15",end_date:"",status:"DALAM PEMERIKSAAN",year:"2026"},
  {id:"PM-2025-001",title:"Pemeriksaan pengelolaan dokumen",inspectorate:"Inspektorat III",unit:"Unit C",start_date:"2025-01-17",target_date:"2025-03-15",end_date:"2025-03-11",status:"SELESAI",year:"2025"},
  {id:"PM-2025-002",title:"Pemeriksaan pelaksanaan prosedur",inspectorate:"Inspektorat II",unit:"Unit A",start_date:"2025-04-02",target_date:"2025-05-20",end_date:"2025-05-27",status:"SELESAI",year:"2025"},
  {id:"PM-2025-003",title:"Pemeriksaan administrasi pendukung",inspectorate:"Inspektorat I",unit:"Unit D",start_date:"2025-06-09",target_date:"2025-08-15",end_date:"",status:"DALAM PEMERIKSAAN",year:"2025"},
  {id:"PM-2025-004",title:"Pemeriksaan pengendalian internal",inspectorate:"Inspektorat III",unit:"Unit B",start_date:"2025-09-12",target_date:"2025-11-10",end_date:"2025-11-04",status:"SELESAI",year:"2025"},
  {id:"PM-2024-001",title:"Pemeriksaan tata kelola umum",inspectorate:"Inspektorat I",unit:"Unit C",start_date:"2024-02-05",target_date:"2024-04-15",end_date:"2024-04-12",status:"SELESAI",year:"2024"},
  {id:"PM-2024-002",title:"Pemeriksaan tindak lanjut",inspectorate:"Inspektorat II",unit:"Unit D",start_date:"2024-07-19",target_date:"2024-09-15",end_date:"2024-09-25",status:"SELESAI",year:"2024"}
];

let allRows = [];
let filteredRows = [];
let visibleLimit = CONFIG.INITIAL_ROWS;
let charts = {};
let usingSampleData = true;

const $ = (id) => document.getElementById(id);
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  // ISO date yyyy-mm-dd, or common dd/mm/yyyy
  let d;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s.slice(0,10) + "T00:00:00");
  else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
    const [a,b,c] = s.split(/[/-]/).map(Number);
    d = new Date(c, b - 1, a);
  } else d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateText(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "—";
}
function normalizeStatus(value) {
  const s = String(value || "").trim().toUpperCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
  if (["SELESAI","DITUTUP","COMPLETED","CLOSED"].includes(s)) return "SELESAI";
  if (["TERLAMBAT","LEWAT TARGET","OVERDUE"].includes(s)) return "TERLAMBAT";
  if (["DALAM VERIFIKASI","MENUNGGU VERIFIKASI","DALAM ANALISIS","MENUNGGU KETERANGAN","MENUNGGU PERSETUJUAN","DILAPORKAN","REKOMENDASI"].includes(s)) return s;
  if (["DRAFT","BELUM DIMULAI"].includes(s)) return s;
  if (s) return s;
  return "TIDAK DIKETAHUI";
}
function isCompleted(row) {
  return ["SELESAI","DITUTUP","COMPLETED","CLOSED"].includes(normalizeStatus(row.status));
}
function isOverdue(row) {
  const target = parseDate(row.target_date);
  if (!target || isCompleted(row)) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return target < today || normalizeStatus(row.status) === "TERLAMBAT";
}
function toYear(row) {
  if (row.year && /^\d{4}$/.test(String(row.year).trim())) return String(row.year).trim();
  const d = parseDate(row.start_date);
  return d ? String(d.getFullYear()) : "";
}
function normalizeRow(raw) {
  const row = {};
  Object.keys(raw).forEach(k => row[String(k).trim().toLowerCase().replace(/[\s/-]+/g,"_")] = raw[k]);
  const get = (...keys) => {
    for (const key of keys) if (row[key] !== undefined && String(row[key]).trim() !== "") return String(row[key]).trim();
    return "";
  };
  const result = {
    id:get("id","nomor","nomor_pemeriksaan","no_pemeriksaan"),
    title:get("title","judul","nama_pemeriksaan","perihal") || "Pemeriksaan tanpa judul",
    inspectorate:get("inspectorate","inspektorat","inspektorat_penanganan") || "Belum diisi",
    unit:get("unit","unit_kerja","unit_yang_diperiksa","unit_kerja_yang_diperiksa") || "Belum diisi",
    start_date:get("start_date","tanggal_mulai","tanggal_pemeriksaan","tanggal_mulai_pemeriksaan"),
    target_date:get("target_date","target_selesai","tanggal_target","tanggal_rencana_selesai","planned_end_date"),
    end_date:get("end_date","tanggal_selesai","realisasi_selesai","actual_end_date"),
    status:normalizeStatus(get("status","status_pemeriksaan","tahap_pemeriksaan")),
    year:get("year","tahun")
  };
  if (!result.id) result.id = "DATA-" + Math.random().toString(36).slice(2,8).toUpperCase();
  result.year = toYear(result);
  return result;
}

// CSV parser supporting quoted fields, commas and line breaks inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i=0;i<text.length;i++) {
    const c = text[i], next = text[i+1];
    if (c === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); if (row.some(v => String(v).trim() !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.replace(/^\uFEFF/,"").trim());
  return rows.map(values => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = values[i] ?? "");
    return obj;
  });
}
async function loadData() {
  setConnection("Memuat sumber data...");
  if (!CONFIG.GOOGLE_SHEETS_CSV_URL) {
    allRows = SAMPLE_DATA.map(normalizeRow);
    usingSampleData = true;
    setConnection("Menggunakan data contoh");
    $("tableMessage").textContent = "Data contoh aktif. Ikuti README.md untuk menghubungkan Google Sheets.";
    initializeFilters(); applyFilters(); return;
  }
  try {
    const url = CONFIG.GOOGLE_SHEETS_CSV_URL + (CONFIG.GOOGLE_SHEETS_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();
    const response = await fetch(url, {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const csv = await response.text();
    const parsed = parseCSV(csv);
    if (parsed.length === 0) throw new Error("CSV kosong atau header tidak ditemukan");
    allRows = parsed.map(normalizeRow);
    usingSampleData = false;
    setConnection("Google Sheets terhubung");
    $("tableMessage").textContent = "Data dimuat dari Google Sheets. Pastikan spreadsheet hanya berisi informasi yang boleh dipublikasikan.";
  } catch (err) {
    console.error("Gagal mengambil CSV Google Sheets:", err);
    if (CONFIG.USE_SAMPLE_DATA_ON_ERROR) {
      allRows = SAMPLE_DATA.map(normalizeRow);
      usingSampleData = true;
      setConnection("Fallback data contoh");
      $("tableMessage").textContent = "Google Sheets tidak dapat diakses; data contoh ditampilkan. Periksa URL publikasi dan format CSV.";
    } else {
      allRows = [];
      setConnection("Gagal memuat data");
      $("tableMessage").textContent = "Sumber data gagal dimuat. Periksa URL dan koneksi.";
    }
  }
  initializeFilters(); applyFilters();
}
function setConnection(text) { $("connectionStatus").textContent = text; }
function uniqueSorted(values) { return [...new Set(values.filter(v => v && v !== "Belum diisi"))].sort((a,b)=>a.localeCompare(b,"id")); }
function fillSelect(id, values, defaultLabel) {
  const el = $(id), previous = el.value;
  el.innerHTML = "";
  const all = document.createElement("option"); all.value = "all"; all.textContent = defaultLabel; el.appendChild(all);
  values.forEach(v => { const o=document.createElement("option");o.value=v;o.textContent=v;el.appendChild(o); });
  if ([...el.options].some(o=>o.value===previous)) el.value=previous;
}
function initializeFilters() {
  fillSelect("yearFilter", uniqueSorted(allRows.map(r=>r.year)).sort((a,b)=>b.localeCompare(a)), "Semua tahun");
  fillSelect("inspectorateFilter", uniqueSorted(allRows.map(r=>r.inspectorate)), "Semua inspektorat");
  fillSelect("unitFilter", uniqueSorted(allRows.map(r=>r.unit)), "Semua unit kerja");
}
function applyFilters() {
  const year=$("yearFilter").value, insp=$("inspectorateFilter").value, unit=$("unitFilter").value;
  filteredRows=allRows.filter(r=>(year==="all"||r.year===year)&&(insp==="all"||r.inspectorate===insp)&&(unit==="all"||r.unit===unit));
  const q=$("searchInput").value.trim().toLowerCase();
  const searched=filteredRows.filter(r=>[r.id,r.title,r.inspectorate,r.unit,r.status].join(" ").toLowerCase().includes(q));
  visibleLimit=CONFIG.INITIAL_ROWS;
  renderKPIs(filteredRows); renderCharts(filteredRows); renderTable(searched);
}
function renderKPIs(rows) {
  const total=rows.length, completed=rows.filter(isCompleted).length, overdue=rows.filter(isOverdue).length;
  $("kpiTotal").textContent=fmt(total);
  $("kpiCompleted").textContent=fmt(completed);
  $("kpiOverdue").textContent=fmt(overdue);
  $("kpiProgress").textContent=fmt(total-completed);
  const rate=total?Math.round(completed/total*100):0;
  $("completionRate").textContent=rate+"%";
  $("completionBar").style.width=rate+"%";
  const durations=rows.filter(r=>isCompleted(r)&&parseDate(r.start_date)&&parseDate(r.end_date)).map(r=>Math.max(0,Math.round((parseDate(r.end_date)-parseDate(r.start_date))/86400000)));
  $("averageDuration").textContent=durations.length ? (durations.reduce((a,b)=>a+b,0)/durations.length).toFixed(1).replace(".",",")+" hari" : "—";
  const counts=countBy(rows,r=>r.inspectorate);
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  $("topInspectorate").textContent=top?top[0]+" ("+top[1]+")":"—";
}
function fmt(n) { return new Intl.NumberFormat("id-ID").format(n); }
function countBy(rows, fn) { return rows.reduce((acc,r)=>{const k=fn(r)||"Tidak diketahui";acc[k]=(acc[k]||0)+1;return acc;},{}); }
function commonChartOptions() {
  return {chart:{toolbar:{show:false},fontFamily:"Inter, sans-serif",foreColor:"#93a3c2",animations:{enabled:true,speed:450}},grid:{borderColor:"rgba(157,178,220,.12)",strokeDashArray:4},dataLabels:{enabled:false},legend:{labels:{colors:"#b7c5df"},fontSize:"11px"},tooltip:{theme:"dark"}};
}
function renderCharts(rows) {
  if (typeof ApexCharts === "undefined") {
    ["trendChart","statusChart","unitChart"].forEach(id=>$(id).innerHTML='<div class="empty-state">Library grafik tidak tersedia. Periksa koneksi CDN ApexCharts.</div>');
    return;
  }
  const monthCounts=Array(12).fill(0);
  rows.forEach(r=>{const d=parseDate(r.start_date);if(d)monthCounts[d.getMonth()]++;});
  const statusCounts=countBy(rows,r=>normalizeStatus(r.status));
  const unitCounts=countBy(rows,r=>r.unit);
  const units=Object.entries(unitCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const common=commonChartOptions();
  const configs = {
    trendChart:{
      ...common,chart:{...common.chart,type:"area",height:260},
      series:[{name:"Pemeriksaan",data:monthCounts}],
      colors:["#60a5fa"],stroke:{curve:"smooth",width:3},
      fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:.32,opacityTo:.02,stops:[0,90,100]}},
      xaxis:{categories:MONTHS,axisBorder:{show:false},axisTicks:{show:false}},
      yaxis:{min:0,forceNiceScale:true,labels:{formatter:v=>Math.round(v)}},
      markers:{size:3,strokeWidth:0,hover:{size:5}}
    },
    statusChart:{
      ...common,chart:{...common.chart,type:"donut",height:260},
      series:Object.values(statusCounts),labels:Object.keys(statusCounts),
      colors:["#34d399","#60a5fa","#fbbf24","#a78bfa","#fb7185","#38bdf8","#94a3b8","#f97316"],
      stroke:{width:2,colors:["#111a2d"]},
      legend:{...common.legend,position:"bottom"},
      plotOptions:{pie:{donut:{size:"68%",labels:{show:true,total:{show:true,label:"Total",color:"#93a3c2",formatter:w=>fmt(w.globals.seriesTotals.reduce((a,b)=>a+b,0))},value:{show:true,color:"#eef4ff"}}}}},
      responsive:[{breakpoint:500,options:{legend:{fontSize:"9px"}}}]
    },
    unitChart:{
      ...common,chart:{...common.chart,type:"bar",height:260},
      series:[{name:"Pemeriksaan",data:units.map(x=>x[1])}],
      colors:["#8b5cf6"],plotOptions:{bar:{borderRadius:5,columnWidth:"45%",distributed:true}},
      xaxis:{categories:units.map(x=>x[0]),labels:{rotate:-25,trim:true},axisBorder:{show:false},axisTicks:{show:false}},
      yaxis:{min:0,forceNiceScale:true,labels:{formatter:v=>Math.round(v)}},
      legend:{show:false}
    }
  };
  Object.entries(configs).forEach(([id,config])=>{
    if(charts[id]) charts[id].destroy();
    charts[id]=new ApexCharts($(id),config); charts[id].render();
  });
}
function statusClass(row) {
  const status=normalizeStatus(row.status);
  if(isOverdue(row)) return "status-overdue";
  if(isCompleted(row)) return "status-completed";
  if(["DALAM VERIFIKASI","MENUNGGU VERIFIKASI","MENUNGGU KETERANGAN","DILAPORKAN","DRAFT"].includes(status)) return "status-review";
  if(["DALAM PEMERIKSAAN","DALAM ANALISIS","REKOMENDASI"].includes(status)) return "status-progress";
  return "status-other";
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function renderTable(rows) {
  $("rowCount").textContent=fmt(rows.length)+" data";
  const visible=rows.slice(0,visibleLimit);
  if(!visible.length) {
    $("tableBody").innerHTML='<tr><td colspan="7" class="empty-state">Tidak ada data yang sesuai dengan filter.</td></tr>';
    $("showAllBtn").style.display="none"; return;
  }
  $("tableBody").innerHTML=visible.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td><div class="record-title"><strong>${escapeHTML(r.id)}</strong><span title="${escapeHTML(r.title)}">${escapeHTML(r.title)}</span></div></td>
    <td>${escapeHTML(r.inspectorate)}</td><td>${escapeHTML(r.unit)}</td>
    <td>${dateText(r.start_date)}</td><td>${dateText(r.target_date)}</td>
    <td><span class="status-pill ${statusClass(r)}">${escapeHTML(normalizeStatus(r.status))}</span></td>
  </tr>`).join("");
  $("showAllBtn").style.display=rows.length>visibleLimit?"inline":"none";
  $("showAllBtn").textContent=rows.length>visibleLimit?"Tampilkan semua hasil →":"Menampilkan semua hasil";
}
function resetFilters() {
  ["yearFilter","inspectorateFilter","unitFilter"].forEach(id=>$(id).value="all");
  $("searchInput").value="";
  applyFilters();
}
document.addEventListener("DOMContentLoaded",()=>{
  ["yearFilter","inspectorateFilter","unitFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
  $("searchInput").addEventListener("input",applyFilters);
  $("resetBtn").addEventListener("click",resetFilters);
  $("refreshBtn").addEventListener("click",loadData);
  $("showAllBtn").addEventListener("click",()=>{
    const q=$("searchInput").value.trim().toLowerCase();
    const rows=filteredRows.filter(r=>[r.id,r.title,r.inspectorate,r.unit,r.status].join(" ").toLowerCase().includes(q));
    visibleLimit=visibleLimit>=rows.length?CONFIG.INITIAL_ROWS:rows.length;
    renderTable(rows);
  });
  loadData();
});
