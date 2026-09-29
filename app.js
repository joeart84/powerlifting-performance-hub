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
let performanceReference=null;
let upcomingCompetitions=[];
let suppressCloud=false;
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
async function loadMessages(lang){
  try{
    const res=await fetch("./locales/"+lang+".json",{cache:"no-cache"});
    if(!res.ok)throw new Error("locale");
    return await res.json();
  }catch(e){
    if(lang!=="en"){
      const res=await fetch("./locales/en.json",{cache:"no-cache"});
      return await res.json();
    }
    return {};
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
  renderCompetitionPicker();
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
  statusEl.textContent="Importing "+slug+" from OpenPowerlifting…";
  const res=await fetch(LIFTER_API+"?slug="+encodeURIComponent(slug),{headers:{"Accept":"application/json"}});
  let payload={};
  try{payload=await res.json()}catch(e){}
  if(!res.ok)throw new Error(payload&&payload.message?payload.message:"Athlete profile was not found.");
  if(!payload.csv)throw new Error("No competition data was returned.");
  const imported=parseMeetRows(payload.csv);
  applyImportedAthlete(imported,payload.profile_url||"",payload.slug||slug);
  statusEl.textContent="Imported "+imported.length+" competition result"+(imported.length===1?"":"s")+" from OpenPowerlifting.";
}

function renderCandidates(results,statusEl,candidateEl){
  candidateEl.innerHTML="";
  if(!results.length)return;
  statusEl.textContent=results.length+" matching OpenPowerlifting profiles found. Choose yours:";
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
    statusEl.textContent="Enter a lifter name, username, or paste an OpenPowerlifting profile URL.";
    return;
  }
  const exactSlug=extractLifterSlug(raw);
  const isExact=/\/u\//i.test(raw)||(!/\s/.test(raw)&&/^[a-z0-9_-]+$/i.test(raw));
  try{
    if(isExact&&exactSlug){
      await fetchAthleteBySlug(exactSlug,statusEl);
      return;
    }
    statusEl.textContent="Searching OpenPowerlifting for "+raw+"…";
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
      statusEl.innerHTML="No matching profile found. <span class=\"muted\">Try the exact OpenPowerlifting profile URL.</span>";
    }
  }catch(err){
    statusEl.innerHTML="Import failed: "+esc(err.message)+" <br><span class=\"muted\">Try the exact OpenPowerlifting profile URL.</span>";
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
  if(p==null)return "Reference unavailable";
  if(p>=99)return "Top ~1%";
  if(p>=95)return "Top ~5%";
  if(p>=90)return "Top ~10%";
  if(p>=75)return "Top ~25%";
  if(p>=50)return "Above median";
  if(p>=25)return "25th–50th percentile";
  return "Below 25th percentile";
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
    box.innerHTML='<div class="muted">Reference data is loading or not available yet.</div>';
  }else if(!dots){
    box.innerHTML='<div class="muted">Add bodyweight and a current total to calculate strength context.</div>';
  }else{
    const ctx=contextFor(p.sex,p.bodyweight,dots,latestWeightClass());
    if(!ctx)box.innerHTML='<div class="muted">No suitable reference class is available.</div>';
    else{
      const pct=ctx.percentile==null?"—":ctx.percentile+"th";
      box.innerHTML='<div class="contextHero"><div><span class="muted">Estimated percentile</span><strong>'+pct+'</strong></div><div><span class="muted">Context</span><strong>'+esc(ctx.label)+'</strong></div></div><div class="contextScale"><span style="width:'+Math.max(2,ctx.percentile||0)+'%"></span></div><div class="contextMeta">Reference class: '+esc(ctx.row.weight_class_kg)+' kg · n='+Number(ctx.row.n).toLocaleString()+' · Raw full-power · '+esc(performanceReference.analysis_window||"")+'</div>';
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
  $("onboarding").hidden=!!p;$("app").hidden=!p;
  if(!p)return;
  ensureState();suggestPlan();
  $("athleteName").textContent=p.name||"Your dashboard";
  $("metricBw").textContent=p.bodyweight||"—";$("metricSq").textContent=p.squatBest||"—";$("metricBp").textContent=p.benchBest||"—";$("metricDl").textContent=p.deadliftBest||"—";
  $("currentTotal").textContent=currentBestTotal();
  const currentDots=dotsScore(p.sex,p.bodyweight,currentBestTotal());
  $("currentDots").textContent=currentDots?currentDots.toFixed(2):"—";
  const d=daysUntil(p.meetDate);
  $("countdown").textContent=p.meetDate?(d>=0?t("dynamic.days_until",{days:d}):t("dynamic.meet_passed")):t("dynamic.add_meet_date");
  $("meetSnapshot").innerHTML="<div><strong>"+esc(t("dynamic.meet_label"))+":</strong> "+esc(p.meetName||t("common.not_set"))+"</div><div><strong>"+esc(t("dynamic.date_label"))+":</strong> "+esc(p.meetDate||t("common.not_set"))+"</div><div><strong>"+esc(t("planner.projected_total"))+":</strong> "+totalFromPlan()+" kg</div><div><strong>"+esc(t("dynamic.current_best"))+":</strong> "+currentBestTotal()+" kg</div><div><strong>"+esc(t("dynamic.current_dots"))+":</strong> "+(currentDots?currentDots.toFixed(2):"—")+"</div>";
  renderGoalSnapshot();
  renderPlanner();renderMeetDay();renderProgress();renderTools();renderReport();renderAccount();
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
      row.innerHTML="<span>#"+(i+1)+" · "+(v||"—")+" kg</span><div class=\"attemptActions\"><button class=\"good "+(val==="good"?"active":"")+"\" data-r=\"good\" data-lift=\""+l+"\" data-idx=\""+i+"\">Good</button><button class=\"miss "+(val==="miss"?"active":"")+"\" data-r=\"miss\" data-lift=\""+l+"\" data-idx=\""+i+"\">Miss</button></div>";
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
    ["Best total",pr.total?pr.total+" kg":"—"],
    ["Best DOTS",pr.dots||"—"],
    ["Best squat",pr.squat?pr.squat+" kg":"—"],
    ["Best bench",pr.bench?pr.bench+" kg":"—"],
    ["Best deadlift",pr.deadlift?pr.deadlift+" kg":"—"]
  ].map(x=>'<article class="metric"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>').join("");
  $("totalChart").innerHTML=svgChart(meets,"total");
  $("dotsChart").innerHTML=svgChart(meets,"dots");
  rows.innerHTML=meets.slice().reverse().map(m=>'<tr><td>'+esc(m.date||"—")+'</td><td>'+esc(m.meet||"—")+'</td><td>'+fmt(m.bodyweight)+'</td><td>'+fmt(m.squat)+'</td><td>'+fmt(m.bench)+'</td><td>'+fmt(m.deadlift)+'</td><td><strong>'+fmt(m.total)+'</strong></td><td>'+fmt(m.dots,2)+'</td></tr>').join("");
  if(!meets.length)rows.innerHTML='<tr><td colspan="8" class="muted">'+esc(t("dynamic.no_history"))+'</td></tr>';
}
function fmt(v,d=1){const n=num(v);return n?n.toFixed(d).replace(/\.0$/,""):"—"}

