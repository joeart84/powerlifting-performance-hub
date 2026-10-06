const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('app.js','utf8');
const recovery=source.slice(source.indexOf('function readStoredObject'),source.indexOf('const state='));
test('damaged storage does not stop boot and retains a recovery copy',()=>{
  const entries=new Map([['profile','{broken'],['session','[]']]);
  const context={localStorage:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)}};
  vm.createContext(context);vm.runInContext(recovery,context);
  const fallback={name:'legacy'};
  assert.equal(context.readStoredObject('profile',fallback),fallback);
  assert.equal(entries.get('profile-recovery'),'{broken');
  context.readStoredObject('session');assert.equal(entries.get('session-recovery'),'[]');
  entries.set('profile','second damaged value');context.readStoredObject('profile');
  assert.equal(entries.get('profile-recovery'),'{broken');
});
test('valid profiles survive and missing storage returns the fallback',()=>{
  const context={localStorage:{getItem:k=>k==='profile'?'{"bodyweight":83}':null}};
  vm.createContext(context);vm.runInContext(recovery,context);
  assert.equal(context.readStoredObject('profile').bodyweight,83);
  const fallback={};assert.equal(context.readStoredObject('missing',fallback),fallback);
});
function worker(network=()=>Promise.reject(new Error('offline'))){
  const handlers={},entries=new Map(),deleted=[];
  const cache={match:async key=>entries.get(key)?.clone(),put:async(key,value)=>entries.set(key,value),addAll:async()=>{}};
  const context={URL,Response,fetch:network,self:{location:{href:'https://app.powerlifting-calculator.com/sw.js'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>['unrelated-cache','plc-performance-hub-old','plc-performance-hub-v14.1-ux-play'],delete:async key=>deleted.push(key)}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
  return {handlers,entries,deleted};
}
function request(worker,path,mode='cors'){
  let response;
  worker.handlers.fetch({request:{method:'GET',url:'https://app.powerlifting-calculator.com/'+path,mode},respondWith:p=>response=p});
  return response;
}
test('offline navigation gets the shell but missing JavaScript never gets HTML',async()=>{
  const w=worker();w.entries.set('https://app.powerlifting-calculator.com/index.html',new Response('<html>shell</html>'));
  assert.match(await(await request(w,'','navigate')).text(),/shell/);
  assert.equal((await request(w,'app.js')).type,'error');
  assert.equal(request(w,'private.json'),undefined);
});
test('HTTP errors cannot replace a working offline asset',async()=>{
  const w=worker(async()=>new Response('outage',{status:503}));
  w.entries.set('https://app.powerlifting-calculator.com/app.js',new Response('valid script'));
  assert.equal(await(await request(w,'app.js?v=12')).text(),'valid script');
  assert.equal(await w.entries.get('https://app.powerlifting-calculator.com/app.js').text(),'valid script');
});
test('activation only removes previous Hub caches',async()=>{
  const w=worker();let done;w.handlers.activate({waitUntil:p=>done=p});await done;
  assert.deepEqual(w.deleted,['plc-performance-hub-old']);
});
