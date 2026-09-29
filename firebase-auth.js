// Optional Firebase path. Existing WordPress email-code accounts remain available.
const config = window.PPH_FIREBASE_CONFIG;
if (config?.apiKey && config?.authDomain && config?.projectId && config?.appId) {
  const panel = document.getElementById("firebasePanel");
  const status = document.getElementById("firebaseStatus");
  const submit = document.getElementById("firebaseSubmit");
  const password = document.getElementById("firebasePassword");
  let mode = "signin";
  const say = message => { status.textContent = message; };
  const busy = value => {
    panel.querySelectorAll("button, input").forEach(control => { control.disabled = value; });
    panel.setAttribute("aria-busy", String(value));
  };
  const errorMessage = error => ({
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/weak-password": "Choose a stronger password (at least six characters).",
    "auth/popup-closed-by-user": "Sign-in window was closed. Please try again.",
    "auth/unauthorized-domain": "This app domain needs to be authorized in Firebase settings.",
    "permission-denied": "Cloud access was denied. Check the Firestore security rules."
  })[error?.code] || "Sign-in could not be completed. Check your connection and try again.";
  try {
    const version = "12.11.0";
    const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);
    const app = initializeApp(config);
    const auth = authSdk.getAuth(app);
    const db = firestoreSdk.getFirestore(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    const allowed = new Set(config.enabledProviders || ["google", "password"]);
    document.getElementById("authGoogle").hidden = !allowed.has("google");
    document.getElementById("authFacebook").hidden = !allowed.has("facebook");
    document.getElementById("authTwitter").hidden = !allowed.has("twitter");
    document.getElementById("firebaseEmailForm").hidden = !allowed.has("password");
    document.getElementById("firebaseReset").hidden = !allowed.has("password");
    document.querySelector(".authModes").hidden = !allowed.has("password");
    document.querySelector("#firebasePanel .orDivider").hidden = !allowed.has("password");
    panel.hidden = false;

    const cloud = window.PPHCloud = {
      user: null,
      async upload(payload) {
        if (!auth.currentUser) throw new Error("Sign in to save cloud data.");
        await firestoreSdk.setDoc(firestoreSdk.doc(db, "hubProfiles", auth.currentUser.uid), { profile: payload });
      },
      async download() {
        if (!auth.currentUser) throw new Error("Sign in to load cloud data.");
        const result = await firestoreSdk.getDoc(firestoreSdk.doc(db, "hubProfiles", auth.currentUser.uid));
        return result.exists() ? result.data().profile : null;
      },
      async signOut() { await authSdk.signOut(auth); }
    };
    authSdk.onAuthStateChanged(auth, user => {
      cloud.user = user;
      window.PPHFirebaseChanged?.();
      if (user) say("");
    }, error => say(errorMessage(error)));

    function setMode(next) {
      mode = next;
      document.getElementById("authModeSignIn").classList.toggle("active", next === "signin");
      document.getElementById("authModeSignUp").classList.toggle("active", next === "signup");
      password.autocomplete = next === "signup" ? "new-password" : "current-password";
      submit.dataset.i18n = next === "signup" ? "auth.create" : "auth.sign_in";
      submit.textContent = window.PPHTranslate?.(submit.dataset.i18n) || (next === "signup" ? "Create account" : "Sign in");
      say("");
    }
    document.getElementById("authModeSignIn").addEventListener("click", () => setMode("signin"));
    document.getElementById("authModeSignUp").addEventListener("click", () => setMode("signup"));
    document.getElementById("firebaseEmailForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!allowed.has("password")) return;
      busy(true); say("Connecting…");
      try {
        const email = document.getElementById("firebaseEmail").value.trim();
        const pass = password.value;
        if (mode === "signup") await authSdk.createUserWithEmailAndPassword(auth, email, pass);
        else await authSdk.signInWithEmailAndPassword(auth, email, pass);
        password.value = "";
      } catch (error) { say(errorMessage(error)); }
      finally { busy(false); }
    });
    document.getElementById("firebaseReset").addEventListener("click", async () => {
      const email = document.getElementById("firebaseEmail");
      if (!email.reportValidity()) return;
      busy(true); say("Sending reset link…");
      try {
        await authSdk.sendPasswordResetEmail(auth, email.value.trim());
        say("If an account exists for this email, a reset link is on its way.");
      } catch (error) { say(errorMessage(error)); }
      finally { busy(false); }
    });
    const providers = {
      google: authSdk.GoogleAuthProvider,
      facebook: authSdk.FacebookAuthProvider,
      twitter: authSdk.TwitterAuthProvider
    };
    for (const [name, id] of [["google", "authGoogle"], ["facebook", "authFacebook"], ["twitter", "authTwitter"]]) {
      document.getElementById(id).addEventListener("click", async () => {
        if (!allowed.has(name)) return;
        busy(true); say("Connecting…");
        try { await authSdk.signInWithPopup(auth, new providers[name]()); }
        catch (error) { say(errorMessage(error)); }
        finally { busy(false); }
      });
    }
  } catch (error) {
    panel.hidden = false;
    panel.querySelectorAll("button, input").forEach(control => { control.disabled = true; });
    say("Secure sign-in is temporarily unavailable. You can still use the email code below.");
    console.warn("Firebase initialization failed", error.code || error.message);
  }
}
