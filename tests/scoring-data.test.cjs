const test=require('node:test'),assert=require('node:assert/strict');
const scoring=require('../scoring.js'),data=require('../hub-data.js'),website=require('./fixtures/website-scoring.cjs');
function payload(){return {schema_version:1,profile:{name:'Test Athlete',sex:'M',age:50,bodyweight:83,squatBest:220,benchBest:140,deadliftBest:240},plan:{squat:[200,210,220],bench:[125,135,140],deadlift:[220,230,240]},results:{squat:['good','',''],bench:['','',''],deadlift:['','','']},meets:[],goal:null,preferences:{homeLat:0,homeLon:0},saved_at:'2026-10-06T12:00:00Z'}}
test('DOTS matches live website coefficients and boundary rules for both sexes',()=>{
 for(const [sex,gender] of [['M','male'],['F','female']])for(const bw of [1,39.9,40,50,63,83,150,150.01,210,250]){
  assert.equal(scoring.dots(sex,bw,600),600*website.dotsCoeff(gender,bw));
 }
 assert.equal(scoring.dots('M',0,600),null);assert.equal(scoring.dots('M',83,-600),null);
 assert.equal(scoring.dots('X',83,600),null);
 assert.equal(scoring.dots('M',83,600).toFixed(2),'405.05');
 assert.equal(scoring.dots('F',63,400).toFixed(2),'430.21');
});
test('Reshel retains legacy lookup rules and restores independently sourced missing entries',()=>{
 const restored=require('../scoring-reference/reshel-restored.json');
 for(const [gender,entries] of Object.entries(restored))for(const [weight,value] of Object.entries(entries)){
  assert.equal(require(`./fixtures/legacy-reshel-${gender}.json`).coeff[weight],undefined);
  assert.equal(scoring.reshelCoefficient(gender==='male'?'M':'F',Number(weight)),value);
 }
 for(const [sex,gender,max] of [['M','male',200],['F','female',125.24]]){
  const legacy=require(`./fixtures/legacy-reshel-${gender}.json`);
  const entries=Object.entries({...legacy.coeff,...restored[gender]}).map(([k,v])=>[Number(k),v]).sort((a,b)=>a[0]-b[0]);
  for(let bw=39.75;bw<=max+.25;bw+=.25){
   for(const delta of [0,.001,.249999999]){
    const weight=Math.round((bw+delta)*1e8)/1e8,key=Math.floor(weight/.25)*.25;
    const expected=weight<legacy.min||weight>legacy.max?NaN:entries.filter(([k])=>k<=key&&k>=key-1).at(-1)?.[1];
    const actual=scoring.reshelCoefficient(sex,bw+delta);
    assert.equal(actual,Number.isFinite(expected)?expected:null,`${sex} ${bw+delta}`);
   }
  }
 }
 assert.equal(scoring.reshelCoefficient('M',NaN),null);
 assert.equal(scoring.reshel('M',109.37,600).toFixed(2),'532.20');
 assert.equal(scoring.reshelCoefficient('M',109.499),.887);
 assert.equal(scoring.reshelCoefficient('M',109.5),.886);
 assert.equal(scoring.reshel('F',118.65,400).toFixed(2),'523.20');
 assert.equal(scoring.reshelCoefficient('M',195),null);
});
test('Age-adjusted total agrees with website across all supported ages',()=>{
 for(let age=13;age<=91;age++){
  const factor=website.ageCoeff(age).coeff;
  assert.equal(scoring.ageAdjustedTotal(600,age),Number.isFinite(factor)?600*factor:null);
 }
 assert.equal(scoring.ageAdjustedTotal(600,50).toFixed(1),'678.0');
 assert.equal(scoring.ageAdjustedTotal(600,18),636);
 assert.equal(scoring.ageAdjustedTotal(600,50.5),null);
});
test('backup round-trip preserves plans, results, history, goals and language',()=>{
 const p=payload();p.meets=[{date:'2026-09-01',meet:'Demo',bodyweight:83,squat:220,bench:140,deadlift:240,total:600,dots:405.05}];p.goal={targetTotal:625,targetDots:420,targetBodyweight:83};
 const parsed=data.parseBackup(JSON.stringify(data.backup(p,'sk')));
 assert.deepEqual(parsed.data,p);assert.equal(parsed.language,'sk');
 assert.equal(data.fingerprint(p),data.fingerprint({...p,saved_at:'later'}));
 const reordered={...p,profile:Object.fromEntries(Object.entries(p.profile).reverse())};assert.equal(data.fingerprint(p),data.fingerprint(reordered));
});
test('bad files and unsafe cloud data are rejected before replacement',()=>{
 assert.throws(()=>data.parseBackup('{broken'));
 assert.throws(()=>data.parseBackup(JSON.stringify(payload())));
 const valid=data.backup(payload());
 assert.throws(()=>data.parseBackup(JSON.stringify({...valid,version:2})));
 assert.throws(()=>data.validatePayload({...payload(),plan:{squat:[1],bench:[1,2,3],deadlift:[1,2,3]}}));
 assert.throws(()=>data.validatePayload({...payload(),results:{squat:['good','bad',''],bench:['','',''],deadlift:['','','']}}));
 assert.throws(()=>data.validatePayload({...payload(),schema_version:2}));
 assert.throws(()=>data.validatePayload({...payload(),token:'must-not-export'}));
 assert.throws(()=>data.parseBackup('{"format":"powerlifting-performance-hub","version":1,"data":{"__proto__":{}}}'));
 assert.throws(()=>data.parseBackup(' '.repeat(data.MAX_BYTES+1)),/too_large/);
});
module.exports={payload};
