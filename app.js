'use strict';
const $ = id => document.getElementById(id);
let key = 'mi-dia-v1';
let state = { tasks: [], people: [], travels: [], meals: '', shopping: '' };
try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && ['tasks','people','travels'].every(k => Array.isArray(saved[k]))) state = {...state,...saved}; } catch { $('status').textContent = 'No se pudo leer el guardado anterior. Puedes empezar una lista nueva.'; }
$('date').textContent = new Intl.DateTimeFormat('es', {weekday:'long',day:'numeric',month:'long'}).format(new Date());
function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch { $('status').textContent = 'No se pudo guardar. Exporta una copia para conservar tus datos.'; } render(); window.dispatchEvent(new Event('mi-dia-change')); }
function safeUrl(value, keep = false) { try { const u = new URL(value); return u.protocol === 'https:' && (!keep || u.hostname === 'keep.google.com') ? u.href : null; } catch { return null; } }
function removeButton(action, label) { const b = document.createElement('button'); b.className = 'remove'; b.textContent = '×'; b.setAttribute('aria-label', label); b.onclick = action; return b; }
let editingLocked = false;
let assistedTask = null;
const taskChecklists = new WeakMap();
const taskStepLimit = 500;

function taskSteps(item) {
  if (item.steps) return item.steps;
  const text = item.nextStep?.trim();
  return text ? [{text, done: false}] : [];
}

function enableTaskChecklists(data) {
  // Firestore uses this flag to stop older clients from dropping the checklist fields.
  data.features ??= window.miDiaFeaturesCore.defaults();
  data.features.taskChecklists = true;
}

function saveTaskSteps(item, steps) {
  if (editingLocked || !state.tasks.includes(item)) return;
  item.steps = steps;
  delete item.nextStep;
  enableTaskChecklists(state);
  save();
}

function renderTaskChecklist(item, steps) {
  const details = document.createElement('details');
  details.className = 'task-checklist';
  details.open = taskChecklists.get(item)?.open ?? false;
  taskChecklists.set(item, details);

  const summary = document.createElement('summary');
  const done = steps.filter(step => step.done).length;
  summary.textContent = steps.length ? `Pasos · ${done}/${steps.length}` : 'Añadir pasos';
  const list = document.createElement('ul');
  list.className = 'task-step-list';
  const form = document.createElement('form');
  form.className = 'task-step-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.required = true;
  input.maxLength = taskStepLimit;
  input.placeholder = 'Nuevo paso';
  input.setAttribute('aria-label', `Paso de ${item.text}`);
  const submit = document.createElement('button');
  submit.textContent = 'Añadir paso';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Cancelar';
  cancel.hidden = true;
  form.append(input, submit, cancel);

  function updateChecklist(nextSteps, focus = '.task-step-form input') {
    saveTaskSteps(item, nextSteps);
    taskChecklists.get(item).querySelector(focus)?.focus({preventScroll: true});
  }

  let editingIndex = -1;
  cancel.onclick = () => {
    editingIndex = -1;
    form.reset();
    submit.textContent = 'Añadir paso';
    cancel.hidden = true;
    input.focus();
  };
  form.onsubmit = event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const next = steps.slice();
    if (editingIndex < 0) next.push({text, done: false});
    else next[editingIndex] = {...steps[editingIndex], text};
    updateChecklist(next);
  };

  for (const [index, step] of steps.entries()) {
    const row = document.createElement('li');
    row.classList.toggle('done', step.done);
    row.dataset.stepIndex = index;
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = step.done;
    check.onchange = () => {
      const next = steps.slice();
      next[index] = {...step, done: check.checked};
      updateChecklist(next, `[data-step-index="${index}"] input`);
    };
    const text = document.createElement('span');
    text.textContent = step.text;
    label.append(check, text);

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'text-button';
    edit.textContent = 'Editar';
    edit.setAttribute('aria-label', `Editar paso ${step.text}`);
    edit.onclick = () => {
      editingIndex = index;
      input.value = step.text;
      submit.textContent = 'Guardar paso';
      cancel.hidden = false;
      input.focus();
    };
    const remove = removeButton(() => updateChecklist(steps.filter((_, i) => i !== index)), `Eliminar paso ${step.text}`);
    row.append(label, edit, remove);
    list.append(row);
  }
  details.append(summary, list, form);
  return details;
}

