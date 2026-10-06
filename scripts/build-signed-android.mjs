import {execFileSync} from 'node:child_process';
for(const key of ['HUB_UPLOAD_KEYSTORE','HUB_UPLOAD_ALIAS','HUB_UPLOAD_STORE_PASSWORD','HUB_UPLOAD_KEY_PASSWORD'])if(!process.env[key])throw Error(`${key} must be supplied privately before building a signed Play bundle.`);
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','android:sync'],{stdio:'inherit'});
execFileSync(process.platform==='win32'?'gradlew.bat':'./gradlew',['bundleRelease'],{cwd:'android',stdio:'inherit'});