async function loadCompetitions(){
  try{
    const res=await fetch(HUB_API+"/competitions",{headers:{"Accept":"application/json"}});
    if(!res.ok)throw new Error("Competition feed unavailable");
    const data=await res.json();
    upcomingCompetitions=Array.isArray(data.competitions)?data.competitions:[];
  }catch(e){upcomingCompetitions=[]}
  renderCompetitionPicker();
}
function renderCompetitionPicker(){
  const sel=$("competitionSelect"),status=$("competitionStatus");
  if(!sel)return;
  const p=state.profile||{};
  const options=['<option value="">Select an upcoming meet</option>'];
  upcomingCompetitions.forEach((m,i)=>{
    const label=[m.start_date,m.event,m.country].filter(Boolean).join(" · ");
    options.push('<option value="'+i+'">'+esc(label)+'</option>');
  });
  sel.innerHTML=options.join("");
  status.textContent=upcomingCompetitions.length
    ? upcomingCompetitions.length+" upcoming meet"+(upcomingCompetitions.length===1?"":"s")+" available."
    : "No upcoming crawler events are available right now. You can still enter a meet date manually.";
  if(p.meetName){
    const idx=upcomingCompetitions.findIndex(m=>m.event===p.meetName&&m.start_date===p.meetDate);
    if(idx>=0)sel.value=String(idx);
  }
}
function chooseCompetition(){
  const idx=Number($("competitionSelect").value);
  if(!Number.isInteger(idx)||idx<0||!upcomingCompetitions[idx]){
    $("competitionStatus").textContent="Choose a competition first.";return;
  }
  const m=upcomingCompetitions[idx],p=state.profile||{};
  p.meetName=m.event||"Powerlifting meet";
  p.meetDate=m.start_date||"";
  p.meetCountry=m.country||"";
  p.meetFederation=m.federation||"";
  p.meetUrl=m.url||"";
  state.profile=p;save();render();
  $("competitionStatus").textContent="Next meet saved: "+p.meetName+".";
}
function saveCurrentGoal(){
  const p=state.profile||{},targetDots=num($("goalDots").value),bw=num($("goalBodyweight").value);
  const targetTotal=totalForDots(p.sex,bw,targetDots);
  if(!targetDots||!bw||!targetTotal){$("goalResult").textContent="Calculate a valid target first.";return}
  state.goal={targetDots,targetBodyweight:bw,targetTotal,targetDate:$("goalDate").value||""};
  save();renderGoalSnapshot();
  $("goalResult").innerHTML='<strong class="big">Goal saved</strong><p>'+targetDots+' DOTS at '+bw+' kg requires about '+targetTotal+' kg total.</p>';
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
  if(!record){$("reportStatus").textContent="Record at least one successful lift before saving the meet.";return}
  state.meets=dedupeMeets([...(state.meets||[]),record]);
  const p=state.profile||{};
  p.squatBest=Math.max(num(p.squatBest),record.squat);
  p.benchBest=Math.max(num(p.benchBest),record.bench);
  p.deadliftBest=Math.max(num(p.deadliftBest),record.deadlift);
  state.profile=p;save();render();
  $("reportStatus").textContent="Meet result saved to your Progress history.";
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
      $("reportStatus").textContent="Result card saved as a PNG image.";
    }
  }catch(err){$("reportStatus").textContent=err.message}
}
function authHeaders(){
  return session.token?{"Accept":"application/json","Content-Type":"application/json","Authorization":"Bearer "+session.token}:{"Accept":"application/json","Content-Type":"application/json"};
}
async function requestLoginCode(){
  const email=$("accountEmail").value.trim(),status=$("accountStatus");
  status.textContent="Sending code…";
  try{
    const res=await fetch(HUB_API+"/auth/request-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
    const data=await res.json();
    if(!res.ok)throw new Error(data.message||"Could not send code.");
    session.pendingEmail=email;saveSession();$("codeStep").hidden=false;
    status.textContent="Code sent. Check your email; it expires in 10 minutes.";
  }catch(err){status.textContent=err.message}
}
async function verifyLoginCode(){
  const email=(session.pendingEmail||$("accountEmail").value).trim(),code=$("accountCode").value.trim(),status=$("accountStatus");
  status.textContent="Signing in…";
  try{
    const res=await fetch(HUB_API+"/auth/verify-code",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})});
    const data=await res.json();
    if(!res.ok)throw new Error(data.message||"Could not sign in.");
    session.token=data.token;session.email=data.email;session.expiresAt=data.expires_at;delete session.pendingEmail;saveSession();
    renderAccount();
    if(data.profile&&Object.keys(data.profile).length){
      $("cloudStatus").textContent="Cloud data found. Choose Load cloud data to replace this device, or Upload this device to keep your local version.";
    }else{
      await uploadCloud(false);
    }
  }catch(err){status.textContent=err.message}
}
function renderAccount(){
  const signed=!!session.token;
  $("accountSignedOut").hidden=signed;$("accountSignedIn").hidden=!signed;
  $("cloudBadge").textContent=signed?"Cloud linked":"Local only";
  $("cloudBadge").classList.toggle("active",signed);
  if(signed){
    $("accountIdentity").textContent=session.email||"signed-in account";
    if(!$("cloudStatus").textContent)$("cloudStatus").textContent="Cloud account linked. Use Upload this device or Load cloud data when you want to sync.";
  }else if(session.pendingEmail){
    $("accountEmail").value=session.pendingEmail;$("codeStep").hidden=false;
  }
}
async function uploadCloud(silent=false){
  if(!session.token)return;
  const status=$("cloudStatus");if(!silent)status.textContent="Uploading…";
  try{
    const res=await fetch(HUB_API+"/profile",{method:"POST",headers:authHeaders(),body:JSON.stringify({profile:cloudPayload()})});
    const data=await res.json();
    if(res.status===401){clearSession();throw new Error("Session expired. Sign in again.")}
    if(!res.ok)throw new Error(data.message||"Cloud sync failed.");
    if(!silent)status.textContent="Cloud upload complete.";
    $("cloudBadge").textContent="Cloud linked";
  }catch(err){if(!silent&&status)status.textContent=err.message}
}
async function downloadCloud(){
  const status=$("cloudStatus");status.textContent="Loading cloud data…";
  try{
    const res=await fetch(HUB_API+"/profile",{headers:authHeaders()});
    const data=await res.json();
    if(res.status===401){clearSession();throw new Error("Session expired. Sign in again.")}
    if(!res.ok)throw new Error(data.message||"Could not load cloud data.");
    if(!data.profile||!Object.keys(data.profile).length)throw new Error("No cloud profile has been saved yet.");
    applyCloudPayload(data.profile);status.textContent="Cloud data loaded onto this device.";
  }catch(err){status.textContent=err.message}
}
function clearSession(){
  delete session.token;delete session.email;delete session.expiresAt;delete session.pendingEmail;saveSession();renderAccount();
}
async function logoutCloud(){
  try{if(session.token)await fetch(HUB_API+"/session",{method:"DELETE",headers:authHeaders()})}catch(e){}
  clearSession();
}