function renderList(kind) {
  $(kind).replaceChildren();
  state[kind].forEach((item, i) => {
    const li = document.createElement('li');
    const check = document.createElement('input');
    check.type = 'checkbox'; check.checked = !!item.done;
    check.setAttribute('aria-label', `${kind === 'people' ? 'Marcar llamada hecha a' : 'Completar'} ${item.text}`);
    check.onchange = () => { item.done = check.checked; save(); };
    const content = document.createElement('div'); content.className = 'list-content';
    const text = document.createElement('span'); text.textContent = item.text; content.append(text);
    if (kind === 'tasks') {
      const steps = taskSteps(item);
      const next = steps.find(step => !step.done);
      if (next && !item.done) {
        const preview = document.createElement('small');
        preview.className = 'next-step';
        preview.textContent = `Próximo paso: ${next.text}`;
        content.append(preview);
      }
      const help = document.createElement('button'); help.type = 'button'; help.className = 'task-help secondary';
      help.textContent = 'Preparar con ChatGPT'; help.setAttribute('aria-label', `Preparar con ChatGPT: ${item.text}`);
      help.onclick = () => openTaskHelp(item);
      content.append(renderTaskChecklist(item, steps), help);
    }
    li.classList.toggle('done', !!item.done);
    li.append(check, content, removeButton(() => { state[kind].splice(i, 1); save(); }, `Eliminar ${item.text}`));
    li.querySelectorAll('button, input').forEach(node => node.disabled = editingLocked);
    $(kind).append(li);
  });
}
function taskPrompt() {
  const lines = [
    'Ayúdame a resolver este recado:', $('help-title').textContent,
    $('help-step').value.trim() ? `Próximo paso previsto: ${$('help-step').value.trim()}` : '',
    $('help-context').value.trim() ? `Contexto que quiero compartir: ${$('help-context').value.trim()}` : '',
    'Propón el siguiente paso concreto y un plan breve. Si puedes preparar un borrador, una comparación o material útil, hazlo. Pregunta solo por los datos imprescindibles que falten y no inventes información. No envíes mensajes ni realices compras sin mi autorización.'
  ];
  return lines.filter(Boolean).join('\n\n');
}
function updateTaskPrompt() { $('help-prompt').value = taskPrompt(); $('help-status').textContent = ''; }
function openTaskHelp(item) {
  assistedTask = item;
  $('help-title').textContent = item.text;
  $('help-step').value = taskSteps(item).find(step => !step.done)?.text ?? '';
  $('help-context').value = '';
  updateTaskPrompt(); $('task-help-dialog').showModal();
}
$('help-step').oninput = updateTaskPrompt;
$('help-context').oninput = updateTaskPrompt;
$('help-close').onclick = () => $('task-help-dialog').close();
$('help-save').onclick = () => {
  if (editingLocked || !state.tasks.includes(assistedTask)) {
    $('help-status').textContent = 'La lista cambió. Cierra esta ventana y abre de nuevo el recado antes de guardar.'; return;
  }
  const text = $('help-step').value.trim();
  if (assistedTask.steps) {
    if (!text) {
      $('help-status').textContent = 'Escribe un próximo paso para guardarlo en el checklist.';
      return;
    }
    const steps = assistedTask.steps.slice();
    const index = steps.findIndex(step => !step.done);
    const step = {text, done: false};
    if (index >= 0) steps[index] = step;
    else steps.push(step);
    saveTaskSteps(assistedTask, steps);
  } else {
    assistedTask.nextStep = text;
    save();
  }
  $('help-status').textContent = 'Próximo paso guardado. Consulta el estado en la tarjeta de cuenta.';
};
$('help-copy').onclick = async () => {
  const prompt = $('help-prompt').value;
  try {
    await navigator.clipboard.writeText(prompt);
    $('help-status').textContent = 'Petición copiada. Abre ChatGPT y pégala en una conversación.';
  } catch {
    $('help-prompt').focus(); $('help-prompt').select();
    $('help-status').textContent = 'No se pudo copiar automáticamente. Copia el texto seleccionado y pégalo en ChatGPT.';
  }
};

