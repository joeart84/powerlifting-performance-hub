const KEY="plc-performance-hub-v6";
const LEGACY_KEYS=["plc-performance-hub-v2","plc-performance-hub-v1"];
let legacy={};
for(const k of LEGACY_KEYS){try{const v=JSON.parse(localStorage.getItem(k)||"null");if(v&&Object.keys(v).length){legacy=v;break}}catch(e){}}
// Keep a local recovery copy before replacing malformed stored JSON.
function readStoredObject(key,fallback={}){
  let raw;
  try{
    raw=localStorage.getItem(key);
    const value=JSON.parse(raw||"null");
    if(value===null)return fallback;
    if(typeof value==="object"&&!Array.isArray(value))return value;
    throw new Error("Invalid stored object");
  }catch(e){
    try{if(raw&&!localStorage.getItem(key+"-recovery"))localStorage.setItem(key+"-recovery",raw)}catch(storageError){}
    return fallback;
  }
}
const state=readStoredObject(KEY,legacy||{});
const SESSION_KEY="plc-performance-hub-session-v1";
const session=readStoredObject(SESSION_KEY);
const $=id=>document.getElementById(id);
const lifts=["squat","bench","deadlift"];
const LIFTER_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/lifter";
const LIFTER_SEARCH_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/lifter-search";
const REFERENCE_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/performance-reference";
const HUB_API="https://powerlifting-calculator.com/wp-json/plc-radar/v1/hub";
const GOOGLE_CLIENT_ID="565019863889-dlbtmah64pd38piet2fc27p3251cjpeq.apps.googleusercontent.com";
let performanceReference=null;
let upcomingCompetitions=[];
let competitionFeedMeta={};
let competitionFeedError="";
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
  document.querySelectorAll("[data-score]").forEach(button=>button.setAttribute("aria-label",t("ux.score_info")+": "+t("ux.score_"+button.dataset.score+"_title")));
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key=el.dataset.i18n;
    if(messages[key]!==undefined)el.textContent=t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const key=el.dataset.i18nPlaceholder;
    if(messages[key]!==undefined)el.placeholder=t(key);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{
    const key=el.dataset.i18nTitle;
    if(messages[key]!==undefined)el.title=t(key);
  });
  document.querySelectorAll("[data-i18n-aria]:not([data-score])").forEach(el=>{
    const key=el.dataset.i18nAria;
    if(messages[key]!==undefined)el.setAttribute("aria-label",t(key));
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
  try{localStorage.setItem(KEY,JSON.stringify(state));renderSaveStatus()}catch(error){if($("deviceSaveStatus"))$("deviceSaveStatus").textContent=t("ux.save_failed");throw error}
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
  const next=PPHData.validatePayload(payload);
  localStorage.setItem(KEY,JSON.stringify(next));
  Object.keys(state).forEach(key=>delete state[key]);
  Object.assign(state,next);
  accountOnly=false;profileEditMode=false;
  clearAttemptUndo();renderSaveStatus();render();
}

function dotsScore(sex,bodyweight,total){const value=PPHScoring.dots(sex,num(bodyweight),num(total));return value===null?null:round(value,2)}
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

function reshelCoefficient(sex,bodyweight){return PPHScoring.reshelCoefficient(sex,num(bodyweight))}
function reshelScore(sex,bodyweight,total){return PPHScoring.reshel(sex,num(bodyweight),num(total))}
function mccullochMultiplier(age){return PPHScoring.ageMultiplier(age)}
function mccullochScore(sex,bodyweight,total,age){return PPHScoring.ageAdjustedTotal(num(total),age)}

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
  if(rows.length<2)throw new Error(t("dynamic.csv_no_rows"));
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
      dots:round(dots,2),
      source:"OpenPowerlifting"
    });
  }
  return out.filter(r=>r.total>0).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function meetDedupeKey(m){
  const date=String(m?.date||"").slice(0,10);
  const total=Math.round(num(m?.total)*2)/2;
  const bw=Math.round(num(m?.bodyweight)*10)/10;
  if(date&&total&&bw)return [date,total.toFixed(1),bw.toFixed(1)].join("|");
  return [date,normText(m?.meet||""),total||"",bw||""].join("|");
}
function dedupeMeets(meets){
  const map=new Map();
  (meets||[]).filter(Boolean).forEach(m=>{
    const key=meetDedupeKey(m);
    const existing=map.get(key);
    if(!existing){map.set(key,m);return}
    const incomingIsOpl=String(m.source||"").toLowerCase()==="openpowerlifting";
    const existingIsManual=String(existing.source||"").toLowerCase()==="manual";
    if(incomingIsOpl&&existingIsManual){map.set(key,{...existing,...m});return}
    const merged={...existing};
    Object.entries(m).forEach(([k,v])=>{if(v!==""&&v!==null&&v!==undefined)merged[k]=v});
    map.set(key,merged);
  });
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
  if(!imported.length)throw new Error(t("dynamic.no_valid_results"));
  const manual=(state.meets||[]).filter(m=>String(m?.source||"").toLowerCase()==="manual");
  state.meets=dedupeMeets([...manual,...imported]);
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
  if(!res.ok)throw new Error(payload&&payload.message?payload.message:t("dynamic.athlete_not_found"));
  if(!payload.csv)throw new Error(t("dynamic.no_competition_data"));
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
    card.innerHTML="<div><strong>"+esc(item.name||item.slug)+"</strong><small>"+esc(item.profile_url||"")+"</small></div><button class=\"primary compact\" data-slug=\""+esc(item.slug)+"\">"+esc(t("onboarding.import"))+"</button>";
    candidateEl.appendChild(card);
  });
  candidateEl.querySelectorAll("button[data-slug]").forEach(btn=>btn.addEventListener("click",async()=>{
    candidateEl.innerHTML="";
    try{await fetchAthleteBySlug(btn.dataset.slug,statusEl)}
    catch(err){statusEl.textContent=t("dynamic.import_failed",{message:err.message})}
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
    if(!res.ok)throw new Error(payload&&payload.message?payload.message:t("dynamic.search_failed"));
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
function dotsDenominator(sex,bodyweight){return PPHScoring.dotsDenominator(sex,num(bodyweight))}
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
    if(!res.ok)throw new Error(t("dynamic.reference_unavailable"));
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
  moveBackupCard();
  const showProfileForm=!accountOnly&&(!p||profileEditMode);
  $("dataBackupCard").hidden=!showProfileForm&&$("tab-settings").hidden;
  $("onboarding").hidden=!showProfileForm;
  $("app").hidden=showProfileForm||(!p&&!accountOnly);
  document.querySelector("#app > .heroPanel").hidden=!p;
  document.querySelector("#app > .primaryNav").hidden=!p;
  const utilityNav=document.querySelector("#app > .utilityNav");
  if(utilityNav)utilityNav.hidden=true;
  const topSettingsCta=$("topSettingsCta");
  if(topSettingsCta)topSettingsCta.hidden=!p||profileEditMode;
  const cancelTop=$("cancelProfileEdit"),cancelBottom=$("cancelProfileEditBottom");
  if(cancelTop)cancelTop.hidden=!profileEditMode;
  if(cancelBottom)cancelBottom.hidden=!profileEditMode;
  if($("onboardingImportBlock"))$("onboardingImportBlock").hidden=profileEditMode;
  if($("onboardingOrDivider"))$("onboardingOrDivider").hidden=profileEditMode;
  if($("onboardingAccountCard"))$("onboardingAccountCard").hidden=profileEditMode;
  if($("profileFormTitle"))$("profileFormTitle").textContent=t(profileEditMode?"profile.edit":"onboarding.title");
  if($("profileFormNote"))$("profileFormNote").textContent=t(profileEditMode?"profile.edit_note":"onboarding.note");
  if($("saveProfile"))$("saveProfile").textContent=t(profileEditMode?"profile.save_changes":"profile.create");
  $("accountBackToProfile").hidden=!!p;
  if(!p){
    if(accountOnly)document.querySelectorAll(".tab").forEach(tab=>tab.hidden=tab.id!=="tab-account");
    renderAccount();return;
  }
  ensureState();suggestPlan();
  $("athleteName").textContent=p.name||t("dashboard.your_dashboard");
  setAnimatedMetric("metricBw",p.bodyweight||"—");setAnimatedMetric("metricSq",p.squatBest||"—");setAnimatedMetric("metricBp",p.benchBest||"—");setAnimatedMetric("metricDl",p.deadliftBest||"—");
  $("currentTotal").textContent=currentBestTotal();
  const currentDots=dotsScore(p.sex,p.bodyweight,currentBestTotal());
  const currentReshel=reshelScore(p.sex,p.bodyweight,currentBestTotal());
  const currentAge=profileAge(p);
  const currentMcculloch=mccullochScore(p.sex,p.bodyweight,currentBestTotal(),currentAge);
  $("currentDots").textContent=currentDots?currentDots.toFixed(2):"—";
  $("currentReshel").textContent=currentReshel?currentReshel.toFixed(2):"—";
  $("currentMcculloch").textContent=currentMcculloch?currentMcculloch.toFixed(1):"—";
  $("mccullochNote").textContent=currentMcculloch?t("score.age_factor",{factor:PPHScoring.ageMultiplier(currentAge).toFixed(3)}):t("score.age_range");
  const scoringNotes=[t("score.legacy_note")];
  if(p.bodyweight&&PPHScoring.dotsBodyweight(p.sex,num(p.bodyweight))!==num(p.bodyweight))scoringNotes.push(t("score.dots_boundary",{weight:PPHScoring.dotsBodyweight(p.sex,num(p.bodyweight))}));
  $("scoringNotes").textContent=scoringNotes.join(" ");
  $("mccullochSetup").hidden=!!p.birthDate;
  $("mccullochSetup").textContent=t("dynamic.add_birth_date");
  const d=daysUntil(p.meetDate);
  $("countdown").textContent=p.meetDate?(d>=0?t("dynamic.days_until",{days:d}):t("dynamic.meet_passed")):t("dynamic.add_meet_date");
  $("meetSnapshot").innerHTML="<div><strong>"+esc(t("dynamic.meet_label"))+":</strong> "+esc(p.meetName||t("common.not_set"))+"</div><div><strong>"+esc(t("dynamic.date_label"))+":</strong> "+esc(p.meetDate||t("common.not_set"))+"</div><div><strong>"+esc(t("planner.projected_total"))+":</strong> "+totalFromPlan()+" kg</div><div><strong>"+esc(t("dynamic.current_best"))+":</strong> "+currentBestTotal()+" kg</div><div><strong>"+esc(t("dynamic.current_dots"))+":</strong> "+(currentDots?currentDots.toFixed(2):"—")+"</div>";
  renderGoalSnapshot();renderNextStep();renderSaveStatus();
  renderPlanner();renderMeetDay();renderProgress();renderTools();renderReport();renderAccount();populateLocationSettings();populateAthleteProfileSettings();renderCompetitionFinder();
}

function renderGoalSnapshot(){
  const root=$("goalSnapshot");if(!root)return;
  const gp=goalProgress();
  if(!gp){root.innerHTML='<div class="muted">'+esc(t("dynamic.no_goal"))+'</div>';return}
  root.innerHTML='<div><strong>'+esc(t("dynamic.target"))+':</strong> '+(gp.targetDots?gp.targetDots+" DOTS · ":"")+gp.target+' '+esc(t("dynamic.kg_total"))+'</div>'
    +'<div><strong>'+esc(t("dynamic.target_bw"))+':</strong> '+(gp.targetBodyweight||"—")+' kg</div>'
    +(gp.targetDate?'<div><strong>'+esc(t("dynamic.target_date"))+':</strong> '+esc(gp.targetDate)+'</div>':'')
    +'<div class="goalProgress"><span style="width:'+gp.pct+'%"></span></div>'
    +'<div><strong>'+esc(t("dynamic.of_target",{pct:gp.pct}))+'</strong> · '+esc(gp.gap>0?t("dynamic.to_go",{gap:gp.gap}):t("dynamic.goal_reached"))+'</div>';
}

function renderPlanner(){
  const root=$("plannerRows");root.innerHTML="";
  lifts.forEach(l=>{
    const g=document.createElement("div");g.className="liftGroup";g.innerHTML="<h3>"+esc(t("progress."+l))+"</h3>";
    state.plan[l].forEach((v,i)=>{
      const row=document.createElement("div");row.className="attemptRow";
      const label=t("progress."+l)+" · "+t("planner.attempt")+" "+(i+1);
      row.innerHTML='<label for="weight-'+l+'-'+i+'">'+esc(t("planner.attempt"))+' '+(i+1)+'</label><div class="weightStepper"><button class="ghost" type="button" data-delta="-2.5" aria-label="'+esc(t("ux.decrease",{attempt:label}))+'">−</button><input id="weight-'+l+'-'+i+'" type="text" inputmode="decimal" data-decimal data-min="0" pattern="[0-9]+([.,][0-9]+)?" data-lift="'+l+'" data-idx="'+i+'" value="'+(v||'')+'" placeholder="kg" aria-label="'+esc(label)+'"><button class="ghost" type="button" data-delta="2.5" aria-label="'+esc(t("ux.increase",{attempt:label}))+'">+</button></div>';
      const input=row.querySelector("input");
      const commit=()=>{if(!validateDecimalInput(input))return;clearAttemptUndo();state.plan[l][i]=num(input.value);save();$("projectedTotal").textContent=totalFromPlan()+" kg";renderMeetDay();renderReport();renderNextStep()};
      input.addEventListener("input",commit);
      row.querySelectorAll('[data-delta]').forEach(button=>button.addEventListener("click",()=>{if(!validateDecimalInput(input))return;input.value=PPHUX.adjust(input.value,Number(button.dataset.delta));commit()}));
      g.appendChild(row);
    });root.appendChild(g);
  });
  $("projectedTotal").textContent=totalFromPlan()+" kg";
}

function renderMeetDay(){
  const root=$("meetDayRows");root.innerHTML="";
  lifts.forEach(l=>{
    const g=document.createElement("div");g.className="liftGroup";g.innerHTML="<h3>"+esc(t("progress."+l))+"</h3>";
    state.plan[l].forEach((v,i)=>{
      const val=state.results[l][i],row=document.createElement("div");row.className="attemptRow";
      row.innerHTML="<span>#"+(i+1)+" · "+(v||"—")+" kg</span><div class=\"attemptActions\"><button class=\"good "+(val==="good"?"active":"")+"\" data-r=\"good\" data-lift=\""+l+"\" data-idx=\""+i+"\">"+esc(t("meetday.good"))+"</button><button class=\"miss "+(val==="miss"?"active":"")+"\" data-r=\"miss\" data-lift=\""+l+"\" data-idx=\""+i+"\">"+esc(t("meetday.miss"))+"</button></div>";
      g.appendChild(row);
    });root.appendChild(g);
  });
  root.querySelectorAll(".attemptActions button").forEach(b=>b.addEventListener("click",e=>{
    const lift=e.target.dataset.lift,idx=Number(e.target.dataset.idx),r=e.target.dataset.r;
    updateAttempt(lift,idx,r);
  }));
  const mm=madeMiss();$("madeCount").textContent=mm.made;$("missCount").textContent=mm.miss;$("liveTotal").textContent=liveTotal()+" kg";renderMeetFocus();
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
  rows.innerHTML=meets.slice().reverse().map(m=>{
    const source=String(m.source||"");
    const badge=source.toLowerCase()==="manual"?'<span class="meetSourceBadge">'+esc(t("manual.badge"))+'</span>':"";
    return '<tr><td>'+esc(m.date||"—")+'</td><td>'+esc(m.meet||"—")+badge+'</td><td>'+fmt(m.bodyweight)+'</td><td>'+fmt(m.squat)+'</td><td>'+fmt(m.bench)+'</td><td>'+fmt(m.deadlift)+'</td><td><strong>'+fmt(m.total)+'</strong></td><td>'+fmt(m.dots,2)+'</td></tr>';
  }).join("");
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
function normText(v){
  return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
const COUNTRY_ALIASES={
  "sk":"slovakia","svk":"slovakia","slovensko":"slovakia","slovenska republika":"slovakia",
  "cz":"czech republic","cze":"czech republic","cesko":"czech republic","ceska republika":"czech republic","czechia":"czech republic",
  "at":"austria","aut":"austria","rakusko":"austria",
  "hu":"hungary","hun":"hungary","madarsko":"hungary",
  "pl":"poland","pol":"poland","polsko":"poland",
  "de":"germany","deu":"germany","nemecko":"germany",
  "si":"slovenia","svn":"slovenia","slovinsko":"slovenia",
  "hr":"croatia","hrv":"croatia","chorvatsko":"croatia",
  "rs":"serbia","srb":"serbia","srbsko":"serbia",
  "ua":"ukraine","ukr":"ukraine","ukrajina":"ukraine",
  "gb":"united kingdom","gbr":"united kingdom","great britain":"united kingdom","uk":"united kingdom",
  "us":"united states","usa":"united states","u.s.a.":"united states"
};
function canonicalCountry(v){
  const value=normText(v);
  return COUNTRY_ALIASES[value]||value;
}
function countryMatches(a,b){
  const x=canonicalCountry(a),y=canonicalCountry(b);
  return !!x&&!!y&&x===y;
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
  const home=canonicalCountry((state.preferences||{}).homeCountry);
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
  if(scope==="europe")return EUROPE_COUNTRIES.has(canonicalCountry(m.country));
  if(scope==="country")return p.homeCountry?countryMatches(m.country,p.homeCountry):false;
  if(scope==="nearby"){
    if(distance!==null)return distance<=radius;
    return nearbyCountryFallback(m.country);
  }
  return true;
}
function competitionDaysUntil(m){
  const date=String(m?.start_date||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return num(m?.days_until);
  const start=new Date(date+"T00:00:00Z");
  if(Number.isNaN(start.getTime()))return num(m?.days_until);
  const now=new Date();
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  return Math.floor((start.getTime()-today)/86400000);
}
function filteredCompetitions(){
  const q=normText($("competitionSearch")?.value);
  const range=num($("competitionDateRange")?.value)||90;
  const radius=num($("competitionRadius")?.value)||250;
  const federation=$("competitionFederation")?.value||"";
  const rows=upcomingCompetitions.filter(m=>{
    if(q&&!competitionSearchText(m).includes(q))return false;
    const daysUntil=competitionDaysUntil(m);
    if(daysUntil<0)return false;
    if(range<9999&&daysUntil>range)return false;
    if(federation&&m.federation!==federation)return false;
    return competitionMatchesScope(m,competitionScope,radius);
  }).map(m=>({...m,days_until:competitionDaysUntil(m),_distance:eventDistance(m)}));
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
  competitionFeedError="";
  try{
    const res=await fetch(HUB_API+"/competitions",{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error("Competition feed unavailable ("+res.status+")");
    const data=await res.json();
    upcomingCompetitions=Array.isArray(data.competitions)?data.competitions:[];
    competitionFeedMeta=data&&typeof data.meta==="object"&&data.meta?data.meta:{};
    console.info("[Competitions] feed loaded",{
      returned:upcomingCompetitions.length,
      meta:competitionFeedMeta
    });
  }catch(e){
    console.error("[Competitions] feed load failed",e);
    upcomingCompetitions=[];
    competitionFeedMeta={};
    competitionFeedError=e?.message||String(e);
  }
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
  if(competitionFeedError){
    status.textContent="Competition feed unavailable · "+competitionFeedError;
  }else if(!upcomingCompetitions.length){
    const synced=competitionFeedMeta.synced_at?(" · last sync "+competitionFeedMeta.synced_at):"";
    status.textContent=t("finder.feed_zero")+synced;
  }else if((competitionScope==="nearby"&&!hasLocation&&!p.homeCountry)||(competitionScope==="country"&&!p.homeCountry)){
    status.textContent=t("finder.location_needed")+" · "+t("finder.events_loaded",{count:upcomingCompetitions.length});
  }else{
    status.textContent=t("finder.results_count",{count:rows.length})+" · "+t("finder.events_loaded",{count:upcomingCompetitions.length});
  }
  if(!rows.length){
    const detail=competitionFeedError
      ?t("finder.feed_failed")
      :upcomingCompetitions.length
        ?t("finder.feed_no_filter_match")
        :t("finder.feed_no_events");
    root.innerHTML='<div class="finderEmpty">'+esc(detail)+'</div>';
    return;
  }
  root.innerHTML=rows.slice(0,80).map((m)=>{
    const place=[m.city,m.country].filter(Boolean).join(", ")||m.country||t("common.not_set");
    const distance=m._distance!==null?'<span class="distanceBadge">'+m._distance+' km</span>':"";
    const meta=[m.start_date,m.federation].filter(Boolean).join(" · ");
    const venue=m.venue?'<div class="competitionVenue">'+esc(m.venue)+'</div>':"";
    const selected=(state.profile||{}).meetName===m.event&&(state.profile||{}).meetDate===m.start_date;
    return '<article class="competitionCard">'
      +'<div class="competitionTop"><div><h4>'+esc(m.event||t("finder.generic_meet"))+'</h4><div class="competitionPlace">'+esc(place)+'</div></div>'+distance+'</div>'
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
  p.meetName=m.event||t("finder.generic_meet");
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
    if(!res.ok)throw new Error(data.message||t("finder.location_lookup_failed"));
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
function manualAttemptValues(prefix){
  return [1,2,3].map(i=>num($(prefix+i)?.value)).filter(v=>v!==0);
}
function updateManualMeetPreview(){
  const sq=num($("manualMeetSquat")?.value),bp=num($("manualMeetBench")?.value),dl=num($("manualMeetDeadlift")?.value);
  const bw=num($("manualMeetBw")?.value),total=sq+bp+dl;
  if($("manualMeetTotal"))$("manualMeetTotal").textContent=total?round(total,1)+" kg":"0 kg";
  const dots=total&&bw?dotsScore((state.profile||{}).sex||"M",bw,total):0;
  if($("manualMeetDots"))$("manualMeetDots").textContent=dots?dots.toFixed(2):"—";
}
function setManualMeetOpen(open){
  const form=$("manualMeetForm");
  if(!form)return;
  form.hidden=!open;
  if(open){
    if(!$("manualMeetDate").value)$("manualMeetDate").value=todayIso();
    updateManualMeetPreview();
    requestAnimationFrame(()=>form.scrollIntoView({behavior:"smooth",block:"start"}));
  }
}
function saveManualMeet(event){
  event.preventDefault();
  const form=$("manualMeetForm"),status=$("manualMeetStatus");
  if(!form.checkValidity()){form.reportValidity();return}
  const date=$("manualMeetDate").value;
  const meet=$("manualMeetName").value.trim();
  const bw=num($("manualMeetBw").value);
  const squat=num($("manualMeetSquat").value),bench=num($("manualMeetBench").value),deadlift=num($("manualMeetDeadlift").value);
  const total=squat+bench+deadlift;
  if(!date||!meet||!bw||!total){
    status.textContent=t("manual.invalid");
    return;
  }
  const dots=dotsScore((state.profile||{}).sex||"M",bw,total)||0;
  const record={
    date,
    meet,
    athleteName:(state.profile||{}).name||"",
    athleteSex:(state.profile||{}).sex||"",
    weightClass:"",
    federation:$("manualMeetFederation").value.trim(),
    equipment:$("manualMeetEquipment").value||"Raw",
    bodyweight:bw,
    squat,bench,deadlift,total,
    dots:round(dots,2),
    source:"Manual",
    attempts:{
      squat:manualAttemptValues("manualSq"),
      bench:manualAttemptValues("manualBp"),
      deadlift:manualAttemptValues("manualDl")
    }
  };
  const before=(state.meets||[]).length;
  state.meets=dedupeMeets([...(state.meets||[]),record]);
  const p=state.profile||{};
  p.squatBest=Math.max(num(p.squatBest),squat);
  p.benchBest=Math.max(num(p.benchBest),bench);
  p.deadliftBest=Math.max(num(p.deadliftBest),deadlift);
  state.profile=p;
  save();render();
  status.textContent=(state.meets||[]).length===before?t("manual.updated"):t("manual.saved");
  form.reset();
  $("manualMeetDate").value=todayIso();
  updateManualMeetPreview();
  setManualMeetOpen(false);
}
function openHowTo(){
  const target=document.querySelector('[data-tab="settings"]');
  if(target)target.click();
  requestAnimationFrame(()=>{
    const card=$("hubHowTo");
    if(card)card.scrollIntoView({behavior:"smooth",block:"start"});
  });
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
    meet:p.meetName||t("report.default_meet"),
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
  if(!record)throw new Error(t("dynamic.need_success"));
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1080;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#101214";ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle="#cf2035";ctx.fillRect(0,0,1080,18);
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
    ctx.fillStyle=i>=3?"#ff8797":"#ffffff";ctx.font="800 46px system-ui";ctx.fillText(String(b[1]),x+28,y+118);
  });
  ctx.fillStyle="#a0a7af";ctx.font="500 26px system-ui";ctx.fillText("powerlifting-calculator.com",70,1010);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error(t("dynamic.image_failed"))),"image/png",0.95));
}
async function shareResultCard(){
  try{
    const blob=await makeResultCardBlob();
    const file=new File([blob],"powerlifting-meet-report.png",{type:"image/png"});
    const record=buildMeetRecord(),p=state.profile||{};
    const text=(p.name||"Athlete")+" · "+record.total+" kg total · "+(record.dots?Number(record.dots).toFixed(2)+" DOTS":"Powerlifting meet");
    if(window.PPHNative?.shareImage){await window.PPHNative.shareImage(blob,file.name,text);return}
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
    error.code=data.code;error.status=res.status;
    if(res.status===401&&session.token){clearSession();$("accountStatus").textContent=t("ux.session_expired");}
    throw error;
  }
  return data;
}
function hubAuthRequest(path,values){
  return hubRequest(path,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams(values)});
}
// Same-origin session validation on the backend is unchanged. Form POST avoids IIS OPTIONS interception.
function hubSessionRequest(path,values={}){
  return hubRequest(path,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({...values,session_token:session.token})});
}
let emailMode="signup";
let accountOnly=false;
let profileEditMode=false;
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
  if(!data||typeof data.token!=="string"||!data.token||typeof data.email!=="string"||!Number.isFinite(Date.parse(data.expires_at)))throw new Error(t("auth.server_error"));
  session.token=data.token;
  session.email=data.email;
  session.expiresAt=data.expires_at;
  delete session.pendingEmail;
  saveSession();
  renderAccount();
  if(data.profile&&Object.keys(data.profile).length){
    $("cloudStatus").textContent=t("dynamic.cloud_found");
  }else if(state.profile){
    $("cloudStatus").textContent=t("sync.upload_prompt");
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
      existing.addEventListener("error",()=>reject(new Error(t("auth.google_load_failed"))),{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src="https://accounts.google.com/gsi/client";
    script.async=true;script.defer=true;script.dataset.pphGoogleIdentity="1";
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error(t("auth.google_load_failed")));
    document.head.appendChild(script);
  });
  return googleIdentityPromise;
}
let googleButtonRendered=false;
let googleSignInBusy=false;
let googleIdentityInitialized=false;
async function initGoogleSignIn(){
  const container=$("googleSignInButton"),status=$("googleStatus");
  if(!container||googleButtonRendered||googleSignInBusy||session.token||window.PPHCloud?.user)return;
  if(window.Capacitor?.isNativePlatform?.()){container.hidden=true;status.textContent=t("ux.native_email");return}
  container.hidden=false;
  googleSignInBusy=true;
  try{
    await loadGoogleIdentity();
    if(session.token||window.PPHCloud?.user)return;
    if(!googleIdentityInitialized){window.google.accounts.id.initialize({
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
    });googleIdentityInitialized=true;}
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
    status.textContent=err.message||t("auth.google_unavailable");
  }finally{googleSignInBusy=false}
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
    $("accountIdentity").textContent=firebaseUser?.email||session.email||t("account.signed_in_account");
    if(!$("cloudStatus").textContent)$("cloudStatus").textContent=t("dynamic.cloud_linked");
  }else{
    if(session.pendingEmail){$("accountEmail").value=session.pendingEmail;$("codeStep").hidden=false}
    queueMicrotask(()=>initGoogleSignIn());
  }
  renderSaveStatus();
}
const RESTORE_KEY=KEY+"-before-restore";
let pendingBackup=null;
let dataBusy=false;
let backupReadId=0;
let cloudBusy=false;
let pendingCloudChange=null;
function dataMessage(error){return messages[error?.message]!==undefined?t(error.message):error.message||t("data.invalid")}
function backupSummary(data){return t("backup.summary",{name:data.profile?.name||t("profile.athlete"),meets:data.meets.length,total:num(data.profile?.squatBest)+num(data.profile?.benchBest)+num(data.profile?.deadliftBest)})}
function rememberDevice(){
  const copy=PPHData.backup(cloudPayload(),languagePreference());
  localStorage.setItem(RESTORE_KEY,JSON.stringify(copy));
  $("undoDataChange").hidden=false;
}
function closeBackupPreview(){pendingBackup=null;backupReadId++;$("backupPreview").hidden=true;$("backupFile").value=""}
async function exportBackup(){
  const status=$("backupStatus");
  try{
    const text=JSON.stringify(PPHData.backup(cloudPayload(),languagePreference()),null,2);
    if(new TextEncoder().encode(text).length>PPHData.MAX_BYTES)throw new Error("data.too_large");
    if(window.PPHNative?.exportFile){await window.PPHNative.exportFile(text,"powerlifting-hub-backup-"+todayIso()+".json");status.textContent=t("backup.exported");return}
    const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="powerlifting-hub-backup-"+todayIso()+".json";
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    status.textContent=t("backup.exported");
  }catch(error){status.textContent=dataMessage(error)}
}
async function previewBackup(file){
  const requestId=++backupReadId;pendingBackup=null;$("backupPreview").hidden=true;
  if(!file)return;
  try{
    if(file.size>PPHData.MAX_BYTES)throw new Error("data.too_large");
    const parsed=PPHData.parseBackup(await file.text());
    if(requestId!==backupReadId)return;
    pendingBackup=parsed;$("backupSummary").textContent=backupSummary(parsed.data);
    $("backupPreview").hidden=false;$("backupStatus").textContent="";
  }catch(error){if(requestId===backupReadId)$("backupStatus").textContent=dataMessage(error)}
}
function setDataBusy(value){
  dataBusy=value;
  for(const id of ["restoreBackup","undoDataChange","backupFile","exportBackup","cancelBackup","uploadCloud","downloadCloud"])$(id).disabled=value;
}
async function restoreBackup(){
  if(!pendingBackup||cloudBusy||dataBusy)return;
  setDataBusy(true);
  const copy=pendingBackup;
  try{
    rememberDevice();applyCloudPayload(copy.data);closeBackupPreview();
    if(copy.language!==languagePreference())await setLanguage(copy.language);
    if(state.profile)document.querySelector('[data-tab="settings"]').click();
    $("backupStatus").textContent=t("backup.restored");
  }catch(error){$("backupStatus").textContent=dataMessage(error)}
  finally{setDataBusy(false)}
}
async function undoDataChange(){
  if(cloudBusy||dataBusy)return;
  setDataBusy(true);
  try{
    const previous=PPHData.parseBackup(localStorage.getItem(RESTORE_KEY)||"");
    applyCloudPayload(previous.data);if(previous.language!==languagePreference())await setLanguage(previous.language);
    localStorage.removeItem(RESTORE_KEY);$("undoDataChange").hidden=true;
    if(state.profile)document.querySelector('[data-tab="settings"]').click();
    $("backupStatus").textContent=t("backup.undone");
  }catch(error){$("backupStatus").textContent=dataMessage(error)}
  finally{setDataBusy(false)}
}
function cloudIdentity(){return window.PPHCloud?.user?"firebase:"+window.PPHCloud.user.uid:session.token||""}
function setCloudBusy(value){
  cloudBusy=value;
  for(const id of ["uploadCloud","downloadCloud","confirmCloudChange","cancelCloudChange","restoreBackup","undoDataChange","signOut"])$(id).disabled=value;
  $("accountSignedIn").setAttribute("aria-busy",String(value));
}
async function readCloud(){
  const value=window.PPHCloud?.user?await window.PPHCloud.download():(await hubSessionRequest("/profile/read")).profile;
  if(!value||!Object.keys(value).length)return null;
  return PPHData.validatePayload(value);
}
function closeCloudReview(){pendingCloudChange=null;$("cloudReview").hidden=true}
async function prepareCloudChange(direction){
  if(cloudBusy||dataBusy||!cloudIdentity())return;
  closeCloudReview();setCloudBusy(true);
  const identity=cloudIdentity();let local;
  $("cloudStatus").textContent=t("sync.checking");
  try{
    local=PPHData.validatePayload(cloudPayload());
    const remote=await readCloud();
    if(identity!==cloudIdentity()||PPHData.fingerprint(local)!==PPHData.fingerprint(cloudPayload()))throw new Error("sync.changed");
    if(direction==="download"&&!remote)throw new Error("dynamic.no_cloud");
    if(remote&&PPHData.fingerprint(local)===PPHData.fingerprint(remote)){markCloudSynced(local);$("cloudStatus").textContent=t("sync.same");return}
    pendingCloudChange={direction,identity,local,remote};
    $("cloudReviewSummary").textContent=t("sync.summary",{device:backupSummary(local),cloud:remote?backupSummary(remote):t("sync.empty")});
    $("confirmCloudChange").textContent=t(direction==="upload"?"sync.use_device":"sync.use_cloud");
    $("cloudReview").hidden=false;$("cloudStatus").textContent=t("sync.review_note");
  }catch(error){$("cloudStatus").textContent=dataMessage(error)}
  finally{setCloudBusy(false)}
}
async function confirmCloudChange(){
  if(cloudBusy||dataBusy||!pendingCloudChange)return;
  const change=pendingCloudChange;setCloudBusy(true);
  try{
    const latest=await readCloud();
    const sameRemote=(!latest&&!change.remote)||(latest&&change.remote&&PPHData.fingerprint(latest)===PPHData.fingerprint(change.remote));
    if(change.identity!==cloudIdentity()||!sameRemote||PPHData.fingerprint(change.local)!==PPHData.fingerprint(cloudPayload()))throw new Error("sync.changed");
    if(change.direction==="upload"){
      $("cloudStatus").textContent=t("dynamic.uploading");
      if(window.PPHCloud?.user)await window.PPHCloud.upload(change.local);
      else await hubSessionRequest("/profile/write",{profile:JSON.stringify(change.local)});
      $("cloudStatus").textContent=t("dynamic.upload_complete");
    }else{
      rememberDevice();applyCloudPayload(latest);$("cloudStatus").textContent=t("dynamic.cloud_loaded");
    }
    markCloudSynced(change.direction==="upload"?change.local:latest);closeCloudReview();
  }catch(error){closeCloudReview();$("cloudStatus").textContent=dataMessage(error)}
  finally{setCloudBusy(false)}
}
async function uploadCloud(){return prepareCloudChange("upload")}
async function downloadCloud(){return prepareCloudChange("download")}
$("exportBackup").addEventListener("click",exportBackup);
$("backupFile").addEventListener("change",event=>previewBackup(event.target.files?.[0]));
$("restoreBackup").addEventListener("click",restoreBackup);
$("cancelBackup").addEventListener("click",closeBackupPreview);
$("undoDataChange").addEventListener("click",undoDataChange);
$("confirmCloudChange").addEventListener("click",confirmCloudChange);
$("cancelCloudChange").addEventListener("click",closeCloudReview);
try{$("undoDataChange").hidden=!localStorage.getItem(RESTORE_KEY)}catch(error){}

function clearSession(){
  closeCloudReview();
  delete session.token;delete session.email;delete session.expiresAt;delete session.pendingEmail;saveSession();
  googleButtonRendered=false;
  const googleButton=$("googleSignInButton");if(googleButton)googleButton.replaceChildren();
  renderAccount();
}
async function resetAppData(){
  if(!confirm(t("reset.confirm")))return;
  const button=$("resetAppData"),status=$("resetAppStatus");
  if(button)button.disabled=true;
  if(status)status.textContent=t("reset.working");
  try{
    if(window.PPHCloud?.user){
      try{await window.PPHCloud.signOut()}catch(e){}
    }
    if(session.token){
      try{await hubSessionRequest("/session/revoke")}catch(e){}
    }
    Object.keys(state).forEach(k=>delete state[k]);
    Object.keys(session).forEach(k=>delete session[k]);
    localStorage.removeItem(KEY);localStorage.removeItem(SAVE_META_KEY);localStorage.removeItem(RESTORE_KEY);clearAttemptUndo();
    LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));
    localStorage.removeItem(SESSION_KEY);
    accountOnly=false;
    profileEditMode=false;
    competitionScope="nearby";
    googleButtonRendered=false;
    const googleButton=$("googleSignInButton");if(googleButton)googleButton.replaceChildren();
    ensureState();
    save();
    if(status)status.textContent=t("reset.done");
    render();
    renderAccount();
    window.scrollTo({top:0,behavior:"auto"});
  }finally{
    if(button)button.disabled=false;
  }
}
async function logoutCloud(){
  if(window.PPHCloud?.user){
    try{await window.PPHCloud.signOut()}catch(err){$("cloudStatus").textContent=err.message;return}
    $("cloudStatus").textContent="";renderAccount();return;
  }
  try{if(session.token)await hubSessionRequest("/session/revoke")}catch(e){}
  clearSession();
}
window.PPHFirebaseChanged=renderAccount;

