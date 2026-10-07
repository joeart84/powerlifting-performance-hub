const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
async function app(native=false,blank=false){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://app.powerlifting-calculator.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.TextEncoder=TextEncoder;Object.defineProperty(w.navigator,'language',{value:'en-GB',configurable:true});w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.queueMicrotask=()=>{};w.fetch=async url=>({ok:true,json:async()=>String(url).includes('locales/')?JSON.parse(fs.readFileSync(String(url).replace('./',''),'utf8')):{competitions:[]}});
 if(native){w.Capacitor={isNativePlatform:()=>true};w.PPHNative={getPublicJSON:async()=>({competitions:[]})};}
 for(const file of ['scoring.js','hub-data.js','ux.js','app.js'])w.eval(fs.readFileSync(file,'utf8'));
 await new Promise(resolve=>setImmediate(resolve));
 const $=id=>w.document.getElementById(id),fill=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}))};
 if(!blank){for(const [id,value] of Object.entries({name:'UI Athlete',sex:'M',bodyweight:'83,5',age:'50',squatBest:'220',benchBest:'140',deadliftBest:'240',meetDate:'2026-12-01'}))fill(id,value);
 $('saveProfile').click();await new Promise(resolve=>setImmediate(resolve));}
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
test('OpenPowerlifting import computes Reshel at the exact imported weight before and after adding age',async()=>{
 const {dom,w,$,fill}=await app(false,true);try{
  w.applyImportedAthlete([{source:'openpowerlifting',date:'2026-09-01',meet:'Import regression',athleteName:'OPL Athlete',athleteSex:'M',bodyweight:109.37,squat:220,bench:140,deadlift:240,total:600}], 'https://www.openpowerlifting.org/u/test','test');
  assert.equal(JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).profile.bodyweight,109.37);
  assert.equal($('currentTotal').textContent,'600');assert.equal($('currentReshel').textContent,'532.20');
  $('editProfile').click();fill('age','50');$('saveProfile').click();
  assert.equal($('currentReshel').textContent,'532.20');
  const profile=JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).profile;
  assert.equal(profile.bodyweight,109.37);assert.equal(profile.age,50);assert.equal(profile.sex,'M');
 }finally{dom.window.close()}
});
test('weight units preserve exact kg data through toggles, profile edits, input and planner steps',async()=>{
 const {dom,w,$,fill}=await app();try{
  const stored=()=>JSON.parse(w.localStorage.getItem('plc-performance-hub-v6'));
  const before=JSON.stringify(stored().profile),dots=$('currentDots').textContent;
  for(let i=0;i<5;i++){w.changeUnits('lbs');w.changeUnits('kg')}
  assert.equal(JSON.stringify(stored().profile),before);w.changeUnits('lbs');
  $('editProfile').click();assert.equal($('bodyweight').value,'184.086');fill('age','51');$('saveProfile').click();
  assert.equal(stored().profile.bodyweight,83.5);assert.equal($('currentDots').textContent,dots);
  w.document.querySelector('[data-tab="planner"]').click();fill('weight-squat-0','440.92452437');
  assert.ok(Math.abs(stored().plan.squat[0]-200)<1e-8);
  $('weight-squat-0').parentElement.querySelector('[data-delta="2.5"]').click();
  assert.ok(Math.abs(stored().plan.squat[0]-202.5)<1e-8);assert.match($('projectedTotal').textContent,/lbs/);
  Object.defineProperty(w.navigator,'language',{value:'en-US'});w.changeUnits('auto');assert.match($('projectedTotal').textContent,/lbs/);
 }finally{dom.window.close()}
});
test('Reshel preference reaches history, report, simulator, goals and the manual result preview',async()=>{
 const {dom,w,$,fill}=await app(false,true);try{
  w.applyImportedAthlete([{date:'2026-09-01',meet:'OPL',athleteName:'Athlete',athleteSex:'F',bodyweight:118.65,squat:150,bench:80,deadlift:170,total:400,dots:0}], '', 'athlete');
  w.changeScore('reshel');assert.equal($('currentDots').closest('.heroScore').hidden,true);assert.equal($('currentReshel').closest('.heroScore').hidden,false);
  assert.match($('historyRows').textContent,/523.20/);assert.equal(w.document.querySelector('[data-i18n="progress.dots"]').textContent,'Reshel');
  fill('simBodyweight','118.65');fill('simTotal','400');$('runSimulator').click();assert.match($('simResult').textContent,/523.20 Reshel/);
  fill('goalDots','523.2');fill('goalBodyweight','118.65');$('saveGoal').click();
  const goal=JSON.parse(w.localStorage.getItem('plc-performance-hub-v6')).goal;assert.equal(goal.targetTotal,400);assert.equal(goal.targetReshel,523.2);assert.equal(goal.targetDots,0);
  assert.match($('goalSnapshot').textContent,/523.2 Reshel/);
  fill('manualMeetBw','118.65');fill('manualMeetSquat','150');fill('manualMeetBench','80');fill('manualMeetDeadlift','170');assert.equal($('manualMeetDots').textContent,'523.20');
  w.updateAttempt('squat',0,'good');assert.match($('reportBody').textContent,/Reshel/);assert.doesNotMatch($('reportBody').textContent,/DOTS/);
 }finally{dom.window.close()}
});
test('optional fourth attempts enter the queue and backup without changing scored total or PRs',async()=>{
 const {dom,w,$,fill}=await app();try{
  w.toggleFourth('deadlift',true);fill('weight-deadlift-3','400');
  assert.equal(w.currentAttempt().index,0);assert.equal(w.totalFromPlan(),607.5);
  for(const lift of ['squat','bench','deadlift'])for(let i=0;i<3;i++)w.updateAttempt(lift,i,'good');
  const total=w.liveTotal();assert.equal(w.currentAttempt().index,3);w.updateAttempt('deadlift',3,'good');
  assert.equal(w.liveTotal(),total);assert.equal(w.madeMiss().made,9);assert.match($('reportBody').textContent,/Record attempt/);
  const record=w.buildMeetRecord();assert.equal(record.deadlift,242.5);assert.deepEqual(JSON.parse(JSON.stringify(record.recordAttempts.deadlift)),{weight:400,result:'good'});
  w.saveMeetToHistory();const payload=w.cloudPayload();assert.equal(payload.profile.deadliftBest,242.5);
  const parsed=w.PPHData.parseBackup(JSON.stringify(w.PPHData.backup(payload)));assert.equal(parsed.data.plan.deadlift.length,4);assert.equal(parsed.data.meets[0].recordAttempts.deadlift.weight,400);
  w.undoAttemptChange();assert.equal(w.currentAttempt().index,3);assert.equal(w.liveTotal(),total);
 }finally{dom.window.close()}
});
test('competition feed works through the native bridge, all filters, manual location and offline cache',async()=>{
 const {dom,w,$,fill}=await app();try{
  const events=[{event:'Žilina Open',start_date:'2026-11-01',country:'Slovakia',city:'Žilina',federation:'GPC',latitude:49.22,longitude:18.74},{event:'USA Open',start_date:'2027-01-01',country:'United States',city:'Boston',federation:'USAPL',latitude:42.36,longitude:-71.06}];
  let called=0;w.PPHNative={getPublicJSON:async url=>{called++;return url.includes('/geocode?')?{latitude:49.22,longitude:18.74,display_name:'Žilina, Slovakia'}:{competitions:events,meta:{}}}};
  await w.loadCompetitions();assert.equal(called,1);assert.equal($('competitionResults').querySelectorAll('.competitionCard').length,2);
  fill('competitionSearch','zilina');assert.match($('competitionResults').textContent,/Žilina Open/);assert.doesNotMatch($('competitionResults').textContent,/USA Open/);
  $('resetCompetitionFilters').click();$('competitionFederation').value='USAPL';$('competitionFederation').dispatchEvent(new w.Event('change'));assert.doesNotMatch($('competitionResults').textContent,/Žilina/);
  $('resetCompetitionFilters').click();fill('finderCountry','Slovakia');fill('finderCity','Žilina');await w.saveHomeLocation('finderCountry','finderCity','finderLocationStatus');
  assert.match($('competitionResults').textContent,/0 km/);assert.doesNotMatch($('competitionResults').textContent,/USA Open/);
  w.PPHNative.getPublicJSON=async()=>{throw new Error('offline')};await w.loadCompetitions();assert.match($('competitionStatus').textContent,/last saved/);assert.match($('competitionResults').textContent,/Žilina/);
 }finally{dom.window.close()}
});
test('denied native location keeps saved coordinates and provides manual fallback',async()=>{
 const {dom,w,$}=await app();try{
  const before=w.localStorage.getItem('plc-performance-hub-v6');w.PPHNative={getLocation:async()=>{throw {code:'OS-PLUG-GLOC-0003'}}};
  await w.useBrowserLocation();assert.match($('competitionStatus').textContent,/Permissions/);assert.equal($('finderLocation').open,true);assert.equal($('useCurrentLocation').disabled,false);assert.equal(w.localStorage.getItem('plc-performance-hub-v6'),before);
 }finally{dom.window.close()}
});
test('horizontal swipes switch main tabs while vertical scroll, inputs and focus mode do not',async()=>{
 const {dom,w,$}=await app();try{
  const swipe=(target,dx,dy)=>{for(const [type,point] of [['touchstart',{clientX:200,clientY:200}],['touchend',{clientX:200+dx,clientY:200+dy}]]){const e=new w.Event(type,{bubbles:true});Object.defineProperty(e,type==='touchstart'?'touches':'changedTouches',{value:[point]});target.dispatchEvent(e)}};
  swipe($('tab-dashboard'),-100,10);assert.equal($('tab-progress').hidden,false);swipe($('tab-progress'),100,0);assert.equal($('tab-dashboard').hidden,false);
  swipe($('tab-dashboard'),-100,150);assert.equal($('tab-dashboard').hidden,false);swipe($('competitionSearch'),-100,0);assert.equal($('tab-dashboard').hidden,false);
  w.document.querySelector('[data-tab="meetday"]').click();$('toggleMeetFocus').click();swipe($('tab-meetday'),-100,0);assert.equal($('tab-meetday').hidden,false);
 }finally{dom.window.close()}
});
test('account entry scrolls to the form while email mode and form saves do not jump to page top',async()=>{
 const {dom,w,$,fill}=await app();try{
  const movements=[];w.scrollTo=options=>movements.push(['window',options.top]);w.HTMLElement.prototype.scrollIntoView=function(){movements.push(['element',this.id])};
  $('dashboardCreateAccount').click();await new Promise(r=>w.requestAnimationFrame(r));
  assert.deepEqual(movements,[['element','legacyAccount']]);
  movements.length=0;fill('accountEmail','athlete@example.com');$('emailModeSignIn').click();assert.equal($('accountEmail').value,'athlete@example.com');assert.equal(movements.length,0);
  w.navigateTab('settings');await new Promise(r=>w.requestAnimationFrame(r));movements.length=0;fill('profileAge','51');$('saveAthleteProfile').click();await new Promise(r=>w.requestAnimationFrame(r));assert.equal(movements.length,0);
 }finally{dom.window.close()}
});
test('focus Back and Android navigation return to the originating section and scroll position',async()=>{
 const {dom,w,$}=await app();try{
  let restored;w.scrollTo=options=>restored=options.top;Object.defineProperty(w,'scrollY',{value:730,configurable:true});
  $('nextStepAction').click();assert.equal($('meetFocus').hidden,false);$('focusBack').click();await new Promise(r=>w.requestAnimationFrame(r));
  assert.equal($('tab-dashboard').hidden,false);assert.equal($('meetFocus').hidden,true);assert.equal(restored,730);
  w.navigateTab('meetday');$('toggleMeetFocus').click();assert.equal(w.PPHNavigation.back(),true);assert.equal($('tab-meetday').hidden,false);assert.equal(w.PPHNavigation.back(),false);
 }finally{dom.window.close()}
});
test('support reports are reviewed and exclude profile, session and saved location data',async()=>{
 const {dom,w,$,fill}=await app();try{
  w.localStorage.setItem('private-session-test',JSON.stringify({token:'SECRET_SESSION',email:'private@example.com'}));w.cloudPayload().preferences.homeCity='Private City';w.cloudPayload().preferences.latitude=48.123456;
  fill('problemDescription','Filters failed after selecting my federation.');$('prepareProblemReport').click();
  const report=$('problemReportPreview').value;assert.match(report,/0.16.0/);assert.match(report,/Filters failed/);assert.doesNotMatch(report,/UI Athlete|83.5|SECRET_SESSION|private@example|Private City|48.123456/);
  assert.match($('emailProblemReport').href,/mailto:contact@powerlifting-calculator.com/);assert.equal($('problemReportActions').hidden,false);
  $('includeDiagnostics').checked=false;$('includeDiagnostics').dispatchEvent(new w.Event('change'));assert.equal($('problemReportActions').hidden,true);$('prepareProblemReport').click();assert.equal($('problemReportPreview').value,'Filters failed after selecting my federation.');
 }finally{dom.window.close()}
});
test('native Google button uses an ID token with the existing server verifier and preserves email fallback on failure',async()=>{
 const {dom,w,$}=await app(true);try{
  let calls=0;w.PPHNative.googleSignIn=async()=>{calls++;throw {code:'USER_CANCELLED'}};
  $('topAccountCta').click();await w.initGoogleSignIn();assert.equal($('nativeGoogleSignIn').hidden,false);assert.equal($('nativeGoogleSignIn').disabled,false);
  $('nativeGoogleSignIn').click();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal($('nativeGoogleSignIn').disabled,false);assert.match($('googleStatus').textContent,/cancelled/);
  let submitted;w.PPHNative.googleSignIn=async()=>'google-id-token';w.fetch=async(url,options)=>{submitted={url,body:String(options.body)};return{ok:true,json:async()=>({session_token:'verified-session',email:'verified@example.com'})}};
  w.completeHubSignIn=async()=>{};$('nativeGoogleSignIn').click();await new Promise(r=>setImmediate(r));assert.match(submitted.url,/auth\/google$/);assert.equal(submitted.body,'credential=google-id-token');assert.equal($('legacyEmailForm').hidden,false);
  assert.equal(w.document.querySelector('script[data-pph-google-identity]'),null);
 }finally{dom.window.close()}
});