function render() { renderList('tasks'); renderList('people'); $('empty').hidden = state.tasks.length > 0; $('people-empty').hidden = state.people.length > 0; $('count').textContent = state.tasks.filter(t => !t.done).length; $('meals-link').href = safeUrl(state.meals,true) || 'https://keep.google.com/'; $('travels').replaceChildren(); state.travels.forEach((item,i) => { const li = document.createElement('li'); const a = document.createElement('a'); a.textContent = item.text + ' ↗'; a.href = safeUrl(item.url) || '#'; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a,removeButton(() => {state.travels.splice(i,1);save();},`Eliminar ${item.text}`)); $('travels').append(li); }); window.dispatchEvent(new Event('mi-dia-render')); }
for (const [form,input,kind] of [['task-form','task','tasks'],['person-form','person','people']]) $(form).onsubmit = e => {e.preventDefault();const text = $(input).value.trim();if(!text)return;state[kind].push({text,done:false});$(input).value='';save();$(input).focus();};
// El dictado solo rellena el borrador: el usuario decide cuándo añadirlo.
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let dictation = null;
function bindDictation({button, input, status, submit}) {
  const buttonText = button.textContent;
  const resetVoice = () => {
    button.textContent = buttonText;
    button.setAttribute('aria-pressed', 'false');
    submit.disabled = editingLocked;
  };
  button.onclick = () => {
    if (editingLocked) return;
    if (dictation?.button === button) {
      dictation.recognition.stop();
      return;
    }
    dictation?.cancel();
    if (!Recognition || !window.isSecureContext) {
      status.textContent = 'Este navegador no permite dictado aquí. Puedes usar el micrófono del teclado del móvil o escribir.';
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    const draft = input.value.trim();
    let received = false;
    let failed = false;
    dictation = {recognition, button, cancel: () => {
      dictation = null;
      resetVoice();
      recognition.abort();
    }};
    recognition.onresult = event => {
      if (dictation?.recognition !== recognition || editingLocked) return;
      const fragments = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) fragments.push(event.results[i][0].transcript.trim());
      }
      const spoken = fragments.join(' ').trim();
      if (!spoken) return;
      received = true;
      const full = [draft, spoken].filter(Boolean).join(' ');
      input.value = full.slice(0, input.maxLength);
      status.textContent = full.length > input.maxLength
        ? `El texto se ha recortado a ${input.maxLength} caracteres. Revísalo antes de guardar.`
        : 'Revisa el texto antes de guardar.';
    };
    recognition.onerror = event => {
      if (dictation?.recognition !== recognition) return;
      failed = true;
      const messages = {
        'not-allowed': 'No hay permiso para usar el micrófono. Permítelo en los ajustes del sitio de Chrome o usa el teclado.',
        'service-not-allowed': 'El navegador no permite el servicio de dictado. Prueba con el micrófono del teclado.',
        'audio-capture': 'No se pudo acceder al micrófono. Comprueba que está disponible.',
        'no-speech': 'No se ha detectado voz. Pulsa Dictar para intentarlo otra vez.',
        network: 'El dictado no pudo conectarse. Comprueba tu conexión e inténtalo de nuevo.',
        aborted: 'Dictado detenido. Puedes editar el texto o volver a intentarlo.'
      };
      status.textContent = messages[event.error] || 'No se pudo completar el dictado. Puedes volver a intentarlo o escribir.';
    };
    recognition.onend = () => {
      if (dictation?.recognition !== recognition) return;
      dictation = null;
      resetVoice();
      if (!received && !failed) status.textContent = 'No se ha detectado texto. Puedes volver a dictar o escribir.';
    };
    try {
      recognition.start();
      button.textContent = '■ Terminar dictado';
      button.setAttribute('aria-pressed', 'true');
      submit.disabled = true;
      status.textContent = 'Escuchando… Podrás revisar el texto antes de guardarlo.';
    } catch {
      dictation = null;
      resetVoice();
      status.textContent = 'No se pudo iniciar el dictado. Puedes usar el micrófono del teclado o escribir.';
    }
  };
  return () => { if (dictation?.button === button) dictation.cancel(); };
}
bindDictation({button: $('voice-task'), input: $('task'), status: $('voice-status'), submit: $('task-form').querySelector('button')});
window.addEventListener('pagehide', () => dictation?.cancel());
window.addEventListener('mi-dia-account-change', () => dictation?.cancel());

