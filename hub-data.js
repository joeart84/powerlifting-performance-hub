/* Local backups and cloud data share one validator. Authentication is never exported. */
(function(root){
  const LIFTS=['squat','bench','deadlift'];
  const fields=['profile','plan','results','meets','goal','preferences'];
  const MAX_BYTES=5*1024*1024;
  function invalid(){throw new Error('data.invalid')}
  function object(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
  function inspect(value,depth=0){
    if(depth>20)invalid();
    if(typeof value==='number'&&!Number.isFinite(value))invalid();
    if(typeof value==='string'&&value.length>10000)invalid();
    if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
      if(['__proto__','constructor','prototype','token','password','credential','pendingEmail','email'].includes(key))invalid();
      inspect(item,depth+1);
    }
  }
  function numeric(value,min=0,max=100000){return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max}
  function validatePayload(input){
    if(!object(input)||input.schema_version!==1||!fields.every(key=>Object.hasOwn(input,key)))invalid();
    inspect(input);
    if(input.profile!==null){
      if(!object(input.profile)||!['M','F'].includes(input.profile.sex))invalid();
      for(const field of ['bodyweight','squatBest','benchBest','deadliftBest'])if(!numeric(input.profile[field]))invalid();
      if(input.profile.age!=null&&(!numeric(input.profile.age,0,120)||!Number.isInteger(input.profile.age)))invalid();
      if(input.profile.name!=null&&typeof input.profile.name!=='string')invalid();
    }
    for(const lift of LIFTS){
      if(!object(input.plan)||!Array.isArray(input.plan[lift])||input.plan[lift].length!==3||!input.plan[lift].every(value=>numeric(value)))invalid();
      if(!object(input.results)||!Array.isArray(input.results[lift])||input.results[lift].length!==3||!input.results[lift].every(value=>['','good','miss'].includes(value)))invalid();
    }
    if(!Array.isArray(input.meets)||input.meets.length>10000)invalid();
    for(const meet of input.meets){
      if(!object(meet)||typeof meet.date!=='string'||typeof meet.meet!=='string')invalid();
      for(const field of ['bodyweight','squat','bench','deadlift','total','dots'])if(!numeric(meet[field],['squat','bench','deadlift'].includes(field)?-100000:0))invalid();
      if(meet.attempts)for(const lift of LIFTS)if(!Array.isArray(meet.attempts[lift])||meet.attempts[lift].length!==3||!meet.attempts[lift].every(value=>['','good','miss'].includes(value)))invalid();
    }
    if(input.goal!==null){
      if(!object(input.goal)||!numeric(input.goal.targetTotal))invalid();
      for(const field of ['targetDots','targetBodyweight'])if(input.goal[field]!=null&&!numeric(input.goal[field]))invalid();
    }
    if(!object(input.preferences))invalid();
    for(const [field,min,max] of [['homeLat',-90,90],['homeLon',-180,180]])if(input.preferences[field]!=null&&!numeric(input.preferences[field],min,max))invalid();
    const result={schema_version:1};
    for(const field of fields)result[field]=JSON.parse(JSON.stringify(input[field]));
    if(typeof input.saved_at==='string')result.saved_at=input.saved_at;
    return result;
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(object(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value;
  }
  function fingerprint(payload){return JSON.stringify(stable(Object.fromEntries(fields.map(key=>[key,payload[key]]))))}
  function backup(payload,language='system'){
    const data=validatePayload(payload);
    return {format:'powerlifting-performance-hub',version:1,exported_at:new Date().toISOString(),language,data};
  }
  function parseBackup(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('data.too_large');
    let value;try{value=JSON.parse(text)}catch(error){invalid()}
    if(!object(value)||value.format!=='powerlifting-performance-hub'||value.version!==1)invalid();
    const data=validatePayload(value.data);
    const language=['system','en','sk','cs','de','es','pl'].includes(value.language)?value.language:'system';
    return {data,language,exported_at:typeof value.exported_at==='string'?value.exported_at:''};
  }
  root.PPHData={MAX_BYTES,validatePayload,fingerprint,backup,parseBackup};
  if(typeof module!=='undefined')module.exports=root.PPHData;
})(typeof globalThis!=='undefined'?globalThis:this);
