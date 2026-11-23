import test from 'node:test';
import assert from 'node:assert/strict';
import personal from '../personal-core.js';
import features from '../features-core.js';
import {emptyState, hasData} from '../sync-core.mjs';

test('repite por meses, recupera el día original y salta fechas pasadas', () => {
  const entry = {date: '2026-01-31', months: 1, anchor: 31};
  assert.equal(personal.nextDate(entry, '2026-01-31'), '2026-02-28');
  assert.equal(personal.nextDate({...entry, date: '2026-02-28'}, '2026-02-28'), '2026-03-31');
  assert.equal(personal.nextDate({...entry, months: 2}, '2026-07-31'), '2026-09-30');
  assert.equal(personal.nextDate({...entry, date: '2023-12-31'}, '2024-01-31'), '2024-02-29');
});

test('preserva listas personales al validar y detecta contenido para migrar', () => {
  const base = features.defaults();
  assert.equal(features.validate(base).personal, undefined);
  for (const [kind, entry] of Object.entries({
    procedures: {date: '2026-12-15', months: 0, anchor: 15},
    savings: {target: null, saved: 0},
    plans: {category: 'detalles'}
  })) {
    const value = personal.defaults();
    assert.equal(hasData({...emptyState(), features: {...base, personal: value}}), false);
    value[kind].push({id: 'test', name: 'Entrada', ...entry});
    const normalized = features.validate({...base, personal: value});
    assert.deepEqual(normalized.personal, value);
    assert.equal(hasData({...emptyState(), features: normalized}), true);
  }
  assert.throws(() => personal.validate({...personal.defaults(), plans: [{id: 'test', name: 'Entrada', category: 'constructor'}]}));
});

test('resumen de trámites desde hoy hasta dentro de 30 días, ordenado por fecha', () => {
  const entries = ['2027-01-15', '', '2026-12-15', '2026-12-14', '2027-01-14', '2027-01-01']
    .map(date => ({date}));
  const upcoming = personal.upcomingProcedures(entries, '2026-12-15');
  assert.deepEqual(upcoming.map(item => item.date), ['2026-12-15', '2027-01-01', '2027-01-14']);
  assert.equal(entries[0].date, '2027-01-15');
});

test('la recurrencia mensual conserva la precisión cuando falta el día', () => {
  const entry = {date: '2026-11', months: 12, anchor: 1};
  assert.equal(personal.nextDate(entry, '2026-11-23'), '2027-11');
  assert.equal(personal.nextDate(entry, '2027-11-23'), '2028-11');
});

test('el aviso configurable adelanta o acorta el plazo y admite fechas por mes', () => {
  const procedures = [
    {date: '2027-03', noticeDays: 60},
    {date: '2027-02-05', noticeDays: 0},
    {date: '2027-02-08', noticeDays: 10},
    {date: '2027-01-10', noticeDays: 30}
  ];
  assert.equal(personal.noticeDate(procedures[0]), '2026-12-31');
  assert.deepEqual(personal.upcomingProcedures(procedures, '2027-02-01'), [procedures[2], procedures[0]]);
  assert.deepEqual(personal.upcomingProcedures(procedures, '2027-02-05'), [procedures[1], procedures[2], procedures[0]]);
  const value = {...personal.defaults(), procedures: [{id: 'example', name: 'Trámite', months: 12, anchor: 1, ...procedures[0]}]};
  assert.deepEqual(personal.validate(value), value);
  assert.throws(() => personal.validate({...value, procedures: [{...value.procedures[0], noticeDays: -1}]}));
});
