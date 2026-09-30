const KEY="plc-performance-hub-v6";
const LEGACY_KEYS=["plc-performance-hub-v2","plc-performance-hub-v1"];
let legacy={};
for(const k of LEGACY_KEYS){try{const v=JSON.parse(localStorage.getItem(k)||"null");if(v&&Object.keys(v).length){legacy=v;break}}catch(e){}}
const state=JSON.parse(localStorage.getItem(KEY)||"null")||legacy||{};
const SESSION_KEY="plc-performance-hub-session-v1";
const session=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");
const $=id=>document.getElementById(id);
const lifts=["squat","bench","deadlift"];
const LIFTER_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/lifter";
const LIFTER_SEARCH_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/lifter-search";
const REFERENCE_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/performance-reference";
const HUB_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/hub";
const GOOGLE_CLIENT_ID="565019863889-dlbtmah64pd38piet2fc27p3251cjpeq.apps.googleusercontent.com";
let performanceReference=null;
let upcomingCompetitions=[];
let suppressCloud=false;
let competitionScope="nearby";
const LANGUAGE_KEY="plc-performance-hub-language";
const SUPPORTED_LANGUAGES=["en","sk","cs","de","es","pl"];
let messages={};
let currentLanguage="en";

function systemLanguage(){
  const raw=String(navigator.language||"en").toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(raw)?raw:"en";
}
function languagePreference(){return localStorage.getItem(LANGUAGE_KEY)||"system"}
function interpolate(value,vars={}){
  return String(value).replace(/\{\{(\w+)\}\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(vars,k)?vars[k]:m);
}
function t(key,vars={}){
  const value=messages[key]!==undefined?messages[key]:key;
  return interpolate(value,vars);
}
window.PPHTranslate=key=>t(key);
async function loadMessages(lang){
  let base={};
  try{
    const enRes=await fetch("./locales/en.json",{cache:"no-cache"});
    if(enRes.ok)base=await enRes.json();
  }catch(e){}
  if(lang==="en")return base;
  try{
    const res=await fetch("./locales/"+lang+".json",{cache:"no-cache"});
    if(!res.ok)throw new Error("locale");
    const local=await res.json();
    return {...base,...local};
  }catch(e){
    return base;
  }
}
function applyTranslations(){
  document.documentElement.lang=currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key=el.dataset.i18n;
    if(messages[key]!==undefined)el.textContent=t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key=el.dataset.i18nPlaceholder;
    if(messages[key]!==undefined)el.placeholder=t(key);
  });
}
async function setLanguage(preference,announce=false){
  localStorage.setItem(LANGUAGE_KEY,preference);
  currentLanguage=preference==="system"?systemLanguage():preference;
  if(!SUPPORTED_LANGUAGES.includes(currentLanguage))currentLanguage="en";
  messages=await loadMessages(currentLanguage);
  applyTranslations();
  const select=$("languageSelect");
  if(select)select.value=preference;
  render();
  renderCompetitionFinder();
  renderAccount();
  if(announce&&$("settingsStatus"))$("settingsStatus").textContent=t("settings.saved");
}
async function initI18n(){await setLanguage(languagePreference(),false)}

function save(){
  localStorage.setItem(KEY,JSON.stringify(state));
}
function saveSession(){localStorage.setItem(SESSION_KEY,JSON.stringify(session))}
function num(v){const n=Number(String(v??"").replace(",",".").trim());return Number.isFinite(n)?n:0}
function blankPlan(){return {squat:[0,0,0],bench:[0,0,0],deadlift:[0,0,0]}}
function blankResults(){return {squat:["","",""],bench:["","",""],deadlift:["","",""]}}
function ensureState(){
  state.plan=state.plan||blankPlan();
  state.results=state.results||blankResults();
  state.meets=Array.isArray(state.meets)?state.meets:[];
  state.goal=state.goal||null;
  state.preferences=state.preferences||{
    homeCountry:"",
    homeCity:"",
    homeLat:null,
    homeLon:null,
    locationSource:""
  };
}
function totalFromPlan(){return lifts.reduce((sum,l)=>sum+Math.max.apply(null,state.plan[l].map(num)),0)}
function currentBestTotal(){const p=state.profile||{};return num(p.squatBest)+num(p.benchBest)+num(p.deadliftBest)}
function bestMade(lift){let best=0;(state.results[lift]||[]).forEach((r,i)=>{if(r==="good")best=Math.max(best,num(state.plan[lift][i]))});return best}
function liveTotal(){return lifts.reduce((s,l)=>s+bestMade(l),0)}
function madeMiss(){let made=0,miss=0;lifts.forEach(l=>(state.results[l]||[]).forEach(r=>{if(r==="good")made++;if(r==="miss")miss++}));return{made,miss}}
function suggestPlan(){ensureState();const p=state.profile||{};const ratios=[.90,.96,1.01];lifts.forEach(l=>{const best=num(p[l+"Best"]);if(best&&!state.plan[l].some(num)){state.plan[l]=ratios.map(r=>Math.round(best*r/2.5)*2.5)}})}
function daysUntil(date){if(!date)return null;const d=new Date(date+"T12:00:00"),now=new Date();return Math.ceil((d-now)/86400000)}
function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}
function round(v,d=2){const p=10**d;return Math.round(v*p)/p}

const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const metricFrames=new Map();
function setAnimatedMetric(id,value){
  const el=$(id),target=String(value??"—");
  if(el.dataset.metricTarget===target)return;
  if(metricFrames.has(id))cancelAnimationFrame(metricFrames.get(id));
  el.dataset.metricTarget=target;
  const parsed=Number(target.replace(",","."));
  if(target==="—"||!Number.isFinite(parsed)||reducedMotion()||document.hidden){el.textContent=target;return}
  const previous=Number(el.textContent.replace(",","."));
  const from=Number.isFinite(previous)?previous:0;
  const decimals=(target.split(/[.,]/)[1]||"").length;
  const started=performance.now(),duration=550;
  function step(now){
    if(el.dataset.metricTarget!==target)return;
    const t=Math.min(1,(now-started)/duration),eased=1-(1-t)**3;
    el.textContent=(from+(parsed-from)*eased).toFixed(decimals);
    if(t<1)metricFrames.set(id,requestAnimationFrame(step));
    else{el.textContent=target;metricFrames.delete(id)}
  }
  metricFrames.set(id,requestAnimationFrame(step));
}

function todayIso(){return new Date().toISOString().slice(0,10)}
function goalProgress(){
  const g=state.goal,p=state.profile||{};
  if(!g)return null;
  const current=currentBestTotal(),target=num(g.targetTotal);
  if(!target)return null;
  const gap=round(target-current,1);
  const pct=Math.max(0,Math.min(100,round(current/target*100,0)));
  return {current,target,gap,pct,targetDots:num(g.targetDots),targetBodyweight:num(g.targetBodyweight),targetDate:g.targetDate||""};
}
function cloudPayload(){
  return {
    schema_version:1,
    profile:state.profile||null,
    plan:state.plan||blankPlan(),
    results:state.results||blankResults(),
    meets:state.meets||[],
    goal:state.goal||null,
    preferences:state.preferences||{},
    saved_at:new Date().toISOString()
  };
}
function applyCloudPayload(payload){
  if(!payload||typeof payload!=="object")throw new Error("Cloud profile is empty.");
  suppressCloud=true;
  state.profile=payload.profile||state.profile||null;
  state.plan=payload.plan||blankPlan();
  state.results=payload.results||blankResults();
  state.meets=Array.isArray(payload.meets)?payload.meets:[];
  state.goal=payload.goal||null;
  state.preferences=payload.preferences||state.preferences||{};
  save();
  suppressCloud=false;
  render();
}

function dotsScore(sex,bodyweight,total){
  const bw=num(bodyweight),t=num(total);
  if(!bw||!t)return null;
  const male=[-0.000001093,0.0007391293,-0.1918759221,24.0900756,-307.75076];
  const female=[-0.0000010706,0.0005158568,-0.1126655495,13.6175032,-57.96288];
  const c=sex==="F"?female:male;
  const denom=c[0]*bw**4+c[1]*bw**3+c[2]*bw**2+c[3]*bw+c[4];
  if(denom<=0)return null;
  return round(t*500/denom,2);
}