$('configure').onclick = () => { $('meals').value = state.meals; $('settings-error').textContent=''; $('settings').showModal(); };
$('cancel').onclick = () => $('settings').close();
$('settings-form').onsubmit = e => { e.preventDefault(); const meals = safeUrl($('meals').value,true); if(!meals){$('settings-error').textContent='Usa una dirección HTTPS de keep.google.com para la nota.';return;}state.meals=meals;save();$('settings').close(); };
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
  for (const kind of ['meals']) {
    if (typeof data[kind] !== 'string' || (data[kind] !== '' && !safeUrl(data[kind], true))) {
      throw new Error('La copia contiene enlaces de Keep no válidos.');
    }
  }
  if (data.tasks.some(item => item.nextStep !== undefined && (typeof item.nextStep !== 'string' || item.nextStep.length > 500))) {
    throw new Error('La copia contiene un próximo paso no válido (máximo 500 caracteres).');
  }
  if (data.tasks.some(({steps}) => steps !== undefined && (!Array.isArray(steps)
    || !steps.every(step => step && text(step.text) && step.text.length <= taskStepLimit && typeof step.done === 'boolean')))) {
    throw new Error('La copia contiene un checklist de recado no válido.');
  }
  const result = {
    tasks: data.tasks.map(({text, done, nextStep, steps}) => ({
      text, done,
      ...(nextStep === undefined ? {} : {nextStep}),
      ...(steps === undefined ? {} : {steps: steps.map(({text, done}) => ({text, done}))})
    })),
    people: data.people.map(({text, done}) => ({text, done})),
    travels: data.travels.map(({text, url}) => ({text, url})),
    ...(data.features === undefined ? {} : {features: window.miDiaFeaturesCore.validate(data.features)}),
    meals: data.meals, shopping: typeof data.shopping === 'string' ? data.shopping : ''
  };
  if (result.tasks.some(task => task.steps !== undefined)) enableTaskChecklists(result);
  return result;
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
    if (data.features === undefined && state.features) restored.features = window.miDiaFeaturesCore.validate(state.features);
    if (data.features?.personal === undefined && state.features?.personal) {
      restored.features ??= window.miDiaFeaturesCore.defaults();
      restored.features.personal = window.miDiaPersonalCore.validate(state.features.personal);
    }
    if (data.features?.menu === undefined && state.features?.menu) {
      restored.features ??= window.miDiaFeaturesCore.defaults();
      restored.features.menu = state.features.menu;
    }
    if (data.features?.personal && data.features.personal.purchases === undefined && state.features?.personal?.purchases) {
      restored.features.personal.purchases = state.features.personal.purchases;
    }
    if (state.features?.taskChecklists) enableTaskChecklists(restored);
    if (!window.confirm(`Restaurar ${restored.tasks.length} recados con sus pasos, ${restored.people.length} personas, ${restored.travels.length} viajes y el enlace de Keep. Los datos de checklist diario, maleta, trámites, ahorro, planes, detalles, tickets, bonos y menú incluidos en la copia reemplazarán los actuales. Exporta primero una copia si quieres conservarlos. ¿Continuar?`)) {
      $('status').textContent = 'Importación cancelada. Tus datos siguen igual.';
      return;
    }
    try { localStorage.setItem(key, JSON.stringify(restored)); }
    catch { throw new Error('No se pudo guardar la copia en este navegador.'); }
    state = restored;
    render();
    window.dispatchEvent(new Event('mi-dia-change'));
    $('status').textContent = 'Copia restaurada. Consulta el estado en la tarjeta de cuenta.';
  } catch (error) {
    $('status').textContent = `${error.message} No se han cambiado tus datos.`;
  } finally {
    $('import-file').value = '';
  }
};
render();

