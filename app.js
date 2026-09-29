const KEY="plc-performance-hub-v2";
const LEGACY_KEY="plc-performance-hub-v1";
const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||"{}");
const state=JSON.parse(localStorage.getItem(KEY)||"null")||legacy||{};
const $=id=>document.getElementById(id);
const lifts=["squat","bench","deadlift"];

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function num(v){const n=Number(String(v??"").replace(",",".").trim());return Number.isFinite(n)?n:0}
function blankPlan(){return {squat:[0,0,0],bench:[0,0,0],deadlift:[0,0,0]}}
function blankResults(){return {squat:["","",""],bench:["","",""],deadlift:["","",""]}}
function ensureState(){state.plan=state.plan||blankPlan();state.results=state.results||blankResults();state.meets=Array.isArray(state.meets)?state.meets:[]}
function totalFromPlan(){return lifts.reduce((sum,l)=>sum+Math.max.apply(null,state.plan[l].map(num)),0)}
function currentBestTotal(){const p=state.profile||{};return num(p.squatBest)+num(p.benchBest)+num(p.deadliftBest)}
function bestMade(lift){let best=0;(state.results[lift]||[]).forEach((r,i)=>{if(r==="good")best=Math.max(best,num(state.plan[lift][i]))});return best}
function liveTotal(){return lifts.reduce((s,l)=>s+bestMade(l),0)}
function madeMiss(){let made=0,miss=0;lifts.forEach(l=>(state.results[l]||[]).forEach(r=>{if(r==="good")made++;if(r==="miss")miss++}));return{made,miss}}
function suggestPlan(){ensureState();const p=state.profile||{};const ratios=[.90,.96,1.01];lifts.forEach(l=>{const best=num(p[l+"Best"]);if(best&&!state.plan[l].some(num)){state.plan[l]=ratios.map(r=>Math.round(best*r/2.5)*2.5)}})}
function daysUntil(date){if(!date)return null;const d=new Date(date+"T12:00:00"),now=new Date();return Math.ceil((d-now)/86400000)}
function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}
function round(v,d=2){const p=10**d;return Math.round(v*p)/p}

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
function meetPrs(){
  const meets=state.meets||[];
  const max=k=>meets.reduce((m,r)=>Math.max(m,num(r[k])),0);
  return {squat:max("squat"),bench:max("bench"),deadlift:max("deadlift"),total:max("total"),dots:round(max("dots"),2)};
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
  $("countdown").textContent=p.meetDate?(d>=0?d+" days until your next meet":"Meet date has passed"):"Add a meet date to start the countdown.";
  $("meetSnapshot").innerHTML="<div><strong>Meet date:</strong> "+esc(p.meetDate||"Not set")+"</div><div><strong>Projected total:</strong> "+totalFromPlan()+" kg</div><div><strong>Current best total:</strong> "+currentBestTotal()+" kg</div><div><strong>Current DOTS:</strong> "+(currentDots?currentDots.toFixed(2):"—")+"</div>";
  renderPlanner();renderMeetDay();renderProgress();renderReport();
}