function parseAge(value){
  const m=String(value??"").match(/\d{1,3}/);
  return m?Math.max(0,Math.min(120,Number(m[0]))):0;
}
function ageFromBirthDate(birthDate,referenceDate=""){
  if(!birthDate)return 0;
  const birth=new Date(String(birthDate)+"T12:00:00");
  const ref=referenceDate?new Date(String(referenceDate)+"T12:00:00"):new Date();
  if(Number.isNaN(birth.getTime())||Number.isNaN(ref.getTime()))return 0;
  let age=ref.getFullYear()-birth.getFullYear();
  const md=ref.getMonth()-birth.getMonth();
  if(md<0||(md===0&&ref.getDate()<birth.getDate()))age--;
  return Math.max(0,age);
}
function parseBirthDateInput(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  let day,month,year;
  let parts=raw.match(/^(\d{1,2})[.\/\-\s](\d{1,2})[.\/\-\s](\d{4})$/);
  if(parts){[,day,month,year]=parts}
  else if((parts=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){[,year,month,day]=parts}
  else if((parts=raw.match(/^(\d{2})(\d{2})(\d{4})$/))){[,day,month,year]=parts}
  else return null;
  const d=Number(day),m=Number(month),y=Number(year);
  const date=new Date(y,m-1,d,12);
  if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return null;
  return `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function formatBirthDate(iso){
  const parts=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return parts?`${parts[3]}.${parts[2]}.${parts[1]}`:"";
}
function profileAge(profile){
  const p=profile||{};
  return p.birthDate?ageFromBirthDate(p.birthDate):parseAge(p.age);
}

// Smooth approximation of the published WUAP Reshel tables.
// The WUAP source tables themselves are rounded to 0.001 at 0.25 kg steps.
function reshelCoefficient(sex,bodyweight){
  let bw=num(bodyweight);
  if(!bw)return null;
  if(sex==="F"){
    const A=239.894659799145,B=-20.5105859285582,C=1.16052601684125,D=-1.61417872668708;
    bw=Math.max(40,Math.min(119.75,bw));
    return A*(bw+B)**D+C;
  }
  const A=23740.8329088123,B=-9.75618720662844,C=0.787990994925928,D=-2.68445158813578;
  bw=Math.max(50,Math.min(180.75,bw));
  return A*(bw+B)**D+C;
}
function reshelScore(sex,bodyweight,total){
  const c=reshelCoefficient(sex,bodyweight),t=num(total);
  return c&&t?round(t*c,3):null;
}
const MCCULLOCH_WUAP={
  40:1.000,41:1.005,42:1.014,43:1.028,44:1.044,45:1.060,46:1.078,47:1.096,48:1.114,49:1.132,
  50:1.150,51:1.168,52:1.187,53:1.207,54:1.228,55:1.250,56:1.273,57:1.297,58:1.322,59:1.350,
  60:1.380,61:1.410,62:1.440,63:1.470,64:1.501,65:1.533,66:1.565,67:1.597,68:1.630,69:1.664,
  70:1.700,71:1.740,72:1.780,73:1.820,74:1.860,75:1.900,76:1.940,77:1.980,78:2.020,79:2.060,
  80:2.100
};
function mccullochMultiplier(age){
  const a=parseAge(age);
  if(a<40)return null;
  return MCCULLOCH_WUAP[Math.min(80,a)]||null;
}
function mccullochScore(sex,bodyweight,total,age){
  const reshel=reshelScore(sex,bodyweight,total),m=mccullochMultiplier(age);
  return reshel&&m?round(reshel*m,3):null;
}

function parseCsv(text){
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){
      if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted;
    }else if(ch===","&&!quoted){row.push(field);field=""}
    else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&next==="\n")i++;
      row.push(field);field="";
      if(row.some(x=>String(x).trim()!==""))rows.push(row);
      row=[];
    }else field+=ch;
  }
  if(field!==""||row.length){row.push(field);if(row.some(x=>String(x).trim()!==""))rows.push(row)}
  return rows;
}

function keyNorm(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function pick(obj,names){
  for(const n of names){
    const k=keyNorm(n);
    if(Object.prototype.hasOwnProperty.call(obj,k)&&String(obj[k]).trim()!=="")return obj[k];
  }
  return "";
}
function bestPositive(...vals){const nums=vals.map(num).filter(v=>v>0);return nums.length?Math.max(...nums):0}
function parseMeetRows(text){
  const rows=parseCsv(text);
  if(rows.length<2)throw new Error("CSV has no data rows.");
  const headers=rows[0].map(keyNorm);
  const out=[];
  for(const cells of rows.slice(1)){
    const obj={};headers.forEach((h,i)=>obj[h]=cells[i]??"");
    const date=pick(obj,["Date"]);
    const meet=pick(obj,["MeetName","Competition","Meet"]);
    const equipment=pick(obj,["Equipment","Equip"]);
    const athleteName=String(pick(obj,["Name","Lifter","LifterName"])||"").trim();
    const athleteSex=String(pick(obj,["Sex","Gender"])||"").trim().toUpperCase();
    const athleteAge=parseAge(pick(obj,["Age"]));
    const weightClass=String(pick(obj,["WeightClassKg","WeightClass","Class"])||"").trim();
    const bw=num(pick(obj,["BodyweightKg","Bodyweight","Weight","BW"]));
    const squat=bestPositive(
      pick(obj,["Best3SquatKg","Squat"]),
      pick(obj,["Squat1Kg"]),pick(obj,["Squat2Kg"]),pick(obj,["Squat3Kg"])
    );
    const bench=bestPositive(
      pick(obj,["Best3BenchKg","Bench","BenchPress"]),
      pick(obj,["Bench1Kg"]),pick(obj,["Bench2Kg"]),pick(obj,["Bench3Kg"])
    );
    const deadlift=bestPositive(
      pick(obj,["Best3DeadliftKg","Deadlift"]),
      pick(obj,["Deadlift1Kg"]),pick(obj,["Deadlift2Kg"]),pick(obj,["Deadlift3Kg"])
    );
    let total=num(pick(obj,["TotalKg","Total"]));
    if(!total&&squat&&bench&&deadlift)total=squat+bench+deadlift;
    let dots=num(pick(obj,["Dots","DOTS"]));
    if(!dots&&bw&&total)dots=dotsScore((state.profile||{}).sex||"M",bw,total)||0;
    if(!date&&!meet&&!total)continue;
    out.push({
      date:String(date||"").slice(0,10),
      meet:String(meet||"Competition"),
      athleteName,
      athleteSex,
      athleteAge,
      weightClass,
      federation:String(pick(obj,["Federation","Fed"])||""),
      equipment:String(equipment||""),
      bodyweight:bw,
      squat,bench,deadlift,total,
      dots:round(dots,2)
    });
  }
  return out.filter(r=>r.total>0).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function dedupeMeets(meets){
  const map=new Map();
  meets.forEach(m=>map.set([m.date,m.meet,m.total,m.bodyweight].join("|").toLowerCase(),m));
  return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function extractLifterSlug(input){
  const raw=String(input||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw);
    const m=url.pathname.match(/\/u\/([^/?#]+)/i);
    if(m&&m[1])return m[1].toLowerCase().replace(/[^a-z0-9_-]/g,"");
  }catch(e){}
  if(/^https?:/i.test(raw))return "";
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g,"");
}

function inferAthlete(meets){
  const rows=(meets||[]).filter(Boolean);
  const latest=rows.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).pop()||{};
  const firstNamed=rows.find(r=>r.athleteName)||{};
  const firstSex=rows.find(r=>r.athleteSex==="M"||r.athleteSex==="F")||{};
  return {
    name:firstNamed.athleteName||"",
    sex:firstSex.athleteSex||"",
    age:parseAge(latest.athleteAge),
    bodyweight:num(latest.bodyweight)
  };
}

function applyImportedAthlete(imported,profileUrl,slug){
  if(!imported.length)throw new Error("No valid competition results were returned.");
  state.meets=dedupeMeets(imported);
  const inferred=inferAthlete(imported);
  const pr=meetPrs();
  const existing=state.profile||{};
  state.profile={
    name:inferred.name||existing.name||slug||"Athlete",
    sex:(inferred.sex==="M"||inferred.sex==="F")?inferred.sex:(existing.sex||"M"),
    bodyweight:num(existing.bodyweight)||inferred.bodyweight||0,
    age:parseAge(existing.age)||inferred.age||0,
    meetDate:existing.meetDate||"",
    squatBest:Math.max(num(existing.squatBest),pr.squat),
    benchBest:Math.max(num(existing.benchBest),pr.bench),
    deadliftBest:Math.max(num(existing.deadliftBest),pr.deadlift),
    oplSlug:slug||existing.oplSlug||"",
    oplProfileUrl:profileUrl||existing.oplProfileUrl||""
  };
  state.plan=state.plan||blankPlan();
  state.results=state.results||blankResults();
  suggestPlan();save();render();
}

async function fetchAthleteBySlug(slug,statusEl){
  statusEl.textContent=t("dynamic.importing",{name:slug});
  const res=await fetch(LIFTER_API+"?slug="+encodeURIComponent(slug),{headers:{"Accept":"application/json"}});
  let payload={};
  try{payload=await res.json()}catch(e){}
  if(!res.ok)throw new Error(payload&&payload.message?payload.message:"Athlete profile was not found.");
  if(!payload.csv)throw new Error("No competition data was returned.");
  const imported=parseMeetRows(payload.csv);
  applyImportedAthlete(imported,payload.profile_url||"",payload.slug||slug);
  statusEl.textContent=t("dynamic.imported_results",{count:imported.length});
}

function renderCandidates(results,statusEl,candidateEl){
  candidateEl.innerHTML="";
  if(!results.length)return;
  statusEl.textContent=t("dynamic.matches",{count:results.length});
  results.forEach(item=>{
    const card=document.createElement("div");card.className="candidateCard";
    card.innerHTML="<div><strong>"+esc(item.name||item.slug)+"</strong><small>"+esc(item.profile_url||"")+"</small></div><button class=\"primary compact\" data-slug=\""+esc(item.slug)+"\">Import</button>";
    candidateEl.appendChild(card);
  });
  candidateEl.querySelectorAll("button[data-slug]").forEach(btn=>btn.addEventListener("click",async()=>{
    candidateEl.innerHTML="";
    try{await fetchAthleteBySlug(btn.dataset.slug,statusEl)}
    catch(err){statusEl.textContent="Import failed: "+err.message}
  }));
}

async function importAthlete(input,statusEl,candidateEl){
  const raw=String(input||"").trim();
  candidateEl.innerHTML="";
  if(!raw){
    statusEl.textContent=t("dynamic.search_prompt");
    return;
  }
  const exactSlug=extractLifterSlug(raw);
  const isExact=/\/u\//i.test(raw)||(!/\s/.test(raw)&&/^[a-z0-9_-]+$/i.test(raw));
  try{
    if(isExact&&exactSlug){
      await fetchAthleteBySlug(exactSlug,statusEl);
      return;
    }
    statusEl.textContent=t("dynamic.searching",{name:raw});
    const res=await fetch(LIFTER_SEARCH_API+"?q="+encodeURIComponent(raw),{headers:{"Accept":"application/json"}});
    let payload={};
    try{payload=await res.json()}catch(e){}
    if(!res.ok)throw new Error(payload&&payload.message?payload.message:"Search failed.");
    const results=Array.isArray(payload.results)?payload.results:[];
    if(results.length===1){
      await fetchAthleteBySlug(results[0].slug,statusEl);
    }else if(results.length>1){
      renderCandidates(results,statusEl,candidateEl);
    }else{
      statusEl.textContent=t("dynamic.no_match");
    }
  }catch(err){
    statusEl.textContent=t("dynamic.import_failed",{message:err.message});
  }
}

function meetPrs(){
  const meets=state.meets||[];
  const max=k=>meets.reduce((m,r)=>Math.max(m,num(r[k])),0);
  return {squat:max("squat"),bench:max("bench"),deadlift:max("deadlift"),total:max("total"),dots:round(max("dots"),2)};
}
function dotsDenominator(sex,bodyweight){
  const bw=num(bodyweight);if(!bw)return null;
  const male=[-0.000001093,0.0007391293,-0.1918759221,24.0900756,-307.75076];
  const female=[-0.0000010706,0.0005158568,-0.1126655495,13.6175032,-57.96288];
  const k=sex==="F"?female:male;
  const d=k[0]*bw**4+k[1]*bw**3+k[2]*bw**2+k[3]*bw+k[4];
  return d>0?d:null;
}
function totalForDots(sex,bodyweight,targetDots){
  const d=dotsDenominator(sex,bodyweight);return d?round(num(targetDots)*d/500,1):null;
}
function classNumber(label){return num(String(label||"").replace("+",""))}
function latestWeightClass(){
  const meets=(state.meets||[]).filter(m=>m.weightClass);
  return meets.length?meets[meets.length-1].weightClass:"";
}
function referenceRowFor(sex,bodyweight,preferredClass=""){
  const groups=performanceReference&&performanceReference.groups&&performanceReference.groups[sex];
  if(!Array.isArray(groups)||!groups.length)return null;
  if(preferredClass){
    const exact=groups.find(r=>String(r.weight_class_kg)===String(preferredClass));
    if(exact)return exact;
  }
  const bw=num(bodyweight);
  return groups.slice().sort((a,b)=>Math.abs(classNumber(a.weight_class_kg)-bw)-Math.abs(classNumber(b.weight_class_kg)-bw))[0]||null;
}
function estimatePercentile(dots,row){
  if(!row||!dots)return null;
  const pts=[[10,row.p10],[25,row.p25],[50,row.p50],[75,row.p75],[90,row.p90],[95,row.p95],[99,row.p99]].filter(x=>num(x[1])>0);
  if(!pts.length)return null;
  if(dots<=pts[0][1])return Math.max(1,round(10*dots/pts[0][1],0));
  for(let i=1;i<pts.length;i++){
    if(dots<=pts[i][1]){
      const p1=pts[i-1][0],v1=pts[i-1][1],p2=pts[i][0],v2=pts[i][1];
      return round(p1+(dots-v1)/(v2-v1)*(p2-p1),0);
    }
  }
  return 99;
}
function percentileText(p){
  if(p==null)return t("dynamic.reference_unavailable");
  if(p>=99)return t("dynamic.top_1");
  if(p>=95)return t("dynamic.top_5");
  if(p>=90)return t("dynamic.top_10");
  if(p>=75)return t("dynamic.top_25");
  if(p>=50)return t("dynamic.above_median");
  if(p>=25)return t("dynamic.percentile_25_50");
  return t("dynamic.below_25");
}
function percentileValueText(p){
  if(p==null)return "—";
  return t("dynamic.percentile_value",{pct:p});
}
function referenceWindowText(value){
  const raw=String(value||"").trim();
  if(/^last\s+3\s+years$/i.test(raw))return t("dynamic.last_3_years");
  return raw;
}
async function loadReference(){
  if(performanceReference)return performanceReference;
  try{
    const res=await fetch(REFERENCE_API,{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error("Reference unavailable");
    performanceReference=await res.json();
    renderTools();
    return performanceReference;
  }catch(e){
    performanceReference=null;
    renderTools();
    return null;
  }
}
function contextFor(sex,bw,dots,preferredClass=""){
  const row=referenceRowFor(sex,bw,preferredClass);
  if(!row)return null;
  const percentile=estimatePercentile(dots,row);
  return {row,percentile,label:percentileText(percentile)};
}
function renderTools(){
  const box=$("strengthContext");if(!box)return;
  const p=state.profile||{},total=currentBestTotal(),dots=dotsScore(p.sex,p.bodyweight,total);
  if(!performanceReference){
    box.innerHTML='<div class="muted">'+esc(t("dynamic.reference_unavailable"))+'</div>';
  }else if(!dots){
    box.innerHTML='<div class="muted">'+esc(t("dynamic.add_bw_total"))+'</div>';
  }else{
    const ctx=contextFor(p.sex,p.bodyweight,dots,latestWeightClass());
    if(!ctx)box.innerHTML='<div class="muted">'+esc(t("dynamic.no_reference"))+'</div>';
    else{
      const pct=percentileValueText(ctx.percentile);
      box.innerHTML='<div class="contextHero"><div><span class="muted">'+esc(t("dynamic.estimated_percentile"))+'</span><strong>'+esc(pct)+'</strong></div><div><span class="muted">'+esc(t("dynamic.context"))+'</span><strong>'+esc(ctx.label)+'</strong></div></div><div class="contextScale"><span style="width:'+Math.max(2,ctx.percentile||0)+'%"></span></div><div class="contextMeta">'+esc(t("dynamic.reference_class"))+': '+esc(ctx.row.weight_class_kg)+' kg · n='+Number(ctx.row.n).toLocaleString()+' · '+esc(t("dynamic.raw_full_power"))+' · '+esc(referenceWindowText(performanceReference.analysis_window))+'</div>'+(ctx.percentile==null?'':'<div class="contextExplanation"><p>'+esc(t("dynamic.percentile_explain",{pct:ctx.percentile}))+'</p><p>'+esc(t("dynamic.context_explain",{above:100-ctx.percentile,label:ctx.label,pct:ctx.percentile}))+'</p><p>'+esc(t("dynamic.reference_explain"))+'</p></div>');
    }
  }
  if(!$("simBodyweight").value)$("simBodyweight").value=p.bodyweight||"";
  if(!$("simTotal").value)$("simTotal").value=total||"";
  if(!$("goalBodyweight").value)$("goalBodyweight").value=p.bodyweight||"";
  if(state.goal){
    if(!$("goalDots").value)$("goalDots").value=state.goal.targetDots||"";
    if(!$("goalBodyweight").value)$("goalBodyweight").value=state.goal.targetBodyweight||"";
    if(!$("goalDate").value)$("goalDate").value=state.goal.targetDate||"";
  }
}

function render(){
  const p=state.profile;
  $("onboarding").hidden=!!p||accountOnly;$("app").hidden=!p&&!accountOnly;
  document.querySelector("#app > .heroPanel").hidden=!p;
  document.querySelector("#app > .primaryNav").hidden=!p;
  const utilityNav=document.querySelector("#app > .utilityNav");
  if(utilityNav)utilityNav.hidden=true;
  const topSettingsCta=$("topSettingsCta");
  if(topSettingsCta)topSettingsCta.hidden=!p;
  $("accountBackToProfile").hidden=!!p;
  if(!p){
    if(accountOnly)document.querySelectorAll(".tab").forEach(tab=>tab.hidden=tab.id!=="tab-account");
    renderAccount();return;
  }
  ensureState();suggestPlan();
  $("athleteName").textContent=p.name||"Your dashboard";
  setAnimatedMetric("metricBw",p.bodyweight||"—");setAnimatedMetric("metricSq",p.squatBest||"—");setAnimatedMetric("metricBp",p.benchBest||"—");setAnimatedMetric("metricDl",p.deadliftBest||"—");
  $("currentTotal").textContent=currentBestTotal();
  const currentDots=dotsScore(p.sex,p.bodyweight,currentBestTotal());
  const currentReshel=reshelScore(p.sex,p.bodyweight,currentBestTotal());
  const currentAge=profileAge(p);
  const currentMcculloch=mccullochScore(p.sex,p.bodyweight,currentBestTotal(),currentAge);
  $("currentDots").textContent=currentDots?currentDots.toFixed(2):"—";
  $("currentReshel").textContent=currentReshel?currentReshel.toFixed(3):"—";
  $("currentMcculloch").textContent=currentMcculloch?currentMcculloch.toFixed(3):"—";
  $("mccullochNote").textContent=currentAge>=40?t("dynamic.age_value",{age:currentAge}):t("dynamic.masters_40");
  $("mccullochSetup").hidden=!!p.birthDate;
  $("mccullochSetup").textContent=t("dynamic.add_birth_date");
  const d=daysUntil(p.meetDate);
  $("countdown").textContent=p.meetDate?(d>=0?t("dynamic.days_until",{days:d}):t("dynamic.meet_passed")):t("dynamic.add_meet_date");
  $("meetSnapshot").innerHTML="<div><strong>"+esc(t("dynamic.meet_label"))+":</strong> "+esc(p.meetName||t("common.not_set"))+"</div><div><strong>"+esc(t("dynamic.date_label"))+":</strong> "+esc(p.meetDate||t("common.not_set"))+"</div><div><strong>"+esc(t("planner.projected_total"))+":</strong> "+totalFromPlan()+" kg</div><div><strong>"+esc(t("dynamic.current_best"))+":</strong> "+currentBestTotal()+" kg</div><div><strong>"+esc(t("dynamic.current_dots"))+":</strong> "+(currentDots?currentDots.toFixed(2):"—")+"</div>";
  renderGoalSnapshot();
  renderPlanner();renderMeetDay();renderProgress();renderTools();renderReport();renderAccount();populateLocationSettings();populateAthleteProfileSettings();renderCompetitionFinder();
}

function renderGoalSnapshot(){
  const root=$("goalSnapshot");if(!root)return;
  const gp=goalProgress();
  if(!gp){root.innerHTML='<div class="muted">'+esc(t("dynamic.no_goal"))+'</div>';return}
  root.innerHTML='<div><strong>Target:</strong> '+(gp.targetDots?gp.targetDots+" DOTS · ":"")+gp.target+' kg total</div>'
    +'<div><strong>'+esc(t("dynamic.target_bw"))+':</strong> '+(gp.targetBodyweight||"—")+' kg</div>'
    +(gp.targetDate?'<div><strong>'+esc(t("dynamic.target_date"))+':</strong> '+esc(gp.targetDate)+'</div>':'')
    +'<div class="goalProgress"><span style="width:'+gp.pct+'%"></span></div>'
    +'<div><strong>'+esc(t("dynamic.of_target",{pct:gp.pct}))+'</strong> · '+esc(gp.gap>0?t("dynamic.to_go",{gap:gp.gap}):t("dynamic.goal_reached"))+'</div>';
}

function renderPlanner(){
  const root=$("plannerRows");root.innerHTML="";
  lifts.forEach(l=>{
    const g=document.createElement("div");g.className="liftGroup";g.innerHTML="<h3>"+l+"</h3>";
    state.plan[l].forEach((v,i)=>{
      const row=document.createElement("div");row.className="attemptRow";
      row.innerHTML="<span>"+esc(t("planner.attempt"))+" "+(i+1)+"</span><input type=\"number\" step=\"2.5\" data-lift=\""+l+"\" data-idx=\""+i+"\" value=\""+(v||"")+"\" placeholder=\"kg\">";
      g.appendChild(row);
    });root.appendChild(g);
  });
  root.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{
    state.plan[e.target.dataset.lift][Number(e.target.dataset.idx)]=num(e.target.value);save();
    $("projectedTotal").textContent=totalFromPlan()+" kg";renderMeetDay();renderReport();
  }));
  $("projectedTotal").textContent=totalFromPlan()+" kg";
}

function renderMeetDay(){
  const root=$("meetDayRows");root.innerHTML="";
  lifts.forEach(l=>{
    const g=document.createElement("div");g.className="liftGroup";g.innerHTML="<h3>"+l+"</h3>";
    state.plan[l].forEach((v,i)=>{
      const val=state.results[l][i],row=document.createElement("div");row.className="attemptRow";
      row.innerHTML="<span>#"+(i+1)+" · "+(v||"—")+" kg</span><div class=\"attemptActions\"><button class=\"good "+(val==="good"?"active":"")+"\" data-r=\"good\" data-lift=\""+l+"\" data-idx=\""+i+"\">"+esc(t("meetday.good"))+"</button><button class=\"miss "+(val==="miss"?"active":"")+"\" data-r=\"miss\" data-lift=\""+l+"\" data-idx=\""+i+"\">"+esc(t("meetday.miss"))+"</button></div>";
      g.appendChild(row);
    });root.appendChild(g);
  });
  root.querySelectorAll(".attemptActions button").forEach(b=>b.addEventListener("click",e=>{
    const lift=e.target.dataset.lift,idx=Number(e.target.dataset.idx),r=e.target.dataset.r;
    state.results[lift][idx]=state.results[lift][idx]===r?"":r;save();renderMeetDay();renderReport();
  }));
  const mm=madeMiss();$("madeCount").textContent=mm.made;$("missCount").textContent=mm.miss;$("liveTotal").textContent=liveTotal()+" kg";
}

function svgChart(rows,key){
  const data=rows.filter(r=>num(r[key])>0);
  if(data.length<2)return '<div class="chartEmpty">'+esc(t("dynamic.chart_need_two"))+'</div>';
  const w=520,h=210,pad=34;
  const vals=data.map(r=>num(r[key])),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min);
  const x=i=>pad+(i*(w-pad*2)/(data.length-1));
  const y=v=>h-pad-((v-min)/range)*(h-pad*2);
  const pts=data.map((r,i)=>x(i)+","+y(num(r[key]))).join(" ");
  const labels=data.map((r,i)=>{
    if(i!==0&&i!==data.length-1&&data.length>5&&i%Math.ceil(data.length/4)!==0)return "";
    return '<text class="chartLabel" x="'+x(i)+'" y="'+(h-8)+'" text-anchor="middle">'+esc(String(r.date||"").slice(0,7))+'</text>';
  }).join("");
  const dots=data.map((r,i)=>'<circle class="chartDot" cx="'+x(i)+'" cy="'+y(num(r[key]))+'" r="4"><title>'+esc(r.date+" · "+r[key])+'</title></circle>').join("");
  return '<svg viewBox="0 0 '+w+' '+h+'" role="img"><line class="chartAxis" x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'"></line><polyline class="chartLine" points="'+pts+'"></polyline>'+dots+labels+'<text class="chartLabel" x="4" y="'+(pad+4)+'">'+round(max,1)+'</text><text class="chartLabel" x="4" y="'+(h-pad+4)+'">'+round(min,1)+'</text></svg>';
}

function renderProgress(){
  ensureState();
  const meets=state.meets||[],status=$("importStatus"),summary=$("progressSummary"),rows=$("historyRows");
  status.textContent=meets.length?t("dynamic.results_stored",{count:meets.length}):t("progress.empty");
  const pr=meetPrs();
  summary.innerHTML=[
    [t("dynamic.best_total"),pr.total?pr.total+" kg":"—"],
    [t("dynamic.best_dots"),pr.dots||"—"],
    [t("dynamic.best_squat"),pr.squat?pr.squat+" kg":"—"],
    [t("dynamic.best_bench"),pr.bench?pr.bench+" kg":"—"],
    [t("dynamic.best_deadlift"),pr.deadlift?pr.deadlift+" kg":"—"]
  ].map(x=>'<article class="metric"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>').join("");
  $("totalChart").innerHTML=svgChart(meets,"total");
  $("dotsChart").innerHTML=svgChart(meets,"dots");
  rows.innerHTML=meets.slice().reverse().map(m=>'<tr><td>'+esc(m.date||"—")+'</td><td>'+esc(m.meet||"—")+'</td><td>'+fmt(m.bodyweight)+'</td><td>'+fmt(m.squat)+'</td><td>'+fmt(m.bench)+'</td><td>'+fmt(m.deadlift)+'</td><td><strong>'+fmt(m.total)+'</strong></td><td>'+fmt(m.dots,2)+'</td></tr>').join("");
  if(!meets.length)rows.innerHTML='<tr><td colspan="8" class="muted">'+esc(t("dynamic.no_history"))+'</td></tr>';
}
function fmt(v,d=1){const n=num(v);return n?n.toFixed(d).replace(/\.0$/,""):"—"}

const EUROPE_COUNTRIES=new Set([
  "albania","andorra","austria","belarus","belgium","bosnia and herzegovina","bulgaria","croatia","cyprus",
  "czech republic","czechia","denmark","estonia","finland","france","germany","greece","hungary","iceland",
  "ireland","italy","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco",
  "montenegro","netherlands","north macedonia","norway","poland","portugal","romania","san marino","serbia",
  "slovakia","slovenia","spain","sweden","switzerland","ukraine","united kingdom","great britain","england",
  "scotland","wales","northern ireland"
]);
const NEIGHBORS={
  "slovakia":["czech republic","czechia","austria","hungary","poland","ukraine"],
  "czech republic":["slovakia","austria","germany","poland"],
  "czechia":["slovakia","austria","germany","poland"],
  "austria":["slovakia","czech republic","czechia","hungary","germany","slovenia","italy","switzerland"],
  "hungary":["slovakia","austria","slovenia","croatia","serbia","romania","ukraine"],
  "poland":["slovakia","czech republic","czechia","germany","ukraine","lithuania","belarus"]
};
function normText(v){return String(v||"").trim().toLowerCase()}
function countryMatches(a,b){
  const x=normText(a),y=normText(b);
  if(!x||!y)return false;
  const aliases={"czechia":"czech republic","great britain":"united kingdom","uk":"united kingdom","usa":"united states","u.s.a.":"united states"};
  return (aliases[x]||x)===(aliases[y]||y);
}
function haversineKm(lat1,lon1,lat2,lon2){
  const r=6371,toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return Math.round(r*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}
function eventDistance(m){
  const p=state.preferences||{},lat=num(m.latitude),lon=num(m.longitude);
  if(!num(p.homeLat)||!num(p.homeLon)||!lat||!lon)return null;
  return haversineKm(num(p.homeLat),num(p.homeLon),lat,lon);
}
function nearbyCountryFallback(country){
  const home=normText((state.preferences||{}).homeCountry);
  if(!home)return false;
  if(countryMatches(country,home))return true;
  return (NEIGHBORS[home]||[]).some(x=>countryMatches(country,x));
}
function competitionSearchText(m){
  return [m.event,m.city,m.region,m.country,m.federation,m.venue,m.event_disciplines,m.equipment_categories].filter(Boolean).join(" ").toLowerCase();
}
function competitionMatchesScope(m,scope,radius){
  const p=state.preferences||{},distance=eventDistance(m);
  if(scope==="world")return true;
  if(scope==="europe")return EUROPE_COUNTRIES.has(normText(m.country));
  if(scope==="country")return p.homeCountry?countryMatches(m.country,p.homeCountry):false;
  if(scope==="nearby"){
    if(distance!==null)return distance<=radius;
    return nearbyCountryFallback(m.country);
  }
  return true;
}
function filteredCompetitions(){
  const q=normText($("competitionSearch")?.value);
  const range=num($("competitionDateRange")?.value)||90;
  const radius=num($("competitionRadius")?.value)||250;
  const federation=$("competitionFederation")?.value||"";
  const rows=upcomingCompetitions.filter(m=>{
    if(q&&!competitionSearchText(m).includes(q))return false;
    if(range<9999&&num(m.days_until)>range)return false;
    if(federation&&m.federation!==federation)return false;
    return competitionMatchesScope(m,competitionScope,radius);
  }).map(m=>({...m,_distance:eventDistance(m)}));
  rows.sort((a,b)=>{
    if(competitionScope==="nearby"){
      const ad=a._distance===null?999999:a._distance,bd=b._distance===null?999999:b._distance;
      if(ad!==bd)return ad-bd;
    }
    return num(a.days_until)-num(b.days_until)||String(a.event).localeCompare(String(b.event));
  });
  return rows;
}
async function loadCompetitions(){
  try{
    const res=await fetch(HUB_API+"/competitions",{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error("Competition feed unavailable");
    const data=await res.json();
    upcomingCompetitions=Array.isArray(data.competitions)?data.competitions:[];
  }catch(e){upcomingCompetitions=[]}
  renderCompetitionFinder();
}
function renderFederationOptions(){
  const sel=$("competitionFederation");if(!sel)return;
  const current=sel.value;
  const feds=[...new Set(upcomingCompetitions.map(m=>m.federation).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  sel.innerHTML='<option value="">'+esc(t("finder.all_federations"))+'</option>'+feds.map(f=>'<option value="'+esc(f)+'">'+esc(f)+'</option>').join("");
  if(feds.includes(current))sel.value=current;
}
function renderCompetitionFinder(){
  const root=$("competitionResults"),status=$("competitionStatus");
  if(!root||!status)return;
  renderFederationOptions();
  const p=state.preferences||{};
  document.querySelectorAll("#competitionScopes button").forEach(btn=>btn.classList.toggle("active",btn.dataset.scope===competitionScope));
  const rows=filteredCompetitions();
  const hasLocation=num(p.homeLat)&&num(p.homeLon);
  if((competitionScope==="nearby"&&!hasLocation&&!p.homeCountry)||(competitionScope==="country"&&!p.homeCountry)){
    status.textContent=t("finder.location_needed");
  }else{
    status.textContent=t("finder.results_count",{count:rows.length});
  }
  if(!rows.length){
    root.innerHTML='<div class="finderEmpty">'+esc(t("finder.no_results"))+'</div>';
    return;
  }
  root.innerHTML=rows.slice(0,80).map((m)=>{
    const place=[m.city,m.country].filter(Boolean).join(", ")||m.country||t("common.not_set");
    const distance=m._distance!==null?'<span class="distanceBadge">'+m._distance+' km</span>':"";
    const meta=[m.start_date,m.federation].filter(Boolean).join(" · ");
    const venue=m.venue?'<div class="competitionVenue">'+esc(m.venue)+'</div>':"";
    const selected=(state.profile||{}).meetName===m.event&&(state.profile||{}).meetDate===m.start_date;
    return '<article class="competitionCard">'
      +'<div class="competitionTop"><div><h4>'+esc(m.event||"Powerlifting meet")+'</h4><div class="competitionPlace">'+esc(place)+'</div></div>'+distance+'</div>'
      +venue+'<div class="competitionMeta">'+esc(meta)+'</div>'
      +'<div class="competitionActions">'
      +(m.url?'<a class="ghost linkButton" href="'+esc(m.url)+'" target="_blank" rel="noopener">'+esc(t("finder.details"))+'</a>':'')
      +'<button class="'+(selected?'selectedMeet':'primary compact')+'" data-select-event="'+esc(m.event||"")+'" data-select-date="'+esc(m.start_date||"")+'">'+esc(selected?t("finder.selected"):t("finder.select"))+'</button>'
      +'</div></article>';
  }).join("");
  root.querySelectorAll("[data-select-event]").forEach(btn=>btn.addEventListener("click",()=>{
    const m=upcomingCompetitions.find(x=>x.event===btn.dataset.selectEvent&&x.start_date===btn.dataset.selectDate);
    if(m)selectCompetition(m);
  }));
}
function selectCompetition(m){
  const p=state.profile||{};
  p.meetName=m.event||"Powerlifting meet";
  p.meetDate=m.start_date||"";
  p.meetCountry=m.country||"";
  p.meetCity=m.city||"";
  p.meetVenue=m.venue||"";
  p.meetFederation=m.federation||"";
  p.meetUrl=m.url||"";
  state.profile=p;save();render();
  $("competitionStatus").textContent=t("dynamic.meet_saved",{meet:p.meetName});
  renderCompetitionFinder();
}
async function saveHomeLocation(){
  const country=$("homeCountry").value.trim(),city=$("homeCity").value.trim(),status=$("locationStatus");
  state.preferences=state.preferences||{};
  state.preferences.homeCountry=country;state.preferences.homeCity=city;
  if(!city){
    state.preferences.homeLat=null;state.preferences.homeLon=null;state.preferences.locationSource="country";
    save();status.textContent=t("finder.location_saved");renderCompetitionFinder();return;
  }
  status.textContent=t("finder.resolving_location");
  try{
    const url=HUB_API+"/geocode?city="+encodeURIComponent(city)+"&country="+encodeURIComponent(country);
    const res=await fetch(url,{headers:{"Accept":"application/json"}});
    const data=await res.json();
    if(!res.ok)throw new Error(data.message||"Location lookup failed.");
    state.preferences.homeLat=num(data.latitude);state.preferences.homeLon=num(data.longitude);
    state.preferences.locationSource="manual";save();
    status.textContent=t("finder.location_resolved",{place:data.display_name||[city,country].filter(Boolean).join(", ")});
    renderCompetitionFinder();
  }catch(err){status.textContent=t("finder.location_error",{message:err.message})}
}
function useBrowserLocation(statusId="competitionStatus"){
  const status=$(statusId)||$("competitionStatus");
  if(!navigator.geolocation){status.textContent=t("finder.location_unsupported");return}
  status.textContent=t("finder.getting_location");
  navigator.geolocation.getCurrentPosition(pos=>{
    state.preferences=state.preferences||{};
    state.preferences.homeLat=pos.coords.latitude;
    state.preferences.homeLon=pos.coords.longitude;
    state.preferences.locationSource="device";
    save();status.textContent=t("finder.location_ready");competitionScope="nearby";renderCompetitionFinder();
  },()=>{status.textContent=t("finder.location_denied")},{enableHighAccuracy:false,timeout:10000,maximumAge:3600000});
}
function populateLocationSettings(){
  const p=state.preferences||{};
  if($("homeCountry")&&!$("homeCountry").value)$("homeCountry").value=p.homeCountry||"";
  if($("homeCity")&&!$("homeCity").value)$("homeCity").value=p.homeCity||"";
}
function populateAthleteProfileSettings(){
  const p=state.profile||{};
  if($("birthDate"))$("birthDate").value=formatBirthDate(p.birthDate);
  if($("profileAge"))$("profileAge").value=profileAge(p)||"";
}
function saveAthleteProfileSettings(){
  const p=state.profile||{};
  const ageInput=$("profileAge"),rawDate=$("birthDate").value.trim();
  const birthDate=parseBirthDateInput(rawDate);
  if(birthDate===null){
    $("athleteProfileStatus").textContent=t("settings.invalid_birth_format");
    $("birthDate").focus();return;
  }
  const age=birthDate?ageFromBirthDate(birthDate):parseAge(ageInput.value);
  if(birthDate&&(age<13||age>100)){
    $("athleteProfileStatus").textContent=t("settings.invalid_birth_date");
    $("birthDate").focus();return;
  }
  if(!ageInput.checkValidity()){ageInput.reportValidity();return}
  p.birthDate=birthDate;
  p.age=age;
  state.profile=p;
  save();
  render();
  if($("athleteProfileStatus"))$("athleteProfileStatus").textContent=t("settings.profile_saved");
}
function openAthleteProfileSettings(){
  const target=document.querySelector('[data-tab="settings"]');
  if(target)target.click();
  requestAnimationFrame(()=>{
    const card=$("athleteProfileSettings");
    if(card)card.scrollIntoView({behavior:"smooth",block:"start"});
    if($("birthDate"))$("birthDate").focus();
  });
}

function saveCurrentGoal(){
  const p=state.profile||{},targetDots=num($("goalDots").value),bw=num($("goalBodyweight").value);
  const targetTotal=totalForDots(p.sex,bw,targetDots);
  if(!targetDots||!bw||!targetTotal){$("goalResult").textContent=t("dynamic.valid_goal");return}
  state.goal={targetDots,targetBodyweight:bw,targetTotal,targetDate:$("goalDate").value||""};
  save();renderGoalSnapshot();
  $("goalResult").innerHTML='<strong class="big">'+esc(t("dynamic.goal_saved"))+'</strong><p>'+esc(t("dynamic.goal_saved_text",{dots:targetDots,bw:bw,total:targetTotal}))+'</p>';
}
function buildMeetRecord(){
  const p=state.profile||{},total=liveTotal();
  if(!total)return null;
  return {
    date:p.meetDate||todayIso(),
    meet:p.meetName||"Performance Hub Meet",
    athleteName:p.name||"",
    athleteSex:p.sex||"",
    weightClass:"",
    federation:p.meetFederation||"",
    equipment:"Raw",
    bodyweight:num(p.bodyweight),
    squat:bestMade("squat"),
    bench:bestMade("bench"),
    deadlift:bestMade("deadlift"),
    total,
    dots:dotsScore(p.sex,p.bodyweight,total)||0,
    source:"Performance Hub",
    attempts:JSON.parse(JSON.stringify(state.results||{}))
  };
}
function saveMeetToHistory(){
  const record=buildMeetRecord();
  if(!record){$("reportStatus").textContent=t("dynamic.need_success");return}
  state.meets=dedupeMeets([...(state.meets||[]),record]);
  const p=state.profile||{};
  p.squatBest=Math.max(num(p.squatBest),record.squat);
  p.benchBest=Math.max(num(p.benchBest),record.bench);
  p.deadliftBest=Math.max(num(p.deadliftBest),record.deadlift);
  state.profile=p;save();render();
  $("reportStatus").textContent=t("dynamic.saved_history");
}
function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
async function makeResultCardBlob(){
  const record=buildMeetRecord(),p=state.profile||{};
  if(!record)throw new Error("Complete some successful attempts first.");
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1080;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#101214";ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle="#f0b54b";ctx.fillRect(0,0,1080,18);
  ctx.fillStyle="#a0a7af";ctx.font="700 30px system-ui";ctx.fillText("POWERLIFTING PERFORMANCE HUB",70,95);
  ctx.fillStyle="#ffffff";ctx.font="800 64px system-ui";ctx.fillText((p.name||"Athlete").slice(0,24),70,180);
  ctx.fillStyle="#a0a7af";ctx.font="500 30px system-ui";ctx.fillText((record.meet||"Meet Day").slice(0,42),70,230);
  const boxes=[
    ["SQUAT",record.squat+" kg"],["BENCH",record.bench+" kg"],["DEADLIFT",record.deadlift+" kg"],
    ["TOTAL",record.total+" kg"],["DOTS",record.dots?Number(record.dots).toFixed(2):"—"],["ATTEMPTS",madeMiss().made+"/"+(madeMiss().made+madeMiss().miss)]
  ];
  boxes.forEach((b,i)=>{
    const col=i%3,row=Math.floor(i/3),x=70+col*320,y=320+row*230;
    ctx.fillStyle="#191d21";roundedRect(ctx,x,y,285,185,24);
    ctx.fillStyle="#9ca3ab";ctx.font="700 24px system-ui";ctx.fillText(b[0],x+28,y+48);
    ctx.fillStyle=i>=3?"#f0b54b":"#ffffff";ctx.font="800 46px system-ui";ctx.fillText(String(b[1]),x+28,y+118);
  });
  ctx.fillStyle="#a0a7af";ctx.font="500 26px system-ui";ctx.fillText("powerlifting-calculator.com",70,1010);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not create image.")),"image/png",0.95));
}
async function shareResultCard(){
  try{
    const blob=await makeResultCardBlob();
    const file=new File([blob],"powerlifting-meet-report.png",{type:"image/png"});
    const record=buildMeetRecord(),p=state.profile||{};
    const text=(p.name||"Athlete")+" · "+record.total+" kg total · "+(record.dots?Number(record.dots).toFixed(2)+" DOTS":"Powerlifting meet");
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({title:"Powerlifting Meet Report",text,files:[file]});
    }else{
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      $("reportStatus").textContent=t("dynamic.card_saved");
    }
  }catch(err){$("reportStatus").textContent=err.message}
}
function authHeaders(){
  return session.token?{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer "+session.token}:{"Accept":"application/json","Content-Type":"application/json"};
}
async function hubRequest(path,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  let res;
  try{res=await fetch(HUB_API+path,{...options,signal:controller.signal})}
  catch(err){throw new Error(err.name==="AbortError"?t("auth.timeout"):t("auth.network_error"))}
  finally{clearTimeout(timer)}
  let data;
  try{data=await res.json()}catch(e){throw new Error(t("auth.server_error"))}
  if(!res.ok){
    const key="auth.api_"+data.code;
    const error=new Error(messages[key]!==undefined?t(key):(data.message||t("auth.server_error")));
    error.code=data.code;error.status=res.status;throw error;
  }
  return data;
}
function hubAuthRequest(path,values){
  return hubRequest(path,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams(values)});
}
let emailMode="signup";
let accountOnly=false;
function openAccountFromOnboarding(){
  accountOnly=true;render();
  document.querySelectorAll("[data-tab]").forEach(button=>button.classList.toggle("active",button.dataset.tab==="account"));
  window.scrollTo({top:0,behavior:"auto"});
}
function openAccountTab(mode){
  if(!state.profile){openAccountFromOnboarding();return}
  if(mode==="signin"||mode==="signup")setEmailMode(mode,true);
  const accountButton=document.querySelector('[data-tab="account"]');
  if(accountButton)accountButton.click();
}
function setEmailMode(mode,reset=false){
  emailMode=mode==="signin"?"signin":"signup";
  const signIn=emailMode==="signin";
  $("emailModeSignIn").classList.toggle("active",signIn);
  $("emailModeSignUp").classList.toggle("active",!signIn);
  $("emailModeSignIn").setAttribute("aria-pressed",String(signIn));
  $("emailModeSignUp").setAttribute("aria-pressed",String(!signIn));
  $("emailAccountTitle").textContent=t(signIn?"auth.code_title":"auth.email_signup_title");
  $("emailAccountNote").textContent=t(signIn?"auth.email_signin_note":"auth.email_signup_note");
  $("verifyCode").textContent=t(signIn?"account.sign_in":"auth.email_confirm");
  if(reset){
    delete session.pendingEmail;saveSession();$("codeStep").hidden=true;
    $("accountCode").value="";$("accountStatus").textContent="";
  }
}
async function checkAccountConnection(){
  const button=$("checkAccountConnection"),status=$("accountStatus");
  button.disabled=true;status.textContent=t("auth.connection_checking");
  try{
    await hubAuthRequest("/auth/request-code",{email:""});
    status.textContent=t("auth.server_error");
  }catch(error){
    status.textContent=error.code==="invalid_email"?t("auth.connection_ready"):
      error.code==="rest_no_route"?t("auth.backend_missing"):error.message;
  }finally{button.disabled=false}
}
async function requestLoginCode(){
  const emailInput=$("accountEmail"),email=emailInput.value.trim(),status=$("accountStatus"),button=$("requestCode");
  if(button.disabled||!emailInput.reportValidity())return;
  button.disabled=true;
  status.textContent=t("dynamic.sending_code");
  try{
    await hubAuthRequest("/auth/request-code",{email});
    session.pendingEmail=email;saveSession();$("accountCode").value="";$("codeStep").hidden=false;
    status.textContent=t("dynamic.code_sent");
    $("accountCode").focus();
  }catch(err){status.textContent=err.message}
  finally{button.disabled=false}
}
async function completeHubSignIn(data){
  session.token=data.token;
  session.email=data.email;
  session.expiresAt=data.expires_at;
  delete session.pendingEmail;
  saveSession();
  renderAccount();
  if(data.profile&&Object.keys(data.profile).length){
    $("cloudStatus").textContent=t("dynamic.cloud_found");
  }else if(state.profile){
    await uploadCloud(false);
  }else{
    $("cloudStatus").textContent=t("auth.create_profile_note");
  }
}
async function verifyLoginCode(){
  const email=(session.pendingEmail||$("accountEmail").value).trim(),code=$("accountCode").value.trim(),status=$("accountStatus"),button=$("verifyCode");
  if(button.disabled||!$("accountCode").reportValidity())return;
  button.disabled=true;
  status.textContent=t("dynamic.signing_in");
  try{
    const data=await hubAuthRequest("/auth/verify-code",{email,code});
    await completeHubSignIn(data);
  }catch(err){status.textContent=err.message}
  finally{button.disabled=false}
}
let googleIdentityPromise=null;
function loadGoogleIdentity(){
  if(window.google?.accounts?.id)return Promise.resolve();
  if(googleIdentityPromise)return googleIdentityPromise;
  googleIdentityPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-pph-google-identity]');
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("Google sign-in could not be loaded.")),{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src="https://accounts.google.com/gsi/client";
    script.async=true;script.defer=true;script.dataset.pphGoogleIdentity="1";
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  });
  return googleIdentityPromise;
}
let googleButtonRendered=false;
async function initGoogleSignIn(){
  const container=$("googleSignInButton"),status=$("googleStatus");
  if(!container||googleButtonRendered||session.token)return;
  try{
    await loadGoogleIdentity();
    window.google.accounts.id.initialize({
      client_id:GOOGLE_CLIENT_ID,
      callback:async response=>{
        if(!response?.credential)return;
        status.textContent=t("dynamic.signing_in");
        try{
          const data=await hubAuthRequest("/auth/google",{credential:response.credential});
          status.textContent="";
          await completeHubSignIn(data);
        }catch(err){status.textContent=err.message}
      },
      auto_select:false,
      cancel_on_tap_outside:true
    });
    const googleButtonWidth=Math.max(220,Math.min(360,Math.floor(container.getBoundingClientRect().width||320)));
    window.google.accounts.id.renderButton(container,{
      type:"standard",
      theme:"outline",
      size:"large",
      text:"continue_with",
      shape:"rectangular",
      logo_alignment:"left",
      width:googleButtonWidth
    });
    googleButtonRendered=true;
  }catch(err){
    status.textContent=err.message||"Google sign-in is temporarily unavailable.";
  }
}
function renderAccount(){
  setEmailMode(emailMode);
  const firebaseUser=window.PPHCloud?.user;
  const signed=!!firebaseUser||!!session.token;
  $("accountSignedOut").hidden=signed;$("accountSignedIn").hidden=!signed;
  $("cloudBadge").textContent=signed?t("auth.cloud_linked"):t("cloud.local_only");
  $("cloudBadge").classList.toggle("active",signed);
  const topAccountCta=$("topAccountCta");
  if(topAccountCta)topAccountCta.hidden=!state.profile;
  const dashboardPromo=$("dashboardAccountPromo");
  if(dashboardPromo)dashboardPromo.hidden=signed;
  if(signed){
    $("accountIdentity").textContent=firebaseUser?.email||session.email||"signed-in account";
    if(!$("cloudStatus").textContent)$("cloudStatus").textContent=t("dynamic.cloud_linked");
  }else{
    if(session.pendingEmail){$("accountEmail").value=session.pendingEmail;$("codeStep").hidden=false}
    queueMicrotask(()=>initGoogleSignIn());
  }
}
async function uploadCloud(silent=false){
  if(!session.token&&!window.PPHCloud?.user)return;
  const status=$("cloudStatus");if(!silent)status.textContent=t("dynamic.uploading");
  try{
    if(window.PPHCloud?.user)await window.PPHCloud.upload(cloudPayload());
    else await hubRequest("/profile",{method:"POST",headers:authHeaders(),body:JSON.stringify({profile:cloudPayload()})});
    if(!silent)status.textContent=t("dynamic.upload_complete");
    $("cloudBadge").textContent=t("auth.cloud_linked");
  }catch(err){if(!silent&&status)status.textContent=err.message}
}
async function downloadCloud(){
  const status=$("cloudStatus");status.textContent=t("dynamic.loading_cloud");
  try{
    const profile=window.PPHCloud?.user?await window.PPHCloud.download():(await hubRequest("/profile",{headers:authHeaders()})).profile;
    if(!profile||!Object.keys(profile).length)throw new Error(t("dynamic.no_cloud"));
    applyCloudPayload(profile);status.textContent=t("dynamic.cloud_loaded");
  }catch(err){status.textContent=err.message}
}
function clearSession(){
  delete session.token;delete session.email;delete session.expiresAt;delete session.pendingEmail;saveSession();
  googleButtonRendered=false;
  const googleButton=$("googleSignInButton");if(googleButton)googleButton.replaceChildren();
  renderAccount();
}
async function logoutCloud(){
  if(window.PPHCloud?.user){
    try{await window.PPHCloud.signOut()}catch(err){$("cloudStatus").textContent=err.message;return}
    $("cloudStatus").textContent="";renderAccount();return;
  }
  try{if(session.token)await fetch(HUB_API+"/session",{method:"DELETE",headers:authHeaders()})}catch(e){}
  clearSession();
}
window.PPHFirebaseChanged=renderAccount;

function renderReport(){
  const mm=madeMiss(),attempts=mm.made+mm.miss,body=$("reportBody");
  $("reportTitle").textContent=attempts?t("dynamic.attempts_made",{made:mm.made,attempts:attempts}):t("report.empty");
  const total=liveTotal(),success=attempts?Math.round(mm.made/attempts*1000)/10:0;
  const p=state.profile||{},dots=total?dotsScore(p.sex,p.bodyweight,total):null;
  body.innerHTML="<div class=\"reportCard\"><h3>"+esc(p.meetName||"Meet Day")+"</h3><div class=\"reportGrid\"><div><span>Success rate</span><strong>"+success+"%</strong></div><div><span>Best total</span><strong>"+total+" kg</strong></div><div><span>DOTS</span><strong>"+(dots?dots.toFixed(2):"—")+"</strong></div></div><p style=\"margin-top:14px\">Squat "+(bestMade("squat")||"—")+" · Bench "+(bestMade("bench")||"—")+" · Deadlift "+(bestMade("deadlift")||"—")+"</p></div>";
}

$("saveProfile").addEventListener("click",()=>{
  state.profile={name:$("name").value.trim()||"Athlete",sex:$("sex").value,bodyweight:num($("bodyweight").value),age:parseAge($("age").value),meetDate:$("meetDate").value,meetName:(state.profile&&state.profile.meetName)||"",squatBest:num($("squatBest").value),benchBest:num($("benchBest").value),deadliftBest:num($("deadliftBest").value)};
  state.plan=blankPlan();state.results=blankResults();suggestPlan();save();render();
  document.querySelector('[data-tab="dashboard"]').click();
});
$("editProfile").addEventListener("click",()=>{const p=state.profile||{};$("name").value=p.name||"";$("sex").value=p.sex||"M";$("bodyweight").value=p.bodyweight||"";$("age").value=p.age||"";$("meetDate").value=p.meetDate||"";$("squatBest").value=p.squatBest||"";$("benchBest").value=p.benchBest||"";$("deadliftBest").value=p.deadliftBest||"";delete state.profile;save();render();window.scrollTo({top:0,behavior:"smooth"})});
$("savePlan").addEventListener("click",()=>{save();alert(t("dynamic.plan_saved"))});
$("onboardingImport").addEventListener("click",()=>importAthlete($("onboardingLifter").value,$("onboardingImportStatus"),$("onboardingCandidates")));
$("progressImport").addEventListener("click",()=>importAthlete($("progressLifter").value,$("importStatus"),$("progressCandidates")));
$("onboardingLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("onboardingImport").click()});
$("progressLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("progressImport").click()});
$("resetMeet").addEventListener("click",()=>{if(confirm(t("dynamic.confirm_reset"))){state.results=blankResults();save();renderMeetDay();renderReport()}});
$("oplCsv").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  $("importStatus").textContent="Reading "+file.name+"…";
  try{
    const text=await file.text(),imported=parseMeetRows(text);
    if(!imported.length)throw new Error("No valid powerlifting meet rows were found.");
    state.meets=dedupeMeets([...(state.meets||[]),...imported]);
    const pr=meetPrs(),p=state.profile||{},inferred=inferAthlete(state.meets);
    if(!p.name&&inferred.name)p.name=inferred.name;
    if((inferred.sex==="M"||inferred.sex==="F")&&!p.sex)p.sex=inferred.sex;
    if(!num(p.bodyweight)&&inferred.bodyweight)p.bodyweight=inferred.bodyweight;
    if(!parseAge(p.age)&&inferred.age)p.age=inferred.age;
    if(pr.squat>num(p.squatBest))p.squatBest=pr.squat;
    if(pr.bench>num(p.benchBest))p.benchBest=pr.bench;
    if(pr.deadlift>num(p.deadliftBest))p.deadliftBest=pr.deadlift;
    state.profile=p;save();render();
    $("importStatus").textContent="Imported "+imported.length+" rows. "+state.meets.length+" unique meets stored.";
  }catch(err){$("importStatus").textContent="Import failed: "+err.message}
  e.target.value="";
});
$("clearHistory").addEventListener("click",()=>{if(confirm(t("dynamic.confirm_clear"))){state.meets=[];save();renderProgress()}});
$("competitionSearch").addEventListener("input",renderCompetitionFinder);
$("competitionDateRange").addEventListener("change",renderCompetitionFinder);
$("competitionRadius").addEventListener("change",renderCompetitionFinder);
$("competitionFederation").addEventListener("change",renderCompetitionFinder);
document.querySelectorAll("#competitionScopes button").forEach(btn=>btn.addEventListener("click",()=>{
  competitionScope=btn.dataset.scope||"nearby";
  renderCompetitionFinder();
}));
$("useCurrentLocation").addEventListener("click",()=>useBrowserLocation("competitionStatus"));
$("settingsUseLocation").addEventListener("click",()=>useBrowserLocation("locationStatus"));
$("saveAthleteProfile").addEventListener("click",saveAthleteProfileSettings);
$("birthDate").addEventListener("input",()=>{
  const birthDate=parseBirthDateInput($("birthDate").value);
  $("athleteProfileStatus").textContent="";
  if(!birthDate)return;
  $("profileAge").value=ageFromBirthDate(birthDate)||"";
  $("ageInputHint").textContent=t("settings.age_from_date");
});
$("birthDate").addEventListener("change",()=>{
  const raw=$("birthDate").value.trim();
  if(!raw)return;
  const birthDate=parseBirthDateInput(raw);
  if(!birthDate){$("athleteProfileStatus").textContent=t("settings.invalid_birth_format");return}
  $("birthDate").value=formatBirthDate(birthDate);
  $("profileAge").value=ageFromBirthDate(birthDate)||"";
  $("athleteProfileStatus").textContent="";
  $("ageInputHint").textContent=t("settings.age_from_date");
});
$("profileAge").addEventListener("input",()=>{
  if(!$("birthDate").value)return;
  $("birthDate").value="";
  $("ageInputHint").textContent=t("settings.age_manual");
});
if($("mccullochSetup"))$("mccullochSetup").addEventListener("click",openAthleteProfileSettings);
$("saveHomeLocation").addEventListener("click",saveHomeLocation);
$("runSimulator").addEventListener("click",()=>{
  const p=state.profile||{},bw=num($("simBodyweight").value),total=num($("simTotal").value);
  const currentDots=dotsScore(p.sex,p.bodyweight,currentBestTotal()),simDots=dotsScore(p.sex,bw,total);
  if(!bw||!total||!simDots){$("simResult").textContent=t("dynamic.valid_sim");return}
  const ctx=performanceReference?contextFor(p.sex,bw,simDots):null;
  $("simResult").innerHTML='<strong class="big">'+simDots.toFixed(2)+' DOTS</strong><div class="toolCompare"><div><span>Current</span><strong>'+(currentDots?currentDots.toFixed(2):"—")+' DOTS</strong></div><div><span>Scenario</span><strong>'+simDots.toFixed(2)+' DOTS</strong></div></div>'+(ctx?'<p class="contextMeta">'+esc(ctx.label)+' in nearest '+esc(ctx.row.weight_class_kg)+' kg reference class.</p>':'');
});
$("runGoal").addEventListener("click",()=>{
  const p=state.profile||{},target=num($("goalDots").value),bw=num($("goalBodyweight").value);
  const required=totalForDots(p.sex,bw,target);
  if(!target||!bw||!required){$("goalResult").textContent=t("dynamic.valid_goal");return}
  const gap=round(required-currentBestTotal(),1);
  $("goalResult").innerHTML='<span class="muted">Required total at '+bw+' kg</span><strong class="big">'+required+' kg</strong><p>'+(gap>0?gap+' kg above your current best total.':Math.abs(gap)+' kg below your current best total.')+'</p>';
});
$("saveGoal").addEventListener("click",saveCurrentGoal);
$("saveMeetResult").addEventListener("click",saveMeetToHistory);
$("shareCard").addEventListener("click",shareResultCard);
$("legacyEmailForm").addEventListener("submit",e=>{e.preventDefault();requestLoginCode()});
$("emailModeSignIn").addEventListener("click",()=>setEmailMode("signin",true));
$("emailModeSignUp").addEventListener("click",()=>setEmailMode("signup",true));
$("checkAccountConnection").addEventListener("click",checkAccountConnection);
$("onboardingAccount").addEventListener("click",openAccountFromOnboarding);
$("topAccountCta").addEventListener("click",()=>openAccountTab("signup"));
$("dashboardCreateAccount").addEventListener("click",()=>openAccountTab("signup"));
$("dashboardSignIn").addEventListener("click",()=>openAccountTab("signin"));
$("accountBackToProfile").addEventListener("click",()=>{accountOnly=false;render()});
$("codeStep").addEventListener("submit",e=>{e.preventDefault();verifyLoginCode()});
$("uploadCloud").addEventListener("click",()=>uploadCloud(false));
$("downloadCloud").addEventListener("click",downloadCloud);
$("signOut").addEventListener("click",logoutCloud);
$("languageSelect").addEventListener("change",e=>setLanguage(e.target.value,true));
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
  const target=b.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".tab").forEach(x=>x.hidden=x.id!=="tab-"+target);
  window.scrollTo({top:0,behavior:reducedMotion()?"auto":"smooth"});
}));
$("shareReport").addEventListener("click",async()=>{const mm=madeMiss(),p=state.profile||{},total=liveTotal(),dots=total?dotsScore(p.sex,p.bodyweight,total):null,text=(p.name?p.name+"'s":"My")+" powerlifting meet: "+mm.made+"/"+(mm.made+mm.miss)+" attempts made, "+total+" kg total"+(dots?", "+dots.toFixed(2)+" DOTS":"")+". Built with Powerlifting Performance Hub.";if(navigator.share){await navigator.share({title:"Powerlifting Meet Report",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert(t("dynamic.report_copied"))}});
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
async function initApp(){
  ensureState();
  if(session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())clearSession();
  await initI18n();
  save();render();renderAccount();loadReference();loadCompetitions();
}
initApp();