window.miDia = {
  read: () => JSON.parse(JSON.stringify(state)),
  updateFeatures(value) {
    if (editingLocked) throw new Error('Espera a que se carguen tus listas.');
    state.features = window.miDiaFeaturesCore.validate(value); save();
  },
  bindDictation,
  importEntries(file) {
    if (editingLocked) throw Error('Espera a que se carguen tus listas.');
    const entries = Array.isArray(file) ? {procedures: file} : file;
    if (!entries || typeof entries !== 'object' || (!Object.hasOwn(entries, 'procedures') && !Object.hasOwn(entries, 'tasks'))) {
      throw Error('Formato de lista no válido.');
    }
    const tasks = entries.tasks === undefined ? [] : entries.tasks;
    if (!Array.isArray(tasks) || !tasks.every(text => typeof text === 'string' && text.trim() && text.length <= 200)) {
      throw Error('La lista contiene recados no válidos.');
    }
    const core = window.miDiaPersonalCore;
    const procedures = entries.procedures === undefined ? [] : core.validate({...core.defaults(), procedures: entries.procedures}).procedures;
    const features = window.miDiaFeaturesCore.validate(state.features);
    const personal = features.personal ??= core.defaults();
    const unique = (existing, items) => {
      const names = new Set(existing.map(name => name.trim().toLocaleLowerCase('es')));
      return items.filter(name => {
        const normalized = name.trim().toLocaleLowerCase('es');
        if (names.has(normalized)) return false;
        names.add(normalized);
        return true;
      });
    };
    const titles = unique(state.tasks.map(item => item.text), tasks);
    const names = new Set(unique(personal.procedures.map(item => item.name), procedures.map(item => item.name)));
    let added = 0;
    for (const item of procedures) {
      if (!names.delete(item.name)) continue;
      personal.procedures.push({...item, id: crypto.randomUUID()});
      added++;
    }
    if (added || titles.length) {
      state.tasks.push(...titles.map(text => ({text: text.trim(), done: false})));
      state.features = features;
      save();
    }
    return {procedures: added, tasks: titles.length};
  },
  validate: validateBackup,
  useAccount(uid) { key = uid ? `mi-dia-account-${uid}` : 'mi-dia-v1'; },
  apply(data) {
    const next = validateBackup(data);
    localStorage.setItem(key, JSON.stringify(next));
    state = next; render();
  },
  lock(locked) {
    editingLocked = locked;
    if (locked) dictation?.cancel();
    window.dispatchEvent(new CustomEvent('mi-dia-lock', {detail: locked}));
    document.querySelectorAll('.tasks input, .tasks button, .grid input, .grid button, #import, #settings input, #settings button, #help-save, .daily input, .daily button, .daily select, #packing-settings input, #packing-settings button').forEach(node => node.disabled = locked);
  }
};
