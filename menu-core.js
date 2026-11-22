'use strict';
(function(root) {
  const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const plain = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const dayPattern = new RegExp(`^(${days.map(plain).join('|')})(?=$|\\s|[:.–—-])`);
  const proteins = /\b(pollo|pavo|ternera|cerdo|cordero|conejo|merluza|salmon|bacalao|atun|sardinas?|dorada|lubina|rape|rodaballo|trucha|gambas?|langostinos?|pulpo|calamares?|tofu|tempeh|seitan)\b/g;
  function parse(text, week) {
    const menu = {};
    let date;
    for (const line of text.split(/\r?\n/)) {
      const content = line.trim().replace(/^(?:[-*•☐☑]\s+|\[[ xX]\]\s*)+/, '');
      if (!content) continue;
      const normalized = plain(content);
      const day = normalized.match(dayPattern);
      if (day) date = week[days.findIndex(label => plain(label) === day[1])];
      if (!date) continue;
      if (/^(?:lista de la compra|lista de compra|compra|desayunos?|almuerzos?)\s*:?$/i.test(normalized)) {
        date = undefined;
        continue;
      }
      const dish = day ? content.slice(day[1].length).replace(/^(?:\s+\d{1,2}(?:[/.]\d{1,2})?(?=\s*[:.–—-]|$))?\s*[:.–—-]?\s*/, '') : content;
      if (!dish) continue;
      if (/^proteina\s*:/i.test(plain(dish))) {
        if (menu[date]) menu[date].protein = dish.replace(/^[^:]+:\s*/, '').slice(0, 100);
        continue;
      }
      const dinner = dish.replace(/^cena\s*:\s*/i, '');
      if (dinner && !menu[date]) menu[date] = {dish: dinner, protein: ''};
    }
    return menu;
  }
  function proteinFor(entry) {
    if (!entry) return '';
    if (entry.protein) return entry.protein;
    const words = entry.dish.match(/\p{L}+/gu) ?? [];
    const matches = new Map();
    for (const word of words) {
      const value = plain(word);
      if ([...value.matchAll(proteins)].length) matches.set(value, word.toLowerCase());
    }
    return [...matches.values()].join(' y ');
  }
  const api = {parse, proteinFor};
  if (typeof module !== 'undefined') module.exports = api; else root.miDiaMenu = api;
})(globalThis);
