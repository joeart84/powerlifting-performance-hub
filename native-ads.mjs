// The queue serializes consent and banners; a denied consent state never falls through.
export function createAdController({admob,hidden,onSpace,onPrivacy,options}){
  let initialized=false,consentReady=false,canRequestAds=false,created=false,isHidden=false,pending=null,again=false;
  async function run(){
    if(hidden()){if(created&&!isHidden){await admob.hideBanner();isHidden=true}onSpace(0);return}
    if(!initialized){await admob.initialize();initialized=true}
    if(!consentReady){let info=await admob.requestConsentInfo();if(info.isConsentFormAvailable&&info.status==='REQUIRED')info=await admob.showConsentForm();canRequestAds=info.canRequestAds===true;consentReady=true;onPrivacy(info.privacyOptionsRequirementStatus==='REQUIRED')}
    if(!canRequestAds){onSpace(0);return}
    if(hidden()){onSpace(0);return}
    if(!created){await admob.showBanner(options);created=true;isHidden=false}else if(isHidden){await admob.resumeBanner();isHidden=false}
    onSpace(60);
  }
  function sync(){again=true;if(pending)return pending;pending=(async()=>{try{while(again){again=false;await run()}}catch(error){onSpace(0);throw error}finally{pending=null}})();return pending}
  async function privacy(){if(pending)await pending;if(created&&!isHidden){await admob.hideBanner();isHidden=true}onSpace(0);await admob.showPrivacyOptionsForm();consentReady=false;return sync()}
  return {sync,privacy};
}
