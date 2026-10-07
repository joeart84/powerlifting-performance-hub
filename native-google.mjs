// Only request a Google ID token; the existing WordPress endpoint verifies it.
export function createGoogleLogin(SocialLogin,webClientId){
 let initialized=null;
 return async()=>{
  if(!initialized)initialized=SocialLogin.initialize({google:{webClientId,mode:'online'}}).catch(error=>{initialized=null;throw error});
  await initialized;
  const login=await SocialLogin.login({provider:'google',options:{scopes:['email','profile'],style:'standard'}});
  const token=login.result?.idToken;
  if(typeof token!=='string'||!token)throw new Error('GOOGLE_NO_ID_TOKEN');
  return token;
 };
}
