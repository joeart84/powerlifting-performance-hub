const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('cloud read, write and revoke use POST bodies without URL credentials or preflight headers',async()=>{
  const source=fs.readFileSync('app.js','utf8'),calls=[];
  const context={session:{token:'test-session-only'},HUB_API:'https://example.test/hub',AbortController,URLSearchParams,setTimeout,clearTimeout,messages:{},t:key=>key,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true})}}};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function authHeaders()'),source.indexOf('let emailMode=')),context);
  await context.hubSessionRequest('/profile/read');
  await context.hubSessionRequest('/profile/write',{profile:JSON.stringify({schema_version:1})});
  await context.hubSessionRequest('/session/revoke');
  assert.equal(calls.length,3);
  for(const {url,options} of calls){
    assert.ok(!url.includes('test-session-only'));assert.ok(!url.includes('?'));
    assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,undefined);
    assert.match(options.headers['Content-Type'],/^application\/x-www-form-urlencoded/);
    assert.equal(options.body.get('session_token'),'test-session-only');
  }
  assert.deepEqual(JSON.parse(calls[1].options.body.get('profile')),{schema_version:1});
});