function renderReport(){
  const mm=madeMiss(),attempts=mm.made+mm.miss,body=$("reportBody");
  $("reportTitle").textContent=attempts?mm.made+"/"+attempts+" attempts made":"Complete the meet to build your report";
  const total=liveTotal(),success=attempts?Math.round(mm.made/attempts*1000)/10:0;
  const p=state.profile||{},dots=total?dotsScore(p.sex,p.bodyweight,total):null;
  body.innerHTML="<div class=\"reportCard\"><h3>"+esc(p.meetName||"Meet Day")+"</h3><div class=\"reportGrid\"><div><span>Success rate</span><strong>"+success+"%</strong></div><div><span>Best total</span><strong>"+total+" kg</strong></div><div><span>DOTS</span><strong>"+(dots?dots.toFixed(2):"—")+"</strong></div></div><p style=\"margin-top:14px\">Squat "+(bestMade("squat")||"—")+" · Bench "+(bestMade("bench")||"—")+" · Deadlift "+(bestMade("deadlift")||"—")+"</p></div>";
}

$("saveProfile").addEventListener("click",()=>{
  state.profile={name:$("name").value.trim()||"Athlete",sex:$("sex").value,bodyweight:num($("bodyweight").value),meetDate:$("meetDate").value,meetName:(state.profile&&state.profile.meetName)||"",squatBest:num($("squatBest").value),benchBest:num($("benchBest").value),deadliftBest:num($("deadliftBest").value)};
  state.plan=blankPlan();state.results=blankResults();suggestPlan();save();render();
});
$("editProfile").addEventListener("click",()=>{const p=state.profile||{};$("name").value=p.name||"";$("sex").value=p.sex||"M";$("bodyweight").value=p.bodyweight||"";$("meetDate").value=p.meetDate||"";$("squatBest").value=p.squatBest||"";$("benchBest").value=p.benchBest||"";$("deadliftBest").value=p.deadliftBest||"";delete state.profile;save();render();window.scrollTo({top:0,behavior:"smooth"})});
$("savePlan").addEventListener("click",()=>{save();alert("Attempt plan saved on this device.")});
$("onboardingImport").addEventListener("click",()=>importAthlete($("onboardingLifter").value,$("onboardingImportStatus"),$("onboardingCandidates")));
$("progressImport").addEventListener("click",()=>importAthlete($("progressLifter").value,$("importStatus"),$("progressCandidates")));
$("onboardingLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("onboardingImport").click()});
$("progressLifter").addEventListener("keydown",e=>{if(e.key==="Enter")$("progressImport").click()});
$("resetMeet").addEventListener("click",()=>{if(confirm("Reset all meet-day results?")){state.results=blankResults();save();renderMeetDay();renderReport()}});
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
    if(pr.squat>num(p.squatBest))p.squatBest=pr.squat;
    if(pr.bench>num(p.benchBest))p.benchBest=pr.bench;
    if(pr.deadlift>num(p.deadliftBest))p.deadliftBest=pr.deadlift;
    state.profile=p;save();render();
    $("importStatus").textContent="Imported "+imported.length+" rows. "+state.meets.length+" unique meets stored.";
  }catch(err){$("importStatus").textContent="Import failed: "+err.message}
  e.target.value="";
});
$("clearHistory").addEventListener("click",()=>{if(confirm("Remove all imported competition history from this device?")){state.meets=[];save();renderProgress()}});
$("useCompetition").addEventListener("click",chooseCompetition);
$("runSimulator").addEventListener("click",()=>{
  const p=state.profile||{},bw=num($("simBodyweight").value),total=num($("simTotal").value);
  const currentDots=dotsScore(p.sex,p.bodyweight,currentBestTotal()),simDots=dotsScore(p.sex,bw,total);
  if(!bw||!total||!simDots){$("simResult").textContent="Enter a valid bodyweight and projected total.";return}
  const ctx=performanceReference?contextFor(p.sex,bw,simDots):null;
  $("simResult").innerHTML='<strong class="big">'+simDots.toFixed(2)+' DOTS</strong><div class="toolCompare"><div><span>Current</span><strong>'+(currentDots?currentDots.toFixed(2):"—")+' DOTS</strong></div><div><span>Scenario</span><strong>'+simDots.toFixed(2)+' DOTS</strong></div></div>'+(ctx?'<p class="contextMeta">'+esc(ctx.label)+' in nearest '+esc(ctx.row.weight_class_kg)+' kg reference class.</p>':'');
});
$("runGoal").addEventListener("click",()=>{
  const p=state.profile||{},target=num($("goalDots").value),bw=num($("goalBodyweight").value);
  const required=totalForDots(p.sex,bw,target);
  if(!target||!bw||!required){$("goalResult").textContent="Enter a valid target DOTS and bodyweight.";return}
  const gap=round(required-currentBestTotal(),1);
  $("goalResult").innerHTML='<span class="muted">Required total at '+bw+' kg</span><strong class="big">'+required+' kg</strong><p>'+(gap>0?gap+' kg above your current best total.':Math.abs(gap)+' kg below your current best total.')+'</p>';
});
$("saveGoal").addEventListener("click",saveCurrentGoal);
$("saveMeetResult").addEventListener("click",saveMeetToHistory);
$("shareCard").addEventListener("click",shareResultCard);
$("requestCode").addEventListener("click",requestLoginCode);
$("verifyCode").addEventListener("click",verifyLoginCode);
$("uploadCloud").addEventListener("click",()=>uploadCloud(false));
$("downloadCloud").addEventListener("click",downloadCloud);
$("signOut").addEventListener("click",logoutCloud);
$("accountCode").addEventListener("keydown",e=>{if(e.key==="Enter")verifyLoginCode()});
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab").forEach(x=>x.hidden=x.id!=="tab-"+b.dataset.tab)}));
$("shareReport").addEventListener("click",async()=>{const mm=madeMiss(),p=state.profile||{},total=liveTotal(),dots=total?dotsScore(p.sex,p.bodyweight,total):null,text=(p.name?p.name+"'s":"My")+" powerlifting meet: "+mm.made+"/"+(mm.made+mm.miss)+" attempts made, "+total+" kg total"+(dots?", "+dots.toFixed(2)+" DOTS":"")+". Built with Powerlifting Performance Hub.";if(navigator.share){await navigator.share({title:"Powerlifting Meet Report",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert("Report copied to clipboard.")}});
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
ensureState();
if(session.expiresAt&&Date.parse(session.expiresAt)<=Date.now())clearSession();
save();render();renderAccount();loadReference();loadCompetitions();