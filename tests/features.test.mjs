import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../features-core.js';
const routine=(id,start='2026-10-26')=>({id,text:id,start});
test('semanas lunes-domingo y fecha local, sin contar días futuros ni previos al alta',()=>{
  const now=new Date(2026,9,28,12), f=core.defaults();
  assert.deepEqual(core.weekDays(now),['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
  f.routines=[routine('a'),routine('b','2026-10-28')];
  f.records={'2026-10-26':{a:'done'},'2026-10-28':{b:'skip'}};
  assert.deepEqual(core.summary(f,now),{done:1,total:3,skipped:1,percent:33});
  f.away['2026-10-27']=true;
  assert.deepEqual(core.summary(f,now),{done:1,total:2,skipped:2,percent:50});
  f.away['2026-10-26']=true;f.away['2026-10-28']=true;
  assert.equal(core.summary(f,now).percent,null);
});
test('archivar conserva las oportunidades anteriores y semana nueva empieza a cero',()=>{
  const f=core.defaults();f.routines=[{...routine('a'),end:'2026-10-28'}];
  assert.equal(core.summary(f,new Date(2026,9,28,12)).total,2);
  assert.equal(core.summary(f,new Date(2026,10,2,12)).total,0);
});
test('validación conserva registros, rechaza URLs inseguras, fechas imposibles y marcas desconocidas',()=>{
  const f=core.defaults();f.routines=[routine('a')];f.records={'2026-10-26':{a:'done'}};
  assert.deepEqual(core.validate(f),f);
  assert.throws(()=>core.validate({...f,packingUrl:'https://example.com/'}));
  assert.throws(()=>core.validate({...f,away:{'2026-02-30':true}}));
  assert.throws(()=>core.validate({...f,records:{'2026-10-26':{b:'done'}}}));
});
test('viajes solo de esta semana, incluidos los que cruzan lunes; no cancelados ni fin exclusivo',()=>{
  const event=(summary,start,end,status)=>({summary,start:{date:start},end:{date:end},status});
  const events=[event('Vuelo Madrid','2026-10-28','2026-10-29'),event('Hotel','2026-10-25','2026-10-27'),event('Hotel','2026-10-25','2026-10-26'),event('Viaje','2026-11-02','2026-11-03'),event('Tren','2026-10-28','2026-10-29','cancelled'),event('Reunión','2026-10-28','2026-10-29')];
  assert.equal(core.trips(events,new Date(2026,9,28,12)).length,2);
});
