import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } from "@capacitor-community/admob";
import { createAdController } from "./native-ads.mjs";

if (Capacitor.isNativePlatform()) {
  window.PPHNative = {
    async exportFile(text,name){
      const file=await Filesystem.writeFile({path:name.replace(/[^a-zA-Z0-9._-]/g,'_'),data:text,directory:Directory.Cache,encoding:Encoding.UTF8});
      await Share.share({title:'Powerlifting Hub backup',files:[file.uri],dialogTitle:'Save or share backup'});
    },
    async shareImage(blob,name,text){
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});
      const file=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});
      await Share.share({title:'Powerlifting meet report',text,files:[file.uri]});
    }
  };
  window.dispatchEvent(new Event('pph:native-ready'));
  App.addListener('backButton',()=>{
    const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return}
    const editing=document.getElementById('cancelProfileEdit');if(editing&&!editing.hidden){editing.click();return}
    const accountBack=document.getElementById('accountBackToProfile');if(accountBack&&!accountBack.hidden&&!document.getElementById('tab-account').hidden){accountBack.click();return}
    const dashboard=document.querySelector('[data-tab="dashboard"]');
    if(dashboard&&!dashboard.classList.contains('active')&&!document.getElementById('app').hidden){dashboard.click();return}
    App.exitApp();
  });
}

function setupAndroid(){
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return;
  document.body.classList.add('nativeAndroid');
  const space=height=>document.documentElement.style.setProperty('--native-ad-space',`${Math.max(0,Math.round(Number(height)||0))}px`);
  const hidden=()=>!document.getElementById('onboarding').hidden||!document.getElementById('tab-meetday').hidden||!document.getElementById('tab-account').hidden||document.body.classList.contains('meetFocusMode');
  const consentAdapter={
    initialize:()=>AdMob.initialize(),
    requestConsentInfo:async()=>normalizeConsent(await AdMob.requestConsentInfo()),
    showConsentForm:async()=>normalizeConsent(await AdMob.showConsentForm()),
    showPrivacyOptionsForm:()=>AdMob.showPrivacyOptionsForm(),
    showBanner:options=>AdMob.showBanner(options),hideBanner:()=>AdMob.hideBanner(),resumeBanner:()=>AdMob.resumeBanner()
  };
  function normalizeConsent(info){return {...info,status:info.status===AdmobConsentStatus.REQUIRED?'REQUIRED':info.status,privacyOptionsRequirementStatus:info.privacyOptionsRequirementStatus}}
  const controller=createAdController({admob:consentAdapter,hidden,onSpace:space,onPrivacy:required=>{document.getElementById('adPrivacyOptions').hidden=!required},options:{adId:'ca-app-pub-3940256099942544/6300978111',adSize:BannerAdSize.ADAPTIVE_BANNER,position:BannerAdPosition.BOTTOM_CENTER,margin:0,isTesting:true}});
  const sync=()=>controller.sync().catch(()=>space(0));
  AdMob.addListener(BannerAdPluginEvents.SizeChanged,size=>space(hidden()?0:size?.height||60));
  AdMob.addListener(BannerAdPluginEvents.FailedToLoad,()=>space(0));
  document.getElementById('adPrivacyOptions').addEventListener('click',()=>controller.privacy().catch(()=>space(0)));
  document.addEventListener('pph:tab-change',sync);
  const observer=new MutationObserver(sync);
  for(const id of ['onboarding','tab-account','tab-meetday'])observer.observe(document.getElementById(id),{attributes:true,attributeFilter:['hidden']});
  sync();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',setupAndroid,{once:true});else setupAndroid();
