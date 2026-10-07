// Serialize consent and banners. Ads are requested only when UMP permits them.
export function createAdController({admob,hidden,onSpace,onPrivacy,onStatus=()=>{},options}){
 let initialized=false,consentReady=false,canRequestAds=false,created=false,isHidden=false,pending=null,again=false,cleanup=false,failures=0;
 const status=(state,detail='')=>onStatus({state,detail});
 const failure=error=>{failures++;cleanup=true;onSpace(0);status('error',String(error?.message||error||'Banner failed to load').slice(0,240))};
 async function run(){
  if(hidden()){if(created&&!isHidden){await admob.hideBanner();isHidden=true}onSpace(0);status('hidden');return}
  if(!initialized){status('initializing');await admob.initialize();initialized=true}
  if(!consentReady){status('consent');let info=await admob.requestConsentInfo();if(info.isConsentFormAvailable&&info.status==='REQUIRED')info=await admob.showConsentForm();canRequestAds=info.canRequestAds===true;consentReady=true;onPrivacy(info.privacyOptionsRequirementStatus==='REQUIRED')}
  if(!canRequestAds){onSpace(0);status('blocked');return}
  if(hidden()){onSpace(0);status('hidden');return}
  if(cleanup){if(admob.removeBanner)await admob.removeBanner();cleanup=false;created=false;isHidden=false}
  if(!created){status('requesting');const before=failures;await admob.showBanner(options);if(before!==failures)return;created=true;isHidden=false}
  else if(isHidden){await admob.resumeBanner();isHidden=false}
  onSpace(60);status(options.isTesting?'test':'live');
 }
 function sync(){again=true;if(pending)return pending;pending=(async()=>{try{while(again){again=false;await run()}}catch(error){onSpace(0);status('error',String(error?.message||'Advertising unavailable').slice(0,240));throw error}finally{pending=null}})();return pending}
 async function retry(){if(pending)try{await pending}catch(e){}consentReady=false;cleanup=created||cleanup;return sync()}
 async function privacy(){if(pending)await pending;if(created&&!isHidden){await admob.hideBanner();isHidden=true}onSpace(0);await admob.showPrivacyOptionsForm();consentReady=false;return sync()}
 return {sync,privacy,retry,failed:failure};
}
