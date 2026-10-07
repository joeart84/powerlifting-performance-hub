(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PPHUX=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const lifts=['squat','bench','deadlift'];
  function decimal(value){const text=String(value??'').trim();if(!/^\d+(?:[.,]\d+)?$/.test(text))return null;const number=Number(text.replace(',','.'));return Number.isFinite(number)?number:null}
  function queue(plan={},results={}){return lifts.flatMap(lift=>Array.from({length:plan[lift]?.length===4?4:3},(_,index)=>({lift,index,weight:Number(plan[lift]?.[index])||0,result:results[lift]?.[index]||'',record:index===3})))}
  const KG_PER_LB=.45359237;
  function unit(preference='auto',locale=''){return preference==='lbs'||preference==='auto'&&/-US\b/i.test(locale)?'lbs':'kg'}
  function fromKg(value,units='kg'){return Number(value)/(units==='lbs'?KG_PER_LB:1)}
  function toKg(value,units='kg'){return Number(value)*(units==='lbs'?KG_PER_LB:1)}
  function swipe(dx,dy,duration){return duration<=650&&Math.abs(dx)>=70&&Math.abs(dx)>Math.abs(dy)*1.8?dx<0?1:-1:0}
  function nextStep(profile,plan,results){if(!profile?.meetDate)return 'find';if(queue(plan,results).some(a=>a.weight<=0))return 'plan';if(queue(plan,results).every(a=>a.result))return 'report';return 'meet'}
  function adjust(value,delta){const n=decimal(value);return Math.round(Math.max(0,(n??0)+delta)*100)/100}
  return {decimal,queue,nextStep,adjust,unit,fromKg,toKg,swipe};
});
