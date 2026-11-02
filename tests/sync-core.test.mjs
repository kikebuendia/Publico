import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, nextRevision, hasData} from '../sync-core.mjs';
test('la primera escritura crea revisión 1; las siguientes avanzan desde su base', () => {
  assert.equal(nextRevision(null, 0), 1);
  assert.equal(nextRevision({revision: 9}, 9), 10);
});
test('dos dispositivos no pueden sobrescribir cambios desde una misma revisión', () => {
  const a = nextRevision({revision: 2}, 2);
  assert.throws(() => nextRevision({revision: a}, 2), /conflict/);
});
test('un borrado remoto o una revisión inválida no se pisa silenciosamente', () => {
  assert.throws(() => nextRevision(null, 5), /conflict/);
  assert.throws(() => nextRevision({revision: '2'}, 2), /conflict/);
  assert.throws(() => nextRevision({revision: -1}, -1), /conflict/);
});
test('detecta datos locales para migración sin compartir objetos vacíos', () => {
  const a = emptyState(), b = emptyState();
  assert.equal(hasData(a), false);
  a.tasks.push({text: 'Llamar', done: false});
  assert.equal(hasData(a), true);
  assert.equal(hasData(b), false);
  assert.equal(hasData({...b, meals: 'https://keep.google.com/'}), true);
});
