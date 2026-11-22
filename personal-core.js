'use strict';
(function(root) {
  const ideaGroups = {
    plans: {pareja: 'Con mi mujer', amigos: 'Con mis amigos', familia: 'Con mi familia'},
    details: {detalles: 'Detalles a mi mujer', 'detalles-padres': 'Detalles a mis padres', 'detalles-hermano': 'Detalles a mi hermano'}
  };
  const categories = {...ideaGroups.plans, ...ideaGroups.details};
  const defaults = () => ({procedures: [], savings: [], plans: []});
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !isNaN(date) && date.toISOString().slice(0, 10) === value;
  };
  const amount = value => Number.isSafeInteger(value) && value >= 0 && value <= 99999999999;
  const readers = {
    procedures(item) {
      const {date, months, anchor} = item;
      if ((date !== '' && !validDate(date)) || !Number.isInteger(months) || months < 0 || months > 120
        || !Number.isInteger(anchor) || anchor < 1 || anchor > 31 || (months && !date)) throw Error('Fecha o repetición no válida.');
      return {date, months, anchor};
    },
    savings(item) {
      const {target, saved} = item;
      if ((target !== null && (!amount(target) || target === 0)) || !amount(saved)) throw Error('Importe no válido.');
      return {target, saved};
    },
    plans(item) {
      if (!Object.hasOwn(categories, item.category)) throw Error('Categoría de idea no válida.');
      return {category: item.category};
    }
  };
  function validate(data = defaults()) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Listas personales no válidas.');
    const result = defaults();
    for (const [kind, read] of Object.entries(readers)) {
      if (!Array.isArray(data[kind])) throw Error('Listas personales no válidas.');
      const ids = new Set();
      result[kind] = data[kind].map(item => {
        if (!item || typeof item.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(item.id) || ids.has(item.id)
          || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120) throw Error('Entrada personal no válida.');
        ids.add(item.id);
        return {id: item.id, name: item.name.trim(), ...read(item)};
      });
    }
    return result;
  }
  function nextDate({date, months, anchor}, today) {
    const [year, month] = date.split('-').map(Number);
    const [currentYear, currentMonth] = today.split('-').map(Number);
    const elapsed = (currentYear - year) * 12 + currentMonth - month;
    const offset = Math.max(1, Math.floor(elapsed / months)) * months;
    function at(delta) {
      const next = new Date(date + 'T00:00:00Z');
      next.setUTCDate(1);
      next.setUTCMonth(month - 1 + delta + 1, 0);
      next.setUTCDate(Math.min(anchor, next.getUTCDate()));
      return next.toISOString().slice(0, 10);
    }
    const candidate = at(offset);
    return candidate > today ? candidate : at(offset + months);
  }
  const api = {ideaGroups, defaults, validate, nextDate};
  if (typeof module !== 'undefined') module.exports = api;
  else root.miDiaPersonalCore = api;
})(globalThis);
