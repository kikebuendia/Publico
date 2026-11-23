'use strict';
(() => {
  const app = window.miDia;
  const core = window.miDiaPersonalCore;
  const features = window.miDiaFeaturesCore;
  const el = id => document.getElementById(id);
  const editor = el('personal-editor');
  const form = el('personal-form');
  const fields = {
    procedures: el('personal-procedure-fields'),
    savings: el('personal-saving-fields'),
    plans: el('personal-plan-fields')
  };
  const labels = {procedures: 'trámite', savings: 'objetivo', plans: 'plan', details: 'detalle'};
  const money = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR'});
  const dates = new Intl.DateTimeFormat('es-ES', {dateStyle: 'medium', timeZone: 'UTC'});
  let locked = false;
  let editing;

  const views = document.querySelectorAll('.dashboard-nav button');
  for (const view of views) view.onclick = () => {
    for (const button of views) {
      button.setAttribute('aria-pressed', String(button === view));
      el(button.getAttribute('aria-controls')).hidden = button !== view;
    }
  };
  el('show-procedures').onclick = () => {
    document.querySelector('.dashboard-nav [aria-controls="view-procedures"]').click();
    el('procedures-title').focus();
  };

  function read() {
    return features.validate(app.read().features);
  }

  function change(edit) {
    if (locked) throw Error('Espera a que se carguen tus listas.');
    const state = read();
    state.personal ??= core.defaults();
    edit(state.personal);
    app.updateFeatures(state);
  }

  function open(kind, item, group = kind) {
    if (locked) return;
    editing = {kind, item};
    form.reset();
    el('personal-error').textContent = '';
    el('personal-editor-title').textContent = `${item ? 'Editar' : 'Añadir'} ${labels[group]}`;
    for (const [name, group] of Object.entries(fields)) group.hidden = group.disabled = name !== kind;
    el('personal-name').value = item?.name ?? '';
    if (kind === 'procedures') {
      el('personal-date').value = item?.date ?? '';
      el('personal-months').value = item?.months || '';
    }
    if (kind === 'savings') {
      el('personal-target').value = item?.target ? item.target / 100 : '';
      el('personal-saved').value = item?.saved ? item.saved / 100 : '';
    }
    if (kind === 'plans') {
      const options = Object.entries(core.ideaGroups[group]).map(([value, label]) => new Option(label, value));
      el('personal-category').replaceChildren(...options);
      if (item) el('personal-category').value = item.category;
    }
    editor.showModal();
  }

  function entryFields(kind, previous) {
    if (kind === 'procedures') {
      const date = el('personal-date').value;
      const months = Number(el('personal-months').value);
      if (months && !date) throw Error('Indica la próxima fecha para repetir este trámite.');
      return {date, months, anchor: date === previous?.date ? previous.anchor : Number(date.slice(-2)) || 1};
    }
    if (kind === 'savings') {
      const cents = id => Math.round(Number(el(id).value) * 100);
      return {target: cents('personal-target') || null, saved: cents('personal-saved')};
    }
    return {category: el('personal-category').value};
  }

  form.onsubmit = event => {
    event.preventDefault();
    const {kind, item} = editing;
    try {
      const entry = {
        id: item?.id ?? crypto.randomUUID(),
        name: el('personal-name').value.trim(),
        ...entryFields(kind, item)
      };
      change(data => {
        const index = item ? data[kind].findIndex(other => other.id === item.id) : -1;
        if (item && (index < 0 || JSON.stringify(data[kind][index]) !== JSON.stringify(item))) {
          throw Error('Esta entrada cambió. Vuelve a abrirla para editarla.');
        }
        if (index < 0) data[kind].push(entry);
        else data[kind][index] = entry;
      });
      editor.close();
    } catch (error) {
      el('personal-error').textContent = error.message;
    }
  };

  el('personal-cancel').onclick = () => editor.close();
  for (const button of document.querySelectorAll('[data-add-personal]')) {
    button.onclick = () => open(button.dataset.addPersonal, undefined, button.dataset.ideaGroup);
  }

  function action(text, handler, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = text;
    button.setAttribute('aria-label', `${text}: ${name}`);
    button.disabled = locked;
    button.onclick = handler;
    return button;
  }

  function describe(kind, item, today) {
    if (kind === 'procedures') {
      if (!item.date) return 'Sin fecha';
      const date = dates.format(new Date(item.date + 'T00:00:00Z'));
      const recurrence = item.months === 1 ? ' · Cada mes' : item.months ? ` · Cada ${item.months} meses` : '';
      const status = item.date < today ? 'Vencido · ' : item.date === today ? 'Hoy · ' : '';
      return status + date + recurrence;
    }
    if (kind === 'savings') {
      const saved = money.format(item.saved / 100);
      return item.target === null ? (item.saved ? `${saved} ahorrados` : 'Importe por definir')
        : `${saved} de ${money.format(item.target / 100)}${item.saved >= item.target ? ' · Meta alcanzada' : ''}`;
    }
    return '';
  }

  function renderList(list, kind, items, empty, group) {
    list.replaceChildren();
    if (!items.length) {
      if (!empty) return;
      const placeholder = document.createElement('li');
      placeholder.className = 'note';
      placeholder.textContent = empty;
      list.append(placeholder);
      return;
    }
    const today = features.dayKey();
    for (const item of items) {
      const row = document.createElement('li');
      const info = document.createElement('div');
      info.className = 'list-content';
      const name = document.createElement('span');
      name.textContent = item.name;
      info.append(name);
      const description = describe(kind, item, today);
      if (description) {
        const detail = document.createElement('small');
        detail.className = 'next-step';
        detail.textContent = description;
        info.append(detail);
      }
      row.append(info);
      if (kind === 'procedures' && item.months) {
        const next = core.nextDate(item, today);
        row.append(action('Pasar a la próxima fecha', () => {
          change(data => { data.procedures.find(entry => entry.id === item.id).date = next; });
        }, item.name));
      }
      row.append(action('Editar', () => open(kind, item, group), item.name));
      row.append(action('Quitar', () => {
        if (confirm(`¿Quitar «${item.name}»?`)) change(data => {
          data[kind] = data[kind].filter(entry => entry.id !== item.id);
        });
      }, item.name));
      list.append(row);
    }
  }

  function renderUpcoming(procedures) {
    const today = features.dayKey();
    const upcoming = core.upcomingProcedures(procedures, today);
    const list = el('upcoming-procedures');
    list.replaceChildren();
    el('upcoming-empty').hidden = upcoming.length > 0;
    for (const item of upcoming) {
      const row = document.createElement('li');
      const name = document.createElement('span');
      const date = document.createElement('time');
      name.textContent = item.name;
      date.dateTime = item.date;
      date.textContent = item.date === today ? 'Hoy' : dates.format(new Date(item.date + 'T00:00:00Z'));
      row.append(name, date);
      list.append(row);
    }
  }

  function render() {
    const data = read().personal ?? core.defaults();
    renderUpcoming(data.procedures);
    const procedures = data.procedures.sort((a, b) => (a.date || '∞').localeCompare(b.date || '∞'));
    renderList(el('personal-procedures'), 'procedures', procedures, 'Añade una revisión, la ITV o un plazo que quieras recordar.');
    renderList(el('personal-savings'), 'savings', data.savings, 'Aún no has añadido objetivos.');
    for (const [group, categories] of Object.entries(core.ideaGroups)) {
      const container = el(`personal-${group}`);
      container.replaceChildren();
      for (const [category, label] of Object.entries(categories)) {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        const list = document.createElement('ul');
        heading.textContent = label;
        renderList(list, 'plans', data.plans.filter(item => item.category === category), '', group);
        section.append(heading, list);
        container.append(section);
      }
    }
    for (const button of document.querySelectorAll('[data-add-personal]')) button.disabled = locked;
  }

  window.addEventListener('mi-dia-render', render);
  window.addEventListener('mi-dia-day-change', () => renderUpcoming(read().personal?.procedures ?? []));
  window.addEventListener('mi-dia-lock', event => {
    locked = event.detail;
    if (locked && editor.open) editor.close();
    render();
  });
  window.addEventListener('mi-dia-account-change', () => { if (editor.open) editor.close(); });
  window.addEventListener('focus', render);
  render();
})();
