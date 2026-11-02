'use strict';
(() => {
  const core=window.miDiaFeaturesCore, app=window.miDia, el=id=>document.getElementById(id);
  let selected=core.dayKey(), lastToday=core.dayKey(), locked=false, calendarEvents=null;
  const read=()=>core.validate(app.read().features);
  function change(edit) {
    if(locked)return;
    try {const value=read();edit(value);app.updateFeatures(value);el('daily-status').textContent='';}
    catch(error){el('daily-status').textContent=error.message;}
  }
  function render() {
    const value=read(), today=core.dayKey(), days=core.weekDays().filter(d=>d<=today);
    if(!days.includes(selected))selected=today;
    el('daily-date').replaceChildren();
    for(const day of days){const option=document.createElement('option');option.value=day;option.textContent=new Date(day+'T12:00:00').toLocaleDateString('es',{weekday:'long',day:'numeric',month:'short'});option.selected=day===selected;el('daily-date').append(option);}
    el('daily-away').setAttribute('aria-pressed',String(!!value.away[selected]));
    el('daily-away').textContent=value.away[selected]?'Día fuera · volver a contar':'Día fuera · no aplica';
    const stats=core.summary(value);
    el('daily-summary').textContent=`Esta semana: ${stats.done}/${stats.total} completadas${stats.percent===null?' · Sin tareas aplicables':` · ${stats.percent}%`} · ${stats.skipped} no aplican`;
    el('daily-list').replaceChildren();
    const routines=value.routines.filter(r=>core.due(r,selected));
    el('daily-empty').hidden=!!routines.length;
    for(const routine of routines){
      const li=document.createElement('li'), label=document.createElement('label'), check=document.createElement('input'), text=document.createElement('span');
      const status=value.records[selected]?.[routine.id];check.type='checkbox';check.checked=status==='done';check.disabled=locked || !!value.away[selected] || status==='skip';
      check.onchange=()=>change(v=>{v.records[selected]??={};if(check.checked)v.records[selected][routine.id]='done';else delete v.records[selected][routine.id];});
      text.textContent=routine.text;label.append(check,text);
      const skip=document.createElement('button');skip.type='button';skip.className='secondary';skip.textContent=status==='skip'?'Volver a contar':'No aplica';skip.disabled=locked || !!value.away[selected];skip.setAttribute('aria-label',`${skip.textContent}: ${routine.text}`);
      skip.onclick=()=>change(v=>{v.records[selected]??={};if(status==='skip')delete v.records[selected][routine.id];else v.records[selected][routine.id]='skip';});
      const archive=document.createElement('button');archive.type='button';archive.className='text-button';archive.textContent='Dejar de repetir';archive.disabled=locked;
      archive.onclick=()=>{if(!confirm('Dejará de contar desde hoy. Se conservarán los días anteriores. ¿Continuar?'))return;change(v=>{v.routines.find(r=>r.id===routine.id).end=core.dayKey();});};
      li.append(label,skip,archive);el('daily-list').append(li);
    }
    el('chatgpt-reminder').hidden=!value.remindChatGPT;
    el('packing-link').hidden=!value.packingUrl;if(value.packingUrl)el('packing-link').href=value.packingUrl;
    el('packing-trips').replaceChildren();
    const possible=core.trips(calendarEvents||[]);
    el('packing-detection').textContent=calendarEvents===null?'Conecta o actualiza el calendario para buscar posibles viajes esta semana.':possible.length?`${possible.length} posible(s) viaje(s) esta semana. Revisa si necesitas maleta.`:'No hemos identificado viajes esta semana. Puedes preparar la maleta manualmente.';
    for(const event of possible){const li=document.createElement('li');li.textContent=`${event.summary||'Sin título'} · ${event.start.date||new Date(event.start.dateTime).toLocaleDateString('es')}${event.location?' · '+event.location:''}`;el('packing-trips').append(li);}
    el('routine-text').disabled=locked;el('routine-form').querySelector('button').disabled=locked;el('daily-date').disabled=locked;el('daily-away').disabled=locked;el('reminder-dismiss').disabled=locked;
  }
  el('routine-form').onsubmit=e=>{e.preventDefault();const text=el('routine-text').value.trim();if(!text)return;change(v=>v.routines.push({id:crypto.randomUUID(),text,start:core.dayKey()}));el('routine-text').value='';};
  el('daily-date').onchange=()=>{selected=el('daily-date').value;render();};
  el('daily-away').onclick=()=>change(v=>{v.away[selected]=!v.away[selected];});
  el('reminder-dismiss').onclick=()=>change(v=>{v.remindChatGPT=false;});
  el('packing-configure').onclick=()=>{el('packing-url').value=read().packingUrl;el('packing-error').textContent='';el('packing-settings').showModal();};
  el('packing-cancel').onclick=()=>el('packing-settings').close();
  el('packing-form').onsubmit=e=>{e.preventDefault();if(locked)return;try{const v=read();v.packingUrl=el('packing-url').value.trim();app.updateFeatures(v);el('packing-settings').close();}catch(error){el('packing-error').textContent=error.message;}};
  el('packing-help').onclick=()=>{
    const possible=core.trips(calendarEvents||[]);
    el('packing-context').value=possible.map(e=>`${e.summary||'Viaje'}: ${e.start.date||e.start.dateTime} → ${e.end.date||e.end.dateTime}${e.location?' · '+e.location:''}`).join('\n');
    el('packing-copy-status').textContent='';updatePrompt();el('packing-help-dialog').showModal();
  };
  function updatePrompt(){el('packing-prompt').value=`Ayúdame a preparar una maleta práctica, sin llevar de más.\n\nDatos del viaje que confirmo:\n${el('packing-context').value.trim() || '(Por concretar)'}\n\nPregunta solo lo imprescindible sobre destino, duración, clima previsto, actividades, equipaje permitido y posibilidad de lavar ropa. No des por hecho que todos los eventos son viajes ni inventes la previsión meteorológica. Propón una checklist para copiar a Google Keep, agrupada por categorías, con cantidades justificadas y lo que debo comprobar antes de salir. No tienes acceso al contenido de mi nota de Keep salvo que lo pegue aquí.`;}
  el('packing-context').oninput=updatePrompt;
  el('packing-copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('packing-prompt').value);el('packing-copy-status').textContent='Copiado. Pégalo en ChatGPT.';}catch{el('packing-prompt').focus();el('packing-prompt').select();el('packing-copy-status').textContent='Copia el texto seleccionado manualmente.';}};
  el('packing-help-close').onclick=()=>el('packing-help-dialog').close();
  window.addEventListener('mi-dia-render',render);
  window.addEventListener('mi-dia-lock',e=>{locked=e.detail;render();});
  window.addEventListener('mi-dia-calendar-events',e=>{calendarEvents=e.detail;render();});
  window.addEventListener('mi-dia-account-change',()=>{calendarEvents=null;el('packing-help-dialog').close();el('packing-context').value='';el('packing-prompt').value='';render();});
  window.addEventListener('focus',render);
  setInterval(()=>{if(core.dayKey()!==lastToday){lastToday=core.dayKey();selected=lastToday;render();}},60000);
  render();
})();
