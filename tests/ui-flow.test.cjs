const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
async function app(native=false){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://app.powerlifting-calculator.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.TextEncoder=TextEncoder;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.queueMicrotask=()=>{};w.fetch=async url=>({ok:true,json:async()=>String(url).includes('locales/')?JSON.parse(fs.readFileSync(String(url).replace('./',''),'utf8')):{events:[]}});
 if(native)w.Capacitor={isNativePlatform:()=>true};
 for(const file of ['scoring.js','hub-data.js','ux.js','app.js'])w.eval(fs.readFileSync(file,'utf8'));
 await new Promise(resolve=>setImmediate(resolve));
 const $=id=>w.document.getElementById(id),fill=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}))};
 for(const [id,value] of Object.entries({name:'UI Athlete',sex:'M',bodyweight:'83,5',age:'50',squatBest:'220',benchBest:'140',deadliftBest:'240',meetDate:'2026-12-01'}))fill(id,value);
 $('saveProfile').click();await new Promise(resolve=>setImmediate(resolve));
 return {dom,w,$,fill};
}
test('profile decimals, planner steps, focus results, undo and reload persistence work together',async()=>{
 const {dom,w,$,fill}=await app();try{
 assert.equal($('athleteName').textContent,'UI Athlete');assert.equal(JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).profile.bodyweight,83.5);
 w.document.querySelector('[data-tab="planner"]').click();fill('weight-squat-0','200,5');assert.equal(JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).plan.squat[0],200.5);
 $('weight-squat-0').parentElement.querySelector('[data-delta="2.5"]').click();assert.equal($('weight-squat-0').value,'203');fill('weight-squat-0','-5');assert.equal(JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).plan.squat[0],203);
 $('nextStepAction').click();assert.equal($('meetFocus').hidden,false);assert.equal($('focusWeight').textContent,'203 kg');$('focusGood').click();assert.equal($('madeCount').textContent,'1');assert.match($('focusTitle').textContent,/2/);$('undoAttempt').click();assert.equal($('madeCount').textContent,'0');assert.equal($('focusWeight').textContent,'203 kg');
 $('focusPlus').click();assert.equal($('focusWeight').textContent,'205.5 kg');$('undoAttempt').click();assert.equal($('focusWeight').textContent,'203 kg');
 for(let i=0;i<9;i++)$('focusGood').click();assert.equal($('madeCount').textContent,'9');assert.equal($('focusReport').hidden,false);assert.equal($('focusGood').hidden,true);assert.equal(JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).results.deadlift[2],'good');
 w.document.querySelector('[data-tab="settings"]').click();assert.equal($('dataBackupCard').parentElement.id,'settingsBackupSlot');assert.equal(w.document.body.classList.contains('meetFocusMode'),false);
 w.document.querySelector('[data-score="dots"]').click();assert.equal($('scoreDialog').open,true);$('closeScoreDialog').click();assert.equal($('scoreDialog').open,false);
 }finally{dom.window.close()}
});
test('Android omits web Google SDK while leaving email login and shared-file export available',async()=>{
 const {dom,w,$}=await app(true);try{$('topAccountCta').click();await w.eval('initGoogleSignIn()');assert.equal($('googleSignInButton').hidden,true);assert.equal(w.document.querySelector('script[data-pph-google-identity]'),null);assert.equal($('legacyEmailForm').hidden,false);let shared;w.PPHNative={exportFile:async(text,name)=>{shared={text,name}}};await w.eval('exportBackup()');assert.equal(JSON.parse(shared.text).data.profile.name,'UI Athlete');assert.match(shared.name,/\.json$/)}finally{dom.window.close()}
});