function renderPlanner(){
  const root=$("plannerRows");root.innerHTML="";
  lifts.forEach(l=>{
    const g=document.createElement("div");g.className="liftGroup";g.innerHTML="<h3>"+l+"</h3>";
    state.plan[l].forEach((v,i)=>{
      const row=document.createElement("div");row.className="attemptRow";
      row.innerHTML="<span>Attempt "+(i+1)+"</span><input type=\"number\" step=\"2.5\" data-lift=\""+l+"\" data-idx=\""+i+"\" value=\""+(v||"")+"\" placeholder=\"kg\">";
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
  if(data.length<2)return '<div class="chartEmpty">Import at least two meets to show progress.</div>';
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
  status.textContent=meets.length?meets.length+" competition result"+(meets.length===1?"":"s")+" stored on this device.":"No competition history imported yet.";
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
  if(!meets.length)rows.innerHTML='<tr><td colspan="8" class="muted">No meet history yet.</td></tr>';
}
function fmt(v,d=1){const n=num(v);return n?n.toFixed(d).replace(/\.0$/,""):"—"}

function renderReport(){
  const mm=madeMiss(),attempts=mm.made+mm.miss,body=$("reportBody");
  $("reportTitle").textContent=attempts?mm.made+"/"+attempts+" attempts made":"Complete the meet to build your report";
  const total=liveTotal(),success=attempts?Math.round(mm.made/attempts*1000)/10:0;
  const p=state.profile||{},dots=total?dotsScore(p.sex,p.bodyweight,total):null;
  body.innerHTML="<div class=\"reportCard\"><div class=\"reportGrid\"><div><span>Success rate</span><strong>"+success+"%</strong></div><div><span>Best total</span><strong>"+total+" kg</strong></div><div><span>DOTS</span><strong>"+(dots?dots.toFixed(2):"—")+"</strong></div></div><p style=\"margin-top:14px\">Squat "+(bestMade("squat")||"—")+" · Bench "+(bestMade("bench")||"—")+" · Deadlift "+(bestMade("deadlift")||"—")+"</p></div>";
}

$("saveProfile").addEventListener("click",()=>{
  state.profile={name:$("name").value.trim()||"Athlete",sex:$("sex").value,bodyweight:num($("bodyweight").value),meetDate:$("meetDate").value,squatBest:num($("squatBest").value),benchBest:num($("benchBest").value),deadliftBest:num($("deadliftBest").value)};
  state.plan=blankPlan();state.results=blankResults();suggestPlan();save();render();
});
$("editProfile").addEventListener("click",()=>{const p=state.profile||{};$("name").value=p.name||"";$("sex").value=p.sex||"M";$("bodyweight").value=p.bodyweight||"";$("meetDate").value=p.meetDate||"";$("squatBest").value=p.squatBest||"";$("benchBest").value=p.benchBest||"";$("deadliftBest").value=p.deadliftBest||"";delete state.profile;save();render();window.scrollTo({top:0,behavior:"smooth"})});
$("savePlan").addEventListener("click",()=>{save();alert("Attempt plan saved on this device.")});
$("resetMeet").addEventListener("click",()=>{if(confirm("Reset all meet-day results?")){state.results=blankResults();save();renderMeetDay();renderReport()}});
$("oplCsv").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  $("importStatus").textContent="Reading "+file.name+"…";
  try{
    const text=await file.text(),imported=parseMeetRows(text);
    if(!imported.length)throw new Error("No valid powerlifting meet rows were found.");
    state.meets=dedupeMeets([...(state.meets||[]),...imported]);
    const pr=meetPrs(),p=state.profile||{};
    if(pr.squat>num(p.squatBest))p.squatBest=pr.squat;
    if(pr.bench>num(p.benchBest))p.benchBest=pr.bench;
    if(pr.deadlift>num(p.deadliftBest))p.deadliftBest=pr.deadlift;
    state.profile=p;save();render();
    $("importStatus").textContent="Imported "+imported.length+" rows. "+state.meets.length+" unique meets stored.";
  }catch(err){$("importStatus").textContent="Import failed: "+err.message}
  e.target.value="";
});
$("clearHistory").addEventListener("click",()=>{if(confirm("Remove all imported competition history from this device?")){state.meets=[];save();renderProgress()}});
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab").forEach(x=>x.hidden=x.id!=="tab-"+b.dataset.tab)}));
$("shareReport").addEventListener("click",async()=>{const mm=madeMiss(),p=state.profile||{},total=liveTotal(),dots=total?dotsScore(p.sex,p.bodyweight,total):null,text=(p.name?p.name+"'s":"My")+" powerlifting meet: "+mm.made+"/"+(mm.made+mm.miss)+" attempts made, "+total+" kg total"+(dots?", "+dots.toFixed(2)+" DOTS":"")+". Built with Powerlifting Performance Hub.";if(navigator.share){await navigator.share({title:"Powerlifting Meet Report",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert("Report copied to clipboard.")}});
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
ensureState();save();render();