/*
 * Dashboard Monitoring Pemeriksaan — GitHub Pages + Google Sheets CSV
 *
 * 1) Publikasikan TAB khusus yang sudah disetujui untuk konsumsi publik sebagai CSV.
 * 2) Tempel URL CSV pada GOOGLE_SHEETS_CSV_URL di bawah ini.
 * 3) Disesuaikan dengan monitoring_pemeriksaan_disiplin.xlsx: kolom id, title,
 *    instansi_pemeriksa, inspectorate, unit, start_date, target_date, end_date,
 *    status, year, personnel_name, personnel_id, examination_type, stage,
 *    violation_level, notes.
 */
const CONFIG = {
  GOOGLE_SHEETS_CSV_URL: "",
  USE_SAMPLE_DATA_ON_ERROR: false,
  REFRESH_INTERVAL_MINUTES: 5
};

const SAMPLE_DATA = [
 {id:"PM-2026-0001",title:"Pemeriksaan dugaan pelanggaran disiplin pegawai",instansi_pemeriksa:"Inspektorat Utama",inspectorate:"Inspektorat-01",unit:"Biro-01",start_date:"2026-01-12",status:"SELESAI",personnel_name:"Personel Contoh A",examination_type:"Pelanggaran Disiplin",stage:"Pemeriksaan selesai",violation_level:"RINGAN",year:"2026"},
 {id:"PM-2026-0002",title:"Pemeriksaan dugaan pelanggaran disiplin pegawai",instansi_pemeriksa:"Inspektorat Utama",inspectorate:"Inspektorat-02",unit:"Deputi-I",start_date:"2026-02-03",status:"DALAM_PEMERIKSAAN",personnel_name:"Personel Contoh B",examination_type:"Pelanggaran Disiplin",stage:"Pengumpulan keterangan dan bukti",violation_level:"SEDANG",year:"2026"},
 {id:"PM-2026-0003",title:"Mediasi penyelesaian izin perceraian",instansi_pemeriksa:"Inspektorat Utama",inspectorate:"Inspektorat-03",unit:"Biro-02",start_date:"2026-02-20",status:"DALAM_VERIFIKASI",personnel_name:"Personel Contoh C",examination_type:"Perceraian",stage:"Verifikasi awal",violation_level:"-",year:"2026"},
 {id:"PM-2025-0004",title:"Verifikasi berkas pengunduran diri",instansi_pemeriksa:"Inspektorat Utama",inspectorate:"Inspektorat-01",unit:"Deputi-II",start_date:"2025-04-07",status:"REKOMENDASI",personnel_name:"Personel Contoh D",examination_type:"Pengunduran Diri",stage:"Penyusunan/monitoring rekomendasi",violation_level:"-",year:"2025"}
];

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let trendChartInstance = null;
let riskChartInstance = null;
const $ = id => document.getElementById(id);
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function normKey(key){return String(key ?? "").trim().toLowerCase().replace(/[\s\-./]+/g,"_");}
function pick(obj, keys, fallback=""){
  for(const key of keys){ const val=obj[normKey(key)]; if(val!==undefined && String(val).trim()!=="") return String(val).trim(); }
  return fallback;
}
function parseCSV(text){
  const rows=[]; let row=[], cell="", quoted=false;
  text=text.replace(/^\uFEFF/,"");
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c === '"'){ if(quoted && next === '"'){cell+='"';i++;} else quoted=!quoted; }
    else if(c === "," && !quoted){row.push(cell);cell="";}
    else if((c === "\n" || c === "\r") && !quoted){
      if(c==="\r" && next==="\n")i++;
      row.push(cell); if(row.some(v=>String(v).trim()!==""))rows.push(row);
      row=[];cell="";
    } else cell+=c;
  }
  if(cell.length || row.length){row.push(cell);rows.push(row);}
  if(rows.length<2)return [];
  const headers=rows.shift().map(normKey);
  return rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??"").trim()])));
}
function normalizeRow(raw,index){
  const o={}; Object.entries(raw).forEach(([k,v])=>o[normKey(k)]=v);
  const start=pick(o,["start_date","tanggal_mulai","started_at","mulai"]);
  const end=pick(o,["end_date","tanggal_selesai","completed_at","selesai_tanggal"]);
  const id=pick(o,["id","nomor_pemeriksaan","nomor","nomor_identitas","title"],String(index+1));
  const status=pick(o,["status","status_pemeriksaan","status_penanganan"],"Belum ditentukan");
  const level=pick(o,["violation_level","tingkat_pelanggaran","kategori_pelanggaran","tingkat","severity"],"");
  let year=pick(o,["year","tahun","tahun_pemeriksaan"],"");
  if(!year && start){const d=new Date(start);if(!isNaN(d))year=String(d.getFullYear());}
  const examinationType=pick(o,["examination_type","jenis_pemeriksaan","jenis"],"Tidak ditentukan");
  // Tingkat pelanggaran hanya dihitung untuk jenis Pelanggaran Disiplin.
  const normalizedLevel=/^(ringan|sedang|berat)$/i.test(level.trim()) && /pelanggaran\s+disiplin/i.test(examinationType) ? level.trim().toUpperCase() : "";
  return {
    id, title:pick(o,["title","judul","nomor_pemeriksaan","nomor"],id),
    instansi_pemeriksa:pick(o,["instansi_pemeriksa","instansi_pemeriksa"],"Inspektorat Utama"),
    inspectorate:pick(o,["inspectorate","inspektorat","inspektorat_penanganan"],"Belum diisi"),
    unit:pick(o,["unit","unit_kerja","unit_yang_diperiksa","nama_unit"],"Belum diisi"),
    start_date:start,target_date:pick(o,["target_date","tanggal_target","planned_end_date"]),
    end_date:end,status,year,
    personnel_name:pick(o,["personnel_name","nama_personel","personel_yang_diperiksa","personel","nama"],"Tidak dicantumkan"),
    personnel_id:pick(o,["personnel_id","nrp","nip","personel_id"],""),
    examination_type:examinationType,
    stage:pick(o,["stage","tahap","tahap_pemeriksaan","current_stage"],"Tidak ditentukan"),
    violation_level:normalizedLevel,
    notes:pick(o,["notes","keterangan","catatan"],"")
  };
}
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function fmtNum(n){return (Number(n)||0).toLocaleString("id-ID");}
function statusKind(status){
  const s=String(status).toLowerCase();
  if(s.includes("selesai")||s.includes("completed")||s.includes("closed")||s.includes("ditutup"))return "success";
  if(s.includes("berat")||s.includes("terlambat")||s.includes("overdue"))return "danger";
  if(s.includes("verifikasi")||s.includes("menunggu")||s.includes("pending"))return "warning";
  if(s.includes("draft")||s.includes("belum"))return "neutral";
  return "info";
}
function isVerification(r){return /verifikasi|verification/i.test(r.status);}
function isCompleted(r){return /selesai|completed|closed|ditutup/i.test(r.status);}
function isInProgress(r){return /pemeriksaan|analisis|rekomendasi|proses|berjalan/i.test(r.status) && !isCompleted(r);}
function levelKind(r,level){return String(r.violation_level).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(level);}
function uniqueCount(rows, fn){return new Set(rows.map(fn).filter(v=>v && v!=="Tidak dicantumkan" && v!=="-")).size;}
function dateForSort(value){if(!value)return null;let d=new Date(value);return isNaN(d)?null:d;}
function displayDate(value){
  if(!value)return "-";
  const d=dateForSort(value); return d?d.toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"}):value;
}
function populateSelect(id, values, defaultLabel){
  const select=$(id), current=select.value;
  select.innerHTML=`<option value="">${defaultLabel}</option>`+values.filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),"id")).map(v=>`<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join("");
  if(values.includes(current))select.value=current;
}
function setupFilters(){
  populateSelect("yearFilter",[...new Set(allRows.map(r=>r.year).filter(Boolean))],"Semua Tahun");
  populateSelect("inspectorateFilter",[...new Set(allRows.map(r=>r.inspectorate).filter(v=>v!=="Belum diisi"))],"Semua Inspektorat");
  populateSelect("unitFilter",[...new Set(allRows.map(r=>r.unit).filter(v=>v!=="Belum diisi"))],"Semua Unit Kerja");
  populateSelect("statusFilter",[...new Set(allRows.map(r=>r.status).filter(Boolean))],"Semua Status");
}
function applyFilters(){
  const year=$("yearFilter").value, inspectorate=$("inspectorateFilter").value, unit=$("unitFilter").value, status=$("statusFilter").value;
  filteredRows=allRows.filter(r=>(!year||r.year===year)&&(!inspectorate||r.inspectorate===inspectorate)&&(!unit||r.unit===unit)&&(!status||r.status===status));
  currentPage=1; renderDashboard();
}
function renderDashboard(){
  const rows=filteredRows;
  const disciplinaryRows=rows.filter(r=>/pelanggaran\s+disiplin/i.test(r.examination_type));
  const light=disciplinaryRows.filter(r=>levelKind(r,"ringan")||levelKind(r,"light")).length;
  const medium=disciplinaryRows.filter(r=>levelKind(r,"sedang")||levelKind(r,"medium")).length;
  const heavy=disciplinaryRows.filter(r=>levelKind(r,"berat")||levelKind(r,"heavy")||levelKind(r,"severe")).length;
  $("kpiTotal").textContent=fmtNum(rows.length);
  $("kpiVerification").textContent=fmtNum(rows.filter(isVerification).length);
  $("kpiInProgress").textContent=fmtNum(rows.filter(isInProgress).length);
  $("kpiCompleted").textContent=fmtNum(rows.filter(isCompleted).length);
  $("kpiPersonnel").textContent=fmtNum(uniqueCount(rows,r=>r.personnel_id||r.personnel_name));
  $("kpiExamined").textContent=fmtNum(uniqueCount(rows,r=>r.personnel_id||r.personnel_name));
  $("kpiLight").textContent=fmtNum(light);
  $("kpiMediumHeavy").textContent=fmtNum(medium+heavy);
  $("mediumHeavyNote").textContent=`Sedang: ${fmtNum(medium)} · Berat: ${fmtNum(heavy)}`;
  $("riskLight").textContent=fmtNum(light); $("riskMedium").textContent=fmtNum(medium); $("riskHeavy").textContent=fmtNum(heavy);
  $("riskTotal").textContent=fmtNum(light+medium+heavy);
  const year=$("yearFilter").value;
  $("periodLabel").textContent=year?`Tahun ${year}`:"Semua periode";
  $("footerPeriod").textContent=year?`Dashboard Monitoring · ${year}`:"Dashboard Monitoring · Semua periode";
  renderTrend(rows); renderRisk([light,medium,heavy]); renderTable();
}
function renderTrend(rows){
  const counts=new Map();
  rows.forEach(r=>{const d=dateForSort(r.start_date);if(!d)return;const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;counts.set(key,(counts.get(key)||0)+1);});
  let keys=[...counts.keys()].sort();
  if($("yearFilter").value){keys=Array.from({length:12},(_,i)=>`${$("yearFilter").value}-${String(i+1).padStart(2,"0")}`);}
  else if(keys.length>12)keys=keys.slice(-12);
  const labels=keys.map(k=>{const [y,m]=k.split("-");return `${MONTHS[Number(m)-1]} ${y}`;});
  const data=keys.map(k=>counts.get(k)||0);
  if(trendChartInstance){trendChartInstance.destroy();trendChartInstance=null;}
  $("trendChart").classList.toggle("hidden",keys.length===0);
  $("trendEmpty").classList.toggle("hidden",keys.length>0);
  if(!keys.length)return;
  trendChartInstance=new ApexCharts($("trendChart"),{chart:{type:"area",height:300,toolbar:{show:false},zoom:{enabled:false},background:"transparent",foreColor:"#9bb1c9",fontFamily:"inherit"},series:[{name:"Pemeriksaan",data}],xaxis:{categories:labels,labels:{style:{colors:"#9bb1c9"},rotate:-25},axisBorder:{color:"rgba(105,190,255,.12)"},axisTicks:{color:"rgba(105,190,255,.12)"}},yaxis:{min:0,forceNiceScale:true,labels:{style:{colors:"#9bb1c9"},formatter:v=>Math.round(v)}},colors:["#22d3ee"],stroke:{curve:"smooth",width:3},fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:.36,opacityTo:.025,stops:[0,90,100]}},markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},grid:{borderColor:"rgba(105,190,255,.12)",strokeDashArray:4},tooltip:{theme:"dark",y:{formatter:v=>`${v} pemeriksaan`}},legend:{show:false}});trendChartInstance.render();
}
function renderRisk(values){
  if(riskChartInstance){riskChartInstance.destroy();riskChartInstance=null;}
  const total=values.reduce((a,b)=>a+b,0);
  $("riskChart").classList.toggle("hidden",total===0);
  $("riskEmpty").classList.toggle("hidden",total>0);
  if(!total)return;
  riskChartInstance=new ApexCharts($("riskChart"),{chart:{type:"donut",height:280,background:"transparent",foreColor:"#9bb1c9",fontFamily:"inherit"},series:values,labels:["Ringan","Sedang","Berat"],colors:["#34d399","#fbbf24","#f87171"],stroke:{show:true,colors:["#0d1d33"],width:3},dataLabels:{enabled:false},legend:{position:"bottom",labels:{colors:"#9bb1c9"},fontSize:"12px"},plotOptions:{pie:{donut:{size:"70%",labels:{show:true,name:{show:true,color:"#9bb1c9",offsetY:18},value:{show:true,color:"#fff",fontSize:"25px",fontWeight:800,offsetY:-12,formatter:v=>Math.round(v)},total:{show:true,showAlways:true,label:"Total",color:"#9bb1c9",formatter:w=>w.globals.seriesTotals.reduce((a,b)=>a+b,0)}}}}},tooltip:{theme:"dark",y:{formatter:v=>`${v} kasus`}}});riskChartInstance.render();
}
function renderTable(){
  const q=$("searchInput").value.trim().toLowerCase();
  const rows=filteredRows.filter(r=>[r.id,r.title,r.personnel_name,r.unit,r.inspectorate,r.examination_type,r.stage,r.status].join(" ").toLowerCase().includes(q));
  const pageSize=Number($("pageSize").value)||10, pages=Math.max(1,Math.ceil(rows.length/pageSize));
  currentPage=Math.min(currentPage,pages);
  const pageRows=rows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  $("tableCount").textContent=`${fmtNum(rows.length)} data`;
  $("pageLabel").textContent=`Halaman ${currentPage} dari ${pages}`;
  $("prevPage").disabled=currentPage<=1; $("nextPage").disabled=currentPage>=pages;
  $("dataTable").innerHTML=pageRows.length?pageRows.map((r,i)=>`<tr>
    <td>${(currentPage-1)*pageSize+i+1}</td><td><strong>${escapeHTML(r.title||r.id)}</strong></td>
    <td>${escapeHTML(r.personnel_name)}${r.personnel_id?`<div class="small muted">ID: ${escapeHTML(r.personnel_id)}</div>`:""}</td>
    <td>${escapeHTML(r.unit)}</td><td>${escapeHTML(r.examination_type)}</td><td>${escapeHTML(r.stage)}</td>
    <td><span class="status-badge status-${statusKind(r.status)}">${escapeHTML(r.status)}</span></td><td>${escapeHTML(displayDate(r.start_date))}</td>
  </tr>`).join(""):`<tr><td colspan="8"><div class="empty-state"><strong>Belum ada data pemeriksaan</strong><div class="small">Tidak ada data yang sesuai dengan filter atau kata pencarian.</div></div></td></tr>`;
}
async function loadData(){
  $("connectionStatus").textContent="MEMUAT DATA";
  if(CONFIG.GOOGLE_SHEETS_CSV_URL.trim()){
    try{
      const url=CONFIG.GOOGLE_SHEETS_CSV_URL.trim();
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const csv=await response.text();
      const raw=parseCSV(csv);
      if(!raw.length)throw new Error("CSV kosong atau header tidak terbaca");
      allRows=raw.map(normalizeRow);
      $("connectionStatus").textContent="GOOGLE SHEETS TERHUBUNG";
      $("dataMessage").textContent=`Data berhasil dimuat dari Google Sheets: ${fmtNum(allRows.length)} baris.`;
    }catch(error){
      console.error(error);
      if(!CONFIG.USE_SAMPLE_DATA_ON_ERROR){allRows=[];$("connectionStatus").textContent="GAGAL MEMUAT DATA";$("dataMessage").textContent="Data tidak dapat dimuat. Periksa URL CSV, akses publikasi, dan pastikan tab Data_Pemeriksaan dipublikasikan sebagai CSV.";}
      else{allRows=SAMPLE_DATA.map(normalizeRow);$("connectionStatus").textContent="MODE CONTOH";$("dataMessage").textContent="Google Sheets gagal dimuat; dashboard menggunakan data contoh. Periksa URL CSV dan pastikan tab telah dipublikasikan sebagai CSV.";}
    }
  }else{
    allRows=SAMPLE_DATA.map(normalizeRow);
    $("connectionStatus").textContent="MODE CONTOH";
    $("dataMessage").textContent="URL CSV Google Sheets belum diatur. Publikasikan tab Data_Pemeriksaan sebagai CSV, lalu tempel URL-nya di konfigurasi app.js.";
  }
  setupFilters();filteredRows=[...allRows];renderDashboard();
  $("lastUpdated").textContent=`Pembaruan: ${new Date().toLocaleString("id-ID")}`;
}
document.addEventListener("DOMContentLoaded",()=>{
  $("applyFilters").addEventListener("click",applyFilters);
  ["yearFilter","inspectorateFilter","unitFilter","statusFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
  $("resetFilters").addEventListener("click",()=>{["yearFilter","inspectorateFilter","unitFilter","statusFilter"].forEach(id=>$(id).value="");$("searchInput").value="";currentPage=1;applyFilters();});
  $("searchInput").addEventListener("input",()=>{currentPage=1;renderTable();});
  $("pageSize").addEventListener("change",()=>{currentPage=1;renderTable();});
  $("prevPage").addEventListener("click",()=>{if(currentPage>1){currentPage--;renderTable();}});
  $("nextPage").addEventListener("click",()=>{currentPage++;renderTable();});
  loadData();
  if(CONFIG.REFRESH_INTERVAL_MINUTES>0)setInterval(loadData,CONFIG.REFRESH_INTERVAL_MINUTES*60000);
});
