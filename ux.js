(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PPHUX=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const lifts=['squat','bench','deadlift'];
  function decimal(value){const text=String(value??'').trim();if(!/^\d+(?:[.,]\d+)?$/.test(text))return null;const number=Number(text.replace(',','.'));return Number.isFinite(number)?number:null}
  function queue(plan={},results={}){return lifts.flatMap(lift=>[0,1,2].map(index=>({lift,index,weight:Number(plan[lift]?.[index])||0,result:results[lift]?.[index]||''})))}
  function nextStep(profile,plan,results){if(!profile?.meetDate)return 'find';if(queue(plan,results).some(a=>a.weight<=0))return 'plan';if(queue(plan,results).every(a=>a.result))return 'report';return 'meet'}
  function adjust(value,delta){const n=decimal(value);return Math.round(Math.max(0,(n??0)+delta)*100)/100}
  return {decimal,queue,nextStep,adjust};
});
