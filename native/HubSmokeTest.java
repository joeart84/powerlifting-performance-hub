package com.powerliftingcalculator.performancehub;

import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class HubSmokeTest {
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);
        AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression,value->{result.set(value);latch.countDown();}));
        assertTrue("WebView JS responded",latch.await(10,TimeUnit.SECONDS));
        return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario,String expression) throws Exception {
        long deadline=System.currentTimeMillis()+60000;
        while(System.currentTimeMillis()<deadline){if("true".equals(js(scenario,expression)))return;Thread.sleep(100);}
        fail("UI condition timed out: "+expression);
    }
    @Test public void localProfileAttemptsUndoRotationAndNativeLogin() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!window.PPHNative && !!document.getElementById('saveProfile') && document.documentElement.lang==='en'");
            assertEquals("true",js(scenario,"window.Capacitor.isNativePlatform()"));
            js(scenario,"(()=>{const e=document.getElementById('unitsSelect');e.value='kg';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
            js(scenario,"(()=>{for(const [id,v] of Object.entries({name:'Android Test',bodyweight:'109,37',age:'40',squatBest:'200',benchBest:'120',deadliftBest:'240',meetDate:'2026-12-01'})){let e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}document.getElementById('saveProfile').click();return true})()");
            waitFor(scenario,"document.getElementById('athleteName').textContent==='Android Test'");
            assertEquals("true",js(scenario,"document.getElementById('currentReshel').textContent==='496.72' && JSON.parse(localStorage.getItem('plc-performance-hub-v6')).profile.bodyweight===109.37"));
            js(scenario,"document.getElementById('nextStepAction').click()");
            waitFor(scenario,"document.body.classList.contains('meetFocusMode')");
            js(scenario,"document.getElementById('focusBack').click()");
            assertEquals("true",js(scenario,"!document.body.classList.contains('meetFocusMode') && !document.getElementById('tab-dashboard').hidden"));
            js(scenario,"document.getElementById('nextStepAction').click();document.getElementById('focusGood').click()");
            assertEquals("true",js(scenario,"document.getElementById('madeCount').textContent==='1'"));
            js(scenario,"document.getElementById('undoAttempt').click()");
            assertEquals("true",js(scenario,"document.getElementById('madeCount').textContent==='0'"));
            js(scenario,"toggleFourth('deadlift',true);document.getElementById('weight-deadlift-3').value='400';document.getElementById('weight-deadlift-3').dispatchEvent(new Event('input',{bubbles:true}));updateAttempt('deadlift',3,'good');changeScore('reshel');changeUnits('lbs');true");
            assertEquals("true",js(scenario,"liveTotal()===0 && madeMiss().made===0 && document.getElementById('reportBody').textContent.includes('Reshel') && JSON.parse(localStorage.getItem('plc-performance-hub-v6')).profile.bodyweight===109.37"));
            scenario.recreate();
            waitFor(scenario,"document.getElementById('athleteName').textContent==='Android Test'");
            js(scenario,"document.getElementById('topAccountCta').click()");
            waitFor(scenario,"document.getElementById('googleSignInButton').hidden===true && !document.getElementById('nativeGoogleSignIn').hidden && !document.getElementById('nativeGoogleSignIn').disabled && !document.getElementById('tab-account').hidden");
            assertEquals("true",js(scenario,"!document.querySelector('script[data-pph-google-identity]') && typeof window.PPHNative.googleSignIn==='function'"));
            js(scenario,"document.getElementById('topSettingsCta').click();document.getElementById('problemDescription').value='Native test report';document.getElementById('prepareProblemReport').click();true");
            assertEquals("true",js(scenario,"document.getElementById('problemReportPreview').value.includes('0.16.0') && !document.getElementById('problemReportPreview').value.includes('Android Test')"));
        }
    }
    @Test public void nativeCompetitionFeedAndLocationConfiguration() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!window.PPHNative && typeof window.PPHNative.getLocation==='function'");
            final AtomicReference<Boolean> declared=new AtomicReference<>(false);
            scenario.onActivity(activity->{try{String[] permissions=activity.getPackageManager().getPackageInfo(activity.getPackageName(),android.content.pm.PackageManager.GET_PERMISSIONS).requestedPermissions;declared.set(java.util.Arrays.asList(permissions).contains("android.permission.ACCESS_COARSE_LOCATION"));}catch(Exception error){throw new RuntimeException(error);}});
            assertTrue("Approximate location permission declared",declared.get());
            js(scenario,"document.getElementById('resetCompetitionFilters').click();loadCompetitions();true");
            waitFor(scenario,"document.querySelectorAll('#competitionResults .competitionCard').length>0");
            js(scenario,"window.__nativeGeoTest='pending';PPHNative.getPublicJSON('https://powerlifting-calculator.com/wp-json/plc-radar/v1/hub/geocode?city=Trnava&country=Slovakia').then(d=>window.__nativeGeoTest=(Number(d.latitude)>48 && Number(d.latitude)<49 && Number(d.longitude)>17 && Number(d.longitude)<18)?'ok':'invalid').catch(e=>window.__nativeGeoTest=String(e));true");
            waitFor(scenario,"window.__nativeGeoTest==='ok'");
        }
    }
}
