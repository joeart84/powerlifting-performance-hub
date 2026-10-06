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
        long deadline=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<deadline){if("true".equals(js(scenario,expression)))return;Thread.sleep(100);}
        fail("UI condition timed out: "+expression);
    }
    @Test public void localProfileAttemptsUndoRotationAndNativeLogin() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"!!window.PPHNative && !!document.getElementById('saveProfile') && document.documentElement.lang==='en'");
            assertEquals("true",js(scenario,"window.Capacitor.isNativePlatform()"));
            js(scenario,"(()=>{for(const [id,v] of Object.entries({name:'Android Test',bodyweight:'83,5',age:'40',squatBest:'200',benchBest:'120',deadliftBest:'240',meetDate:'2026-12-01'})){let e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}document.getElementById('saveProfile').click();return true})()");
            waitFor(scenario,"document.getElementById('athleteName').textContent==='Android Test'");
            js(scenario,"document.getElementById('nextStepAction').click()");
            waitFor(scenario,"document.body.classList.contains('meetFocusMode')");
            js(scenario,"document.getElementById('focusGood').click()");
            assertEquals("true",js(scenario,"document.getElementById('madeCount').textContent==='1'"));
            js(scenario,"document.getElementById('undoAttempt').click()");
            assertEquals("true",js(scenario,"document.getElementById('madeCount').textContent==='0'"));
            scenario.recreate();
            waitFor(scenario,"document.getElementById('athleteName').textContent==='Android Test'");
            js(scenario,"document.getElementById('topAccountCta').click()");
            waitFor(scenario,"document.getElementById('googleSignInButton').hidden===true && !document.getElementById('tab-account').hidden");
            assertEquals("true",js(scenario,"!document.querySelector('script[data-pph-google-identity]')"));
        }
    }
}
