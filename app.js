/*
 * Dashboard Monitoring Pemeriksaan — GitHub Pages + Google Sheets CSV
 *
 * 1) Publikasikan TAB khusus yang sudah disetujui untuk konsumsi publik sebagai CSV.
 * 2) Tempel URL CSV pada GOOGLE_SHEETS_CSV_URL di bawah ini.
 * 3) Kolom minimum: id, title, inspectorate, unit, start_date, target_date,
 *    end_date, status, year, personnel_name, examination_type, stage,
 *    violation_level. Lihat README untuk arti kolom dan contoh.
 */
const CONFIG = {
  // Dashboard mengambil CSV lokal dari GitHub Pages agar tidak terkena CORS Google Sheets.
  // GitHub Actions memperbarui data.csv secara berkala dari Google Sheets.
  DATA_CSV_URL: "./data.csv",
  USE_SAMPLE_DATA_ON_ERROR: true,
  REFRESH_INTERVAL_MINUTES: 5
};

const SAMPLE_DATA = [
 {id:"SIM-2026-001",title:"SIM-2026-001",inspectorate:"Inspektorat I",unit:"Biro Umum",start_date:"2026-01-12",status:"SELESAI",personnel_name:"Personel Contoh A",examination_type:"Pelanggaran Disiplin",stage:"Rekomendasi",violation_level:"Ringan",year:"2026"},
 {id:"SIM-2026-002",title:"SIM-2026-002",inspectorate:"Inspektorat II",unit:"Biro Keuangan",start_date:"2026-02-03",status:"DALAM PEMERIKSAAN",personnel_name:"Personel Contoh B",examination_type:"Perceraian",stage:"Pemeriksaan",violation_level:"Sedang",year:"2026"},
 {id:"SIM-2026-003",title:"SIM-2026-003",inspectorate:"Inspektorat III",unit:"Biro Logistik",start_date:"2026-02-20",status:"DALAM VERIFIKASI",personnel_name:"Personel Contoh C",examination_type:"Perceraian",stage:"Verifikasi",violation_level:"Berat",year:"2026"},
 {id:"SIM-2025-004",title:"SIM-2025-004",inspectorate:"Inspektorat I",unit:"Biro Umum",start_date:"2025-04-07",status:"SELESAI",personnel_name:"Personel Contoh D",examination_type:"Pelanggaran Disiplin",stage:"Selesai",violation_level:"Ringan",year:"2025"},
 {id:"SIM-2025-005",title:"SIM-2025-005",inspectorate:"Inspektorat II",unit:"Biro Keuangan",start_date:"2025-06-15",status:"DALAM PEMERIKSAAN",personnel_name:"Personel Contoh E",examination_type:"Pengunduran Diri",stage:"Analisis",violation_level:"Sedang",year:"2025"},
 {id:"SIM-2024-006",title:"SIM-2024-006",inspectorate:"Inspektorat III",unit:"Biro Logistik",start_date:"2024-08-21",status:"SELESAI",personnel_name:"Personel Contoh F",examination_type:"Pengunduran Diri",stage:"Selesai",violation_level:"Berat",year:"2024"},
 {id:"SIM-2026-007",title:"SIM-2026-007",inspectorate:"Inspektorat I",unit:"Biro SDM",start_date:"2026-03-18",status:"DALAM VERIFIKASI",personnel_name:"Personel Contoh G",examination_type:"Pelanggaran Disiplin",stage:"Verifikasi",violation_level:"Ringan",year:"2026"},
 {id:"SIM-2026-008",title:"SIM-2026-008",inspectorate:"Inspektorat II",unit:"Biro SDM",start_date:"2026-05-09",status:"SELESAI",personnel_name:"Personel Contoh H",examination_type:"Pelanggaran Disiplin",stage:"Selesai",violation_level:"Sedang",year:"2026"}
];

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let trendChartInstance = null;
let riskChartInstance = null;
let typeComparisonChartInstance = null;
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
  return {
    id, title:pick(o,["title","judul","nomor_pemeriksaan","nomor"],id),
    inspectorate:pick(o,["inspectorate","inspektorat","inspektorat_penanganan"],"Belum diisi"),
    unit:pick(o,["unit","unit_kerja","unit_yang_diperiksa","nama_unit"],"Belum diisi"),
    start_date:start,target_date:pick(o,["target_date","tanggal_target","planned_end_date"]),
    end_date:end,status,year,
    personnel_name:pick(o,["personnel_name","nama_personel","personel_yang_diperiksa","personel","nama"],"Tidak dicantumkan"),
    personnel_id:pick(o,["personnel_id","nrp","nip","personel_id"],""),
    examination_type:pick(o,["examination_type","jenis_pemeriksaan","jenis"],"Tidak ditentukan"),
    stage:pick(o,["stage","tahap","tahap_pemeriksaan","current_stage"],"Tidak ditentukan"),
    violation_level:level,
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
  const light=rows.filter(r=>levelKind(r,"ringan")||levelKind(r,"light")).length;
  const medium=rows.filter(r=>levelKind(r,"sedang")||levelKind(r,"medium")).length;
  const heavy=rows.filter(r=>levelKind(r,"berat")||levelKind(r,"heavy")||levelKind(r,"severe")).length;
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
  renderTrend(rows); renderRisk([light,medium,heavy]); renderTypeComparison(rows); renderTable();
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
  trendChartInstance=new ApexCharts($("trendChart"),{chart:{type:"area",height:300,toolbar:{show:false},zoom:{enabled:false},background:"transparent",foreColor:"#9bb1c9",fontFamily:"inherit"},series:[{name:"Pemeriksaan",data}],xaxis:{categories:labels,labels:{style:{colors:"#9bb1c9"},rotate:-25},axisBorder:{color:"rgba(105,190,255,.12)"},axisTicks:{color:"rgba(105,190,255,.12)"}},yaxis:{min:0,forceNiceScale:true,labels:{style:{colors:"#c9dced",fontSize:"14px"},formatter:v=>Math.round(v)}},colors:["#22d3ee"],stroke:{curve:"smooth",width:3},fill:{type:"gradient",gradient:{shadeIntensity:1,opacityFrom:.36,opacityTo:.025,stops:[0,90,100]}},markers:{size:4,strokeWidth:0},dataLabels:{enabled:false},grid:{borderColor:"rgba(105,190,255,.12)",strokeDashArray:4},tooltip:{theme:"dark",y:{formatter:v=>`${v} pemeriksaan`}},legend:{show:false}});trendChartInstance.render();
}
function renderRisk(values){
  if(riskChartInstance){riskChartInstance.destroy();riskChartInstance=null;}
  const total=values.reduce((a,b)=>a+b,0);
  $("riskChart").classList.toggle("hidden",total===0);
  $("riskEmpty").classList.toggle("hidden",total>0);
  if(!total)return;
  riskChartInstance=new ApexCharts($("riskChart"),{chart:{type:"donut",height:280,background:"transparent",foreColor:"#9bb1c9",fontFamily:"inherit"},series:values,labels:["Ringan","Sedang","Berat"],colors:["#34d399","#fbbf24","#f87171"],stroke:{show:true,colors:["#0d1d33"],width:3},dataLabels:{enabled:false},legend:{position:"bottom",labels:{colors:"#dcecff"},fontSize:"15px"},plotOptions:{pie:{donut:{size:"70%",labels:{show:true,name:{show:true,color:"#9bb1c9",offsetY:18},value:{show:true,color:"#fff",fontSize:"25px",fontWeight:800,offsetY:-12,formatter:v=>Math.round(v)},total:{show:true,showAlways:true,label:"Total",color:"#9bb1c9",formatter:w=>w.globals.seriesTotals.reduce((a,b)=>a+b,0)}}}}},tooltip:{theme:"dark",y:{formatter:v=>`${v} kasus`}}});riskChartInstance.render();
}
function canonicalExaminationType(value){
  const v=String(value||"").trim().toLocaleLowerCase("id-ID").replace(/\s+/g," ");
  if(v.includes("disiplin")) return "Pelanggaran Disiplin";
  if(v.includes("perceraian")) return "Perceraian";
  if(v.includes("pengunduran diri") || v.includes("mengundurkan diri")) return "Pengunduran Diri";
  return null;
}
function renderTypeComparison(rows){
  const types=["Pelanggaran Disiplin","Perceraian","Pengunduran Diri"];
  const unitFilter=$("unitFilter").value;
  const grouped=new Map();
  rows.forEach(r=>{
    const type=canonicalExaminationType(r.examination_type);
    if(!type) return;
    const unit=r.unit||"Belum diisi";
    if(!grouped.has(unit)) grouped.set(unit,{"Pelanggaran Disiplin":0,"Perceraian":0,"Pengunduran Diri":0});
    grouped.get(unit)[type]++;
  });
  let units=[...grouped.keys()].sort((a,b)=>a.localeCompare(b,"id"));
  // Saat unit tertentu dipilih, tampilkan unit tersebut saja; selain itu bandingkan semua unit.
  if(unitFilter) units=units.filter(u=>u===unitFilter);
  const series=types.map(type=>({name:type,data:units.map(unit=>grouped.get(unit)?.[type]||0)}));
  const total=series.reduce((sum,serie)=>sum+serie.data.reduce((a,b)=>a+b,0),0);
  $("typeComparisonLabel").textContent=unitFilter?`Unit: ${unitFilter}`:"Semua unit kerja";
  if(typeComparisonChartInstance){typeComparisonChartInstance.destroy();typeComparisonChartInstance=null;}
  $("typeComparisonChart").classList.toggle("hidden",total===0);
  $("typeComparisonEmpty").classList.toggle("hidden",total>0);
  if(total===0) return;
  typeComparisonChartInstance=new ApexCharts($("typeComparisonChart"),{
    chart:{type:"bar",height:Math.max(360,units.length*62+110),toolbar:{show:true},background:"transparent",foreColor:"#c9dced",fontFamily:"inherit"},
    series,
    colors:["#22d3ee","#a78bfa","#fb7185"],
    plotOptions:{bar:{horizontal:true,borderRadius:5,barHeight:"58%",dataLabels:{position:"top"}}},
    dataLabels:{enabled:true,style:{colors:["#ffffff"],fontSize:"14px",fontWeight:700},formatter:v=>v===0?"":v,offsetX:5},
    xaxis:{categories:units,min:0,forceNiceScale:true,labels:{style:{colors:"#c9dced",fontSize:"14px"},formatter:v=>Math.round(v)},axisBorder:{color:"rgba(105,190,255,.12)"},axisTicks:{color:"rgba(105,190,255,.12)"}},
    yaxis:{labels:{style:{colors:"#eaf4ff",fontSize:"14px",fontWeight:600},maxWidth:260}},
    grid:{borderColor:"rgba(105,190,255,.12)",strokeDashArray:4},
    legend:{position:"bottom",labels:{colors:"#dcecff"},fontSize:"15px"},
    tooltip:{theme:"dark",shared:true,intersect:false,y:{formatter:v=>`${v} pemeriksaan`}},
    noData:{text:"Data tidak tersedia",style:{color:"#9bb1c9"}}
  });
  typeComparisonChartInstance.render();
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
  try{
    const response=await fetch(`${CONFIG.DATA_CSV_URL}?t=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const csv=await response.text();
    const raw=parseCSV(csv);
    if(!raw.length)throw new Error("CSV kosong atau header tidak terbaca");
    allRows=raw.map(normalizeRow);
    $("connectionStatus").textContent="DATA TERBARU TERSEDIA";
    $("dataMessage").textContent=`Data berhasil dimuat: ${fmtNum(allRows.length)} baris. Data disinkronkan dari Google Sheets melalui GitHub Actions.`;
  }catch(error){
    console.error("Gagal memuat data.csv:",error);
    if(!CONFIG.USE_SAMPLE_DATA_ON_ERROR){
      allRows=[];
      $("connectionStatus").textContent="GAGAL MEMUAT DATA";
      $("dataMessage").textContent="Data tidak dapat dimuat. Periksa apakah data.csv tersedia di repository GitHub Pages.";
    }else{
      allRows=SAMPLE_DATA.map(normalizeRow);
      $("connectionStatus").textContent="MODE CONTOH";
      $("dataMessage").textContent="File data.csv belum dapat dimuat; dashboard menggunakan data contoh. Pastikan file data.csv tersedia di repository.";
    }
  }
  setupFilters();filteredRows=[...allRows];renderDashboard();
  $("lastUpdated").textContent=`Pembaruan halaman: ${new Date().toLocaleString("id-ID")}`;
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