function renderReport(){
  const mm=madeMiss(),attempts=mm.made+mm.miss,body=$("reportBody");
  $("reportTitle").textContent=attempts?t("dynamic.attempts_made",{made:mm.made,attempts:attempts}):t("report.empty");
  const total=liveTotal(),success=attempts?Math.round(mm.made/attempts*1000)/10:0;
  const p=state.profile||{},dots=total?dotsScore(p.sex,p.bodyweight,total):null;
  body.innerHTML="<div class=\"reportCard\"><h3>"+esc(p.meetName||t("nav.meetday"))+"</h3><div class=\"reportGrid\"><div><span>"+esc(t("ux.success_rate"))+"</span><strong>"+success+"%</strong></div><div><span>"+esc(t("meetday.best_total"))+"</span><strong>"+total+" kg</strong></div><div><span>DOTS</span><strong>"+(dots?dots.toFixed(2):"—")+"</strong></div></div><p style=\"margin-top:14px\">"+esc(t("progress.squat"))+" "+(bestMade("squat")||"—")+" · "+esc(t("progress.bench"))+" "+(bestMade("bench")||"—")+" · "+esc(t("progress.deadlift"))+" "+(bestMade("deadlift")||"—")+"</p></div>";
}

function populateProfileForm(){
  const p=state.profile||{};
  $("name").value=p.name||"";
  $("sex").value=p.sex||"M";
  $("bodyweight").value=p.bodyweight||"";
  $("age").value=profileAge(p)||p.age||"";
  $("meetDate").value=p.meetDate||"";
  $("squatBest").value=p.squatBest||"";
  $("benchBest").value=p.benchBest||"";
  $("deadliftBest").value=p.deadliftBest||"";
}
function closeProfileEdit(){
  if(!profileEditMode)return;
  profileEditMode=false;
  render();
  const dashboard=document.querySelector('[data-tab="dashboard"]');
  if(dashboard)dashboard.click();
}
function openProfileEdit(){
  if(!state.profile)return;
  profileEditMode=true;
  populateProfileForm();
  render();
  window.scrollTo({top:0,behavior:reducedMotion()?"auto":"smooth"});
}

