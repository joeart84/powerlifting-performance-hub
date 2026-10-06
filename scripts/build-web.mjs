import {cp,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url),destination=new URL('../_site/',import.meta.url);
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const file of ['index.html','app.css','app.js','ux.js','hub-data.js','scoring.js','firebase-auth.js','firebase-config.js','manifest.webmanifest','sw.js','locales','icon.svg','mark.svg','logo.svg','icon-192.png','icon-512.png','account-deletion.html','app-privacy.html','CNAME'])await cp(new URL(file,root),new URL(file,destination),{recursive:true});
console.log('Public web assets staged in _site/');
