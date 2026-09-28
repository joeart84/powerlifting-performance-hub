const KEY="plc-performance-hub-v1";
const state=JSON.parse(localStorage.getItem(KEY)||"{}");
const $=id=>document.getElementById(id);
const lifts=["squat","bench","deadlift"];

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function num(v){return Number(v||0)}
function blankPlan(){return {squat:[0,0,0],bench:[0,0,0],deadlift:[0,0,0]}}
function blankResults(){return {squat:["","",""],bench:["","",""],deadlift:["","",""]}}
function ensureState(){state.plan=state.plan||blankPlan();state.results=state.results||blankResults()}
function totalFromPlan(){return lifts.reduce((sum,l)=>sum+Math.max.apply(null,state.plan[l].map(num)),0)}
function currentBestTotal(){const p=state.profile||{};return num(p.squatBest)+num(p.benchBest)+num(p.deadliftBest)}
function bestMade(lift){let best=0;(state.results[lift]||[]).forEach((r,i)=>{if(r==="good")best=Math.max(best,num(state.plan[lift][i]))});return best}
function liveTotal(){return lifts.reduce((s,l)=>s+bestMade(l),0)}
function madeMiss(){let made=0,miss=0;lifts.forEach(l=>(state.results[l]||[]).forEach(r=>{if(r==="good")made++;if(r==="miss")miss++}));return{made,miss}}
function suggestPlan(){ensureState();const p=state.profile||{};const ratios=[.90,.96,1.01];lifts.forEach(l=>{const best=num(p[l+"Best"]);if(best&&!state.plan[l].some(num)){state.plan[l]=ratios.map(r=>Math.round(best*r/2.5)*2.5)}})}
function daysUntil(date){if(!date)return null;const d=new Date(date+"T12:00:00"),now=new Date();return Math.ceil((d-now)/(86400000))}
function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}

function render(){
  const p=state.profile;
  $("onboarding").hidden=!!p;$("app").hidden=!p;
  if(!p)return;
  ensureState();suggestPlan();
  $("athleteName").textContent=p.name||"Your dashboard";
  $("metricBw").textContent=p.bodyweight||"—";$("metricSq").textContent=p.squatBest||"—";$("metricBp").textContent=p.benchBest||"—";$("metricDl").textContent=p.deadliftBest||"—";
  $("currentTotal").textContent=currentBestTotal();
  const d=daysUntil(p.meetDate);
  $("countdown").textContent=p.meetDate?(d>=0?d+" days until your next meet":"Meet date has passed"):"Add a meet date to start the countdown.";
  $("meetSnapshot").innerHTML="<div><strong>Meet date:</strong> "+esc(p.meetDate||"Not set")+"</div><div><strong>Projected total:</strong> "+totalFromPlan()+" kg</div><div><strong>Current best total:</strong> "+currentBestTotal()+" kg</div>";
  renderPlanner();renderMeetDay();renderReport();
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

function renderReport(){
  const mm=madeMiss(),attempts=mm.made+mm.miss,body=$("reportBody");
  $("reportTitle").textContent=attempts?mm.made+"/"+attempts+" attempts made":"Complete the meet to build your report";
  const total=liveTotal(),success=attempts?Math.round(mm.made/attempts*1000)/10:0;
  body.innerHTML="<div class=\"reportCard\"><div class=\"reportGrid\"><div><span>Success rate</span><strong>"+success+"%</strong></div><div><span>Best total</span><strong>"+total+" kg</strong></div><div><span>Made / Missed</span><strong>"+mm.made+" / "+mm.miss+"</strong></div></div><p style=\"margin-top:14px\">Squat "+(bestMade("squat")||"—")+" · Bench "+(bestMade("bench")||"—")+" · Deadlift "+(bestMade("deadlift")||"—")+"</p></div>";
}

$("saveProfile").addEventListener("click",()=>{
  state.profile={name:$("name").value.trim()||"Athlete",sex:$("sex").value,bodyweight:num($("bodyweight").value),meetDate:$("meetDate").value,squatBest:num($("squatBest").value),benchBest:num($("benchBest").value),deadliftBest:num($("deadliftBest").value)};
  state.plan=blankPlan();state.results=blankResults();suggestPlan();save();render();
});
$("editProfile").addEventListener("click",()=>{const p=state.profile||{};$("name").value=p.name||"";$("sex").value=p.sex||"M";$("bodyweight").value=p.bodyweight||"";$("meetDate").value=p.meetDate||"";$("squatBest").value=p.squatBest||"";$("benchBest").value=p.benchBest||"";$("deadliftBest").value=p.deadliftBest||"";delete state.profile;save();render();window.scrollTo({top:0,behavior:"smooth"})});
$("savePlan").addEventListener("click",()=>{save();alert("Attempt plan saved on this device.")});
$("resetMeet").addEventListener("click",()=>{if(confirm("Reset all meet-day results?")){state.results=blankResults();save();renderMeetDay();renderReport()}});
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".tab").forEach(x=>x.hidden=x.id!=="tab-"+b.dataset.tab)}));
$("shareReport").addEventListener("click",async()=>{const mm=madeMiss(),text=(state.profile&&state.profile.name?state.profile.name+"'s":"My")+" powerlifting meet: "+mm.made+"/"+(mm.made+mm.miss)+" attempts made, "+liveTotal()+" kg total. Built with Powerlifting Performance Hub.";if(navigator.share){await navigator.share({title:"Powerlifting Meet Report",text})}else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert("Report copied to clipboard.")}});
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
render();