const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const PPHData=require('../hub-data.js');
const source=fs.readFileSync('app.js','utf8');
function profile(total=600){return {schema_version:1,profile:{name:'Test Athlete',sex:'M',age:50,bodyweight:83,squatBest:220,benchBest:140,deadliftBest:total-360},plan:{squat:[200,210,220],bench:[125,135,140],deadlift:[220,230,240]},results:{squat:['','',''],bench:['','',''],deadlift:['','','']},meets:[],goal:null,preferences:{}}}
function sync(){
 let local=profile(),remote=profile(625),uploads=[],downloads=0;
 const elements=new Map(),storage=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,textContent:'',value:'',addEventListener(){},setAttribute(){}});return elements.get(id)};
 const context={PPHData,KEY:'test',session:{},state:{},$: $,num:Number,t:key=>key,messages:{},TextEncoder,Blob,URL,setTimeout,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},languagePreference:()=> 'en',cloudPayload:()=>structuredClone(local),applyCloudPayload:value=>{local=PPHData.validatePayload(value)},window:{PPHCloud:{user:{uid:'test-user'},download:async()=>{downloads++;return structuredClone(remote)},upload:async value=>uploads.push(value)}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const RESTORE_KEY='),source.indexOf('function clearSession()')),context);
 return {context,$,storage,uploads,remote:value=>{remote=value},local:value=>{local=value},getLocal:()=>local,getDownloads:()=>downloads};
}
test('cloud upload is reviewed, explicit and guarded against other-device changes',async()=>{
 const s=sync();await s.context.uploadCloud();assert.equal(s.uploads.length,0);assert.equal(s.$('cloudReview').hidden,false);
 s.remote(profile(650));await s.context.confirmCloudChange();assert.equal(s.uploads.length,0);assert.equal(s.$('cloudStatus').textContent,'sync.changed');
 await s.context.uploadCloud();await s.context.confirmCloudChange();assert.equal(s.uploads.length,1);assert.equal(s.uploads[0].profile.deadliftBest,240);
});
test('changes on this device invalidate a pending cloud replacement',async()=>{
 const s=sync();await s.context.downloadCloud();s.local(profile(700));await s.context.confirmCloudChange();
 assert.equal(s.getLocal().profile.deadliftBest,340);assert.equal(s.$('cloudStatus').textContent,'sync.changed');
});
test('cloud restore retains a credential-free undo copy',async()=>{
 const s=sync();await s.context.downloadCloud();await s.context.confirmCloudChange();
 assert.equal(s.getLocal().profile.deadliftBest,265);
 const recovery=PPHData.parseBackup(s.storage.get('test-before-restore'));assert.equal(recovery.data.profile.deadliftBest,240);
 assert.equal(s.$('undoDataChange').hidden,false);
});
test('malformed cloud data and network failures preserve device data and unlock controls',async()=>{
 const s=sync();s.remote({schema_version:9});await s.context.downloadCloud();assert.equal(s.getLocal().profile.deadliftBest,240);assert.equal(s.$('downloadCloud').disabled,false);
 s.context.window.PPHCloud.download=async()=>{throw Error('offline')};await s.context.uploadCloud();assert.equal(s.$('uploadCloud').disabled,false);assert.equal(s.uploads.length,0);
});
test('parallel clicks produce a single in-flight cloud request',async()=>{
 const s=sync();let release;const gate=new Promise(resolve=>release=resolve);let calls=0;
 s.context.window.PPHCloud.download=async()=>{calls++;await gate;return profile(625)};
 const first=s.context.downloadCloud();await s.context.uploadCloud();assert.equal(calls,1);release();await first;
});
test('Google SDK initializes once even when multiple renders call it before loading',async()=>{
 let release,initializations=0,buttons=0;const gate=new Promise(resolve=>release=resolve);
 const elements={googleSignInButton:{getBoundingClientRect:()=>({width:320})},googleStatus:{textContent:''}};
 const context={GOOGLE_CLIENT_ID:'test-client',$:id=>elements[id],session:{},window:{google:{accounts:{id:{initialize(){initializations++},renderButton(){buttons++}}}}},loadGoogleIdentity:()=>gate,t:key=>key};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let googleButtonRendered='),source.indexOf('function renderAccount()')),context);
 const first=context.initGoogleSignIn();const second=context.initGoogleSignIn();release();await Promise.all([first,second]);assert.equal(initializations,1);assert.equal(buttons,1);
 vm.runInContext('googleButtonRendered=false',context);await context.initGoogleSignIn();assert.equal(initializations,1);assert.equal(buttons,2);
});
