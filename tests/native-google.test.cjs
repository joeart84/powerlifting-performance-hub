const test=require('node:test'),assert=require('node:assert/strict');
test('native Google initializes once, retries failed setup, and requires the ID token rather than an access token',async()=>{
 const {createGoogleLogin}=await import('../native-google.mjs');let initialization=0,fail=true;
 const adapter={initialize:async()=>{initialization++;if(fail)throw Error('setup')},login:async()=>({result:{idToken:'verified-by-server'}})};
 const login=createGoogleLogin(adapter,'public-web-client');await assert.rejects(login(),/setup/);fail=false;assert.equal(await login(),'verified-by-server');assert.equal(await login(),'verified-by-server');assert.equal(initialization,2);
 adapter.login=async()=>({result:{accessToken:'not-an-id-token'}});await assert.rejects(login(),/GOOGLE_NO_ID_TOKEN/);
});
