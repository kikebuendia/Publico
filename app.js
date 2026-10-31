'use strict';
const $ = id => document.getElementById(id);
const key = 'mi-dia-v1';
let state = { tasks: [], people: [], travels: [], meals: '', shopping: '' };
try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && ['tasks','people','travels'].every(k => Array.isArray(saved[k]))) state = {...state,...saved}; } catch { $('status').textContent = 'No se pudo leer el guardado anterior. Puedes empezar una lista nueva.'; }
$('date').textContent = new Intl.DateTimeFormat('es', {weekday:'long',day:'numeric',month:'long'}).format(new Date());
function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { $('status').textContent = 'No se pudo guardar. Exporta una copia para conservar tus datos.'; } render(); }
function safeUrl(value, keep = false) { try { const u = new URL(value); return u.protocol === 'https:' && (!keep || u.hostname === 'keep.google.com') ? u.href : null; } catch { return null; } }
function removeButton(action, label) { const b = document.createElement('button'); b.className = 'remove'; b.textContent = '×'; b.setAttribute('aria-label', label); b.onclick = action; return b; }
function renderList(kind) { $(kind).replaceChildren(); state[kind].forEach((item,i) => { const li = document.createElement('li'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!item.done; check.setAttribute('aria-label', `${kind === 'people' ? 'Marcar llamada hecha a' : 'Completar'} ${item.text}`); check.onchange = () => { item.done = check.checked; save(); }; const text = document.createElement('span'); text.textContent = item.text; li.classList.toggle('done',!!item.done); li.append(check,text,removeButton(() => {state[kind].splice(i,1);save();}, `Eliminar ${item.text}`)); $(kind).append(li); }); }
function render() { renderList('tasks'); renderList('people'); $('empty').hidden = state.tasks.length > 0; $('people-empty').hidden = state.people.length > 0; $('count').textContent = state.tasks.filter(t => !t.done).length; $('meals-link').href = safeUrl(state.meals,true) || 'https://keep.google.com/'; $('shopping-link').href = safeUrl(state.shopping,true) || 'https://keep.google.com/'; $('travels').replaceChildren(); state.travels.forEach((item,i) => { const li = document.createElement('li'); const a = document.createElement('a'); a.textContent = item.text + ' ↗'; a.href = safeUrl(item.url) || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a,removeButton(() => {state.travels.splice(i,1);save();},`Eliminar ${item.text}`)); $('travels').append(li); }); }
for (const [form,input,kind] of [['task-form','task','tasks'],['person-form','person','people']]) $(form).onsubmit = e => {e.preventDefault();const text = $(input).value.trim();if(!text)return;state[kind].push({text,done:false});$(input).value='';save();$(input).focus();};
$('configure').onclick = () => { $('meals').value = state.meals; $('shopping').value = state.shopping; $('settings-error').textContent=''; $('settings').showModal(); };
$('cancel').onclick = () => $('settings').close();
$('settings-form').onsubmit = e => { e.preventDefault(); const meals = safeUrl($('meals').value,true), shopping = safeUrl($('shopping').value,true); if(!meals || !shopping){$('settings-error').textContent='Usa direcciones HTTPS de keep.google.com para ambas notas.';return;}state.meals=meals;state.shopping=shopping;save();$('settings').close(); };
$('travel-form').onsubmit = e => {e.preventDefault();const url=safeUrl($('travel-url').value);if(!url){$('status').textContent='Usa un enlace de viaje que empiece por https://';return;}const text=$('travel-name').value.trim();if(!text)return;state.travels.push({text,url});$('travel-form').reset();save();};
$('export').onclick = () => {const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mi-dia-copia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato de copia no válido.');
  const text = value => typeof value === 'string' && value.trim().length > 0;
  for (const kind of ['tasks', 'people']) {
    if (!Array.isArray(data[kind]) || !data[kind].every(item => item && text(item.text) && typeof item.done === 'boolean')) {
      throw new Error('La copia contiene pendientes o personas no válidos.');
    }
  }
  if (!Array.isArray(data.travels) || !data.travels.every(item => item && text(item.text) && typeof item.url === 'string' && safeUrl(item.url))) {
    throw new Error('La copia contiene viajes no válidos.');
  }
  for (const kind of ['meals', 'shopping']) {
    if (typeof data[kind] !== 'string' || (data[kind] !== '' && !safeUrl(data[kind], true))) {
      throw new Error('La copia contiene enlaces de Keep no válidos.');
    }
  }
  return {
    tasks: data.tasks.map(({text, done}) => ({text, done})),
    people: data.people.map(({text, done}) => ({text, done})),
    travels: data.travels.map(({text, url}) => ({text, url})),
    meals: data.meals, shopping: data.shopping
  };
}
$('import').onclick = () => $('import-file').click();
$('import-file').onchange = async () => {
  const file = $('import-file').files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('La copia supera el máximo de 5 MB.');
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { throw new Error('No se pudo leer un archivo JSON válido.'); }
    const restored = validateBackup(data);
    if (!window.confirm(`Restaurar ${restored.tasks.length} pendientes, ${restored.people.length} personas, ${restored.travels.length} viajes y los enlaces de Keep. Esta copia reemplazará todos los datos actuales de este navegador. Exporta primero una copia si quieres conservarlos. ¿Continuar?`)) {
      $('status').textContent = 'Importación cancelada. Tus datos siguen igual.';
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(restored)); }
    catch { throw new Error('No se pudo guardar la copia en este navegador.'); }
    state = restored;
    render();
    $('status').textContent = 'Copia restaurada y guardada en este navegador.';
  } catch (error) {
    $('status').textContent = `${error.message} No se han cambiado tus datos.`;
  } finally {
    $('import-file').value = '';
  }
};
render();