$("saveProfile").addEventListener("click",()=>{
  const invalid=["bodyweight","age","squatBest","benchBest","deadliftBest","meetDate"].map($).find(el=>!el.checkValidity());
  if(invalid){$("profileValidationStatus").textContent=t("profile.validation");invalid.reportValidity();invalid.focus();return}
  $("profileValidationStatus").textContent="";
  const existing=state.profile||{};
  const wasEditing=profileEditMode&&!!state.profile;
  state.profile={
    ...existing,
    name:$("name").value.trim()||existing.name||t("profile.athlete"),
    sex:$("sex").value,
    bodyweight:num($("bodyweight").value),
    age:parseAge($("age").value),
    meetDate:$("meetDate").value,
    squatBest:num($("squatBest").value),
    benchBest:num($("benchBest").value),
    deadliftBest:num($("deadliftBest").value)
  };
  if(!wasEditing){
    state.plan=blankPlan();
    state.results=blankResults();
    suggestPlan();
  }else{
    ensureState();
  }
  profileEditMode=false;
  save();render();
  const dashboard=document.querySelector('[data-tab="dashboard"]');
  if(dashboard)dashboard.click();
});
$("editProfile").addEventListener("click",openProfileEdit);
if($("cancelProfileEdit"))$("cancelProfileEdit").addEventListener("click",closeProfileEdit);
if($("cancelProfileEditBottom"))$("cancelProfileEditBottom").addEventListener("click",closeProfileEdit);
$("savePlan").addEventListener("click",()=>{save();alert(t("dynamic.plan_saved"))});
$("onboardingImport").addEventListener("click",()=>importAthlete($("onboardingLifter").value,$("onboardingImportStatus"),$("onboardingCandidates")));
$("progressImport").addEventListener("click",()=>importAthlete($("progressLifter").value,$("importStatus"),$("progressCandidates")));
$("onboardingLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("onboardingImport").click()});
$("progressLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("progressImport").click()});
$("resetMeet").addEventListener("click",()=>{if(confirm(t("dynamic.confirm_reset"))){clearAttemptUndo();state.results=blankResults();save();renderMeetDay();renderReport();renderNextStep()}});
$("oplCsv").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  $("importStatus").textContent=t("dynamic.reading_file",{name:file.name});
  try{
    const text=await file.text(),imported=parseMeetRows(text);
    if(!imported.length)throw new Error(t("dynamic.csv_no_valid_meets"));
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
    $("importStatus").textContent=t("dynamic.csv_imported",{rows:imported.length,count:state.meets.length});
  }catch(err){$("importStatus").textContent=t("dynamic.import_failed",{message:err.message})}
  e.target.value="";
});
$("clearHistory").addEventListener("click",()=>{if(confirm(t("dynamic.confirm_clear"))){state.meets=[];save();renderProgress()}});
if($("toggleManualMeet"))$("toggleManualMeet").addEventListener("click",()=>setManualMeetOpen($("manualMeetForm").hidden));
if($("cancelManualMeet"))$("cancelManualMeet").addEventListener("click",()=>setManualMeetOpen(false));
if($("manualMeetForm"))$("manualMeetForm").addEventListener("submit",saveManualMeet);
["manualMeetBw","manualMeetSquat","manualMeetBench","manualMeetDeadlift"].forEach(id=>{if($(id))$(id).addEventListener("input",updateManualMeetPreview)});
if($("accountHowTo"))$("accountHowTo").addEventListener("click",openHowTo);
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
  $("simResult").innerHTML='<strong class="big">'+simDots.toFixed(2)+' DOTS</strong><div class="toolCompare"><div><span>'+esc(t("dynamic.current"))+'</span><strong>'+(currentDots?currentDots.toFixed(2):"—")+' DOTS</strong></div><div><span>'+esc(t("dynamic.scenario"))+'</span><strong>'+simDots.toFixed(2)+' DOTS</strong></div></div>'+(ctx?'<p class="contextMeta">'+esc(t("dynamic.nearest_reference",{label:ctx.label,weight:ctx.row.weight_class_kg}))+'</p>':'');
});
$("runGoal").addEventListener("click",()=>{
  const p=state.profile||{},target=num($("goalDots").value),bw=num($("goalBodyweight").value);
  const required=totalForDots(p.sex,bw,target);
  if(!target||!bw||!required){$("goalResult").textContent=t("dynamic.valid_goal");return}
  const gap=round(required-currentBestTotal(),1);
  $("goalResult").innerHTML='<span class="muted">'+esc(t("dynamic.required_total",{bw:bw}))+'</span><strong class="big">'+required+' kg</strong><p>'+esc(gap>0?t("dynamic.above_current",{gap:gap}):t("dynamic.below_current",{gap:Math.abs(gap)}))+'</p>';
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
$("accountBackToProfile").addEventListener("click",()=>{accountOnly=false;profileEditMode=false;render()});
$("codeStep").addEventListener("submit",e=>{e.preventDefault();verifyLoginCode()});
$("uploadCloud").addEventListener("click",()=>uploadCloud(false));
$("downloadCloud").addEventListener("click",downloadCloud);
$("signOut").addEventListener("click",logoutCloud);
$("languageSelect").addEventListener("change",e=>setLanguage(e.target.value,true));
if($("resetAppData"))$("resetAppData").addEventListener("click",resetAppData);
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
  const target=b.dataset.tab;
  $("dataBackupCard").hidden=target!=="settings";
  document.querySelectorAll("[data-tab]").forEach(x=>{x.classList.toggle("active",x.dataset.tab===target);x.setAttribute("aria-pressed",String(x.dataset.tab===target))});
  document.querySelectorAll(".tab").forEach(x=>x.hidden=x.id!=="tab-"+target);
  moveBackupCard();renderMeetFocus();
  document.dispatchEvent(new Event("pph:tab-change"));
  window.scrollTo({top:0,behavior:reducedMotion()?"auto":"smooth"});
}));
$("shareReport").addEventListener("click",async()=>{const mm=madeMiss(),p=state.profile||{},total=liveTotal(),dots=total?dotsScore(p.sex,p.bodyweight,total):null,text=(p.name?p.name+"'s":"My")+" powerlifting meet: "+mm.made+"/"+(mm.made+mm.miss)+" attempts made, "+total+" kg total"+(dots?", "+dots.toFixed(2)+" DOTS":"")+". Built with Powerlifting Performance Hub.";if(navigator.share){await navigator.share({title:"Powerlifting Meet Report",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert(t("dynamic.report_copied"))}});
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator&&!window.Capacitor?.isNativePlatform?.())window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
const SAVE_META_KEY=KEY+"-save-meta";
const ATTEMPT_UNDO_KEY=KEY+"-attempt-undo";
let meetFocus=false;
function moveBackupCard(){
  const card=$("dataBackupCard"),slot=$((profileEditMode||!state.profile&&!accountOnly||$("tab-settings").hidden)?"onboardingBackupSlot":"settingsBackupSlot");
  if(card&&slot&&card.parentElement!==slot)slot.appendChild(card);
}
function renderNextStep(){
  if(!state.profile)return;
  const step=PPHUX.nextStep(state.profile,state.plan,state.results);
  $("nextStepTitle").textContent=t("ux.step_"+step);
  $("nextStepNote").textContent=t("ux.note_"+step);
  $("nextStepAction").textContent=t("ux.action_"+step);
  $("nextStepAction").dataset.step=step;
}
function syncAccountIdentity(){return window.PPHCloud?.user?.uid?"firebase:"+window.PPHCloud.user.uid:session.token&&session.email?"email:"+session.email:""}
function saveMeta(){return readStoredObject(SAVE_META_KEY,{})}
function renderSaveStatus(){
  const meta=saveMeta(),identity=syncAccountIdentity();
  const last=meta.syncedIdentity===identity&&meta.syncedAt?new Date(meta.syncedAt).toLocaleString(currentLanguage):"";
  const match=!!identity&&meta.syncedIdentity===identity&&meta.syncedFingerprint===PPHData.fingerprint(cloudPayload());
  const device=t("ux.saved_device")+(navigator.onLine===false?" · "+t("ux.offline"):"");
  const detail=identity?(match?t("ux.synced"):t("ux.unsynced"))+(last?" · "+t("ux.last_sync",{date:last}):""):t("ux.device_only");
  if($("deviceSaveStatus"))$("deviceSaveStatus").textContent=device+" · "+detail;
  if($("accountSyncStatus"))$("accountSyncStatus").textContent=detail;
  if($("cloudBadge")){$("cloudBadge").textContent=match?t("ux.synced_short"):identity?t("ux.unsynced_short"):t("ux.device_short");$("cloudBadge").title=device+" · "+detail;}
}
function markCloudSynced(payload){
  try{localStorage.setItem(SAVE_META_KEY,JSON.stringify({...saveMeta(),syncedAt:new Date().toISOString(),syncedIdentity:syncAccountIdentity(),syncedFingerprint:PPHData.fingerprint(payload)}))}catch(error){}
  renderSaveStatus();
}
function rememberAttempts(){localStorage.setItem(ATTEMPT_UNDO_KEY,JSON.stringify({plan:state.plan,results:state.results}));$("undoAttempt").disabled=false}
function clearAttemptUndo(){localStorage.removeItem(ATTEMPT_UNDO_KEY);if($("undoAttempt"))$("undoAttempt").disabled=true}
function updateAttempt(lift,index,result){
  const weight=num(state.plan[lift]?.[index]);if(weight<=0){$("attemptStatus").textContent=t("ux.need_weight");return}
  rememberAttempts();state.results[lift][index]=state.results[lift][index]===result?"":result;
  save();renderMeetDay();renderReport();renderNextStep();$("attemptStatus").textContent=t("ux.attempt_saved");
}
function undoAttemptChange(){
  try{
    const raw=localStorage.getItem(ATTEMPT_UNDO_KEY);if(!raw)return;
    const previous=JSON.parse(raw),valid=PPHData.validatePayload({...cloudPayload(),plan:previous.plan,results:previous.results});
    state.plan=valid.plan;state.results=valid.results;save();clearAttemptUndo();renderPlanner();renderMeetDay();renderReport();renderNextStep();$("attemptStatus").textContent=t("ux.attempt_undone");
  }catch(error){$("attemptStatus").textContent=dataMessage(error)}
}
function currentAttempt(){return PPHUX.queue(state.plan,state.results).find(a=>!a.result)}
function renderMeetFocus(){
  $("meetFocus").hidden=!meetFocus;$("meetDayRows").hidden=meetFocus;
  document.body.classList.toggle("meetFocusMode",meetFocus&&!$("tab-meetday").hidden);
  $("toggleMeetFocus").textContent=t(meetFocus?"ux.exit_focus":"ux.focus");$("toggleMeetFocus").setAttribute("aria-pressed",String(meetFocus));
  $("undoAttempt").disabled=!localStorage.getItem(ATTEMPT_UNDO_KEY);
  const attempt=currentAttempt();
  $("focusTitle").textContent=attempt?t("progress."+attempt.lift)+" · "+t("planner.attempt")+" "+(attempt.index+1):t("ux.meet_complete");
  $("focusWeight").textContent=attempt?attempt.weight+" kg":liveTotal()+" kg";
  const queue=PPHUX.queue(state.plan,state.results).filter(a=>!a.result),next=queue[1];
  $("focusNext").textContent=next?t("ux.next_attempt",{lift:t("progress."+next.lift),attempt:next.index+1,weight:next.weight}):attempt?t("ux.last_attempt"):t("ux.complete_note");
  $("focusAdjust").hidden=!attempt;$("focusGood").hidden=!attempt;$("focusMiss").hidden=!attempt;
  $("focusGood").disabled=!attempt||attempt.weight<=0;$("focusMiss").disabled=!attempt||attempt.weight<=0;
  $("focusStatus").textContent=attempt&&attempt.weight<=0?t("ux.need_weight"):"";$("focusReport").hidden=!!attempt;
}
function adjustFocusWeight(delta){const attempt=currentAttempt();if(!attempt)return;rememberAttempts();state.plan[attempt.lift][attempt.index]=PPHUX.adjust(String(attempt.weight),delta);save();renderPlanner();renderMeetDay();renderReport();renderNextStep()}
function validateDecimalInput(input){
  const value=input.value.trim(),n=PPHUX.decimal(value);
  const invalid=value!==""&&(n===null||(input.dataset.min!==undefined&&n<Number(input.dataset.min))||(input.dataset.max!==undefined&&n>Number(input.dataset.max)));
  input.setCustomValidity(invalid?t("ux.valid_number"):"");input.setAttribute("aria-invalid",String(invalid));return !invalid;
}
function initDecimalInputs(){document.querySelectorAll('[data-decimal]').forEach(input=>{input.addEventListener("input",()=>validateDecimalInput(input));validateDecimalInput(input)})}
function openScoreInfo(type){
  $("scoreDialogTitle").textContent=t("ux.score_"+type+"_title");$("scoreDialogText").textContent=t("ux.score_"+type+"_note");$("scoreDialog").showModal();
}
function initUX(){
  initDecimalInputs();
  $("nextStepAction").addEventListener("click",()=>{
    const step=$("nextStepAction").dataset.step,target=step==="find"||step==="plan"?"planner":step==="report"?"report":"meetday";
    document.querySelector('[data-tab="'+target+'"]').click();
    if(step==="plan")$("plannerRows").scrollIntoView({block:"start",behavior:reducedMotion()?"auto":"smooth"});
    if(step==="meet"){meetFocus=true;renderMeetFocus()}
  });
  $("toggleMeetFocus").addEventListener("click",()=>{meetFocus=!meetFocus;renderMeetFocus()});
  $("focusGood").addEventListener("click",()=>{const a=currentAttempt();if(a)updateAttempt(a.lift,a.index,"good")});
  $("focusMiss").addEventListener("click",()=>{const a=currentAttempt();if(a)updateAttempt(a.lift,a.index,"miss")});
  $("focusMinus").addEventListener("click",()=>adjustFocusWeight(-2.5));$("focusPlus").addEventListener("click",()=>adjustFocusWeight(2.5));
  $("undoAttempt").addEventListener("click",undoAttemptChange);
  document.querySelectorAll('[data-score]').forEach(button=>button.addEventListener("click",()=>openScoreInfo(button.dataset.score)));
  $("closeScoreDialog").addEventListener("click",()=>$("scoreDialog").close());
  window.addEventListener("online",renderSaveStatus);window.addEventListener("offline",renderSaveStatus);
  window.addEventListener("pph:native-ready",()=>{googleButtonRendered=false;renderAccount()});
}

async function initApp(){
  initUX();
  ensureState();
  if(session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())clearSession();
  await initI18n();
  save();render();renderAccount();loadReference();loadCompetitions();
}
initApp();
