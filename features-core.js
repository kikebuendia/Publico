'use strict';
(function(root) {
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function weekDays(now = new Date()) {
    const start = new Date(now); start.setHours(12,0,0,0); start.setDate(start.getDate() - (start.getDay()+6)%7);
    return Array.from({length:7}, (_, i) => {const date = new Date(start); date.setDate(start.getDate()+i); return dayKey(date);});
  }
  const defaults = () => ({routines:[], records:{}, away:{}, packingUrl:'', remindChatGPT:true});
  function validate(value) {
    if (value === undefined) return defaults();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Configuración diaria no válida.');
    const {routines, records, away, packingUrl, remindChatGPT} = value;
    const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayKey(new Date(v+'T12:00:00')) === v;
    const map = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!Array.isArray(routines) || !routines.every(r => r && typeof r.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(r.id) && typeof r.text === 'string' && r.text.trim() && r.text.length <= 200 && date(r.start) && (!r.end || date(r.end)))) throw Error('Rutinas no válidas.');
    if (new Set(routines.map(r=>r.id)).size !== routines.length || !map(records) || !map(away)) throw Error('Historial diario no válido.');
    for (const [d, items] of Object.entries(records)) if (!date(d) || !map(items) || !Object.entries(items).every(([id,status])=>routines.some(r=>r.id===id) && ['done','skip'].includes(status))) throw Error('Marcas diarias no válidas.');
    for (const [d, flag] of Object.entries(away)) if (!date(d) || typeof flag !== 'boolean') throw Error('Días fuera no válidos.');
    if (typeof packingUrl !== 'string' || typeof remindChatGPT !== 'boolean') throw Error('Configuración de maleta no válida.');
    if (packingUrl) {const url=new URL(packingUrl);if(url.protocol!=='https:' || url.hostname!=='keep.google.com')throw Error('Usa un enlace HTTPS de Google Keep.');}
    return {routines:routines.map(({id,text,start,end})=>({id,text,start,...(end?{end}:{})})), records:JSON.parse(JSON.stringify(records)), away:{...away}, packingUrl, remindChatGPT};
  }
  const due = (r,d) => r.start <= d && (!r.end || d < r.end);
  function summary(features, now = new Date()) {
    let done=0, total=0, skipped=0;
    for (const day of weekDays(now).filter(d=>d<=dayKey(now))) for (const routine of features.routines.filter(r=>due(r,day))) {
      const status=features.records[day]?.[routine.id];
      if(features.away[day] || status==='skip') {skipped++;continue;}
      total++;if(status==='done')done++;
    }
    return {done,total,skipped,percent:total?Math.round(100*done/total):null};
  }
  function trips(events, now = new Date()) {
    const days=weekDays(now), start=new Date(days[0]+'T00:00:00'), end=new Date(start);end.setDate(end.getDate()+7);
    const date = v => new Date(v?.dateTime || (v?.date ? v.date+'T00:00:00' : NaN));
    return events.filter(e => e.status!=='cancelled' && date(e.start)<end && date(e.end)>start && /\b(viaje|vuelo|flight|hotel|tren|train|aeropuerto|airport|vacaciones|travel|escapada)\b/i.test(`${e.summary||''} ${e.location||''}`));
  }
  const api={dayKey,weekDays,defaults,validate,due,summary,trips};
  if (typeof module!=='undefined') module.exports=api; else root.miDiaFeaturesCore=api;
})(globalThis);
