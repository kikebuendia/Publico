import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {emptyState, nextRevision, hasData} from '../sync-core.mjs';

test('migración, edición, conflicto y aislamiento al salir con Firebase simulado', async () => {
  const nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, {hidden: true, disabled: false, textContent: ''});
    return nodes.get(id);
  };
  const listeners = new Map(), storage = new Map();
  let state = {...emptyState(), tasks: [{text: 'Original local', done: false}]};
  let account, authListener, snapshotListener, remote = null, writes = 0;
  const app = {
    read: () => structuredClone(state), validate: data => structuredClone(data),
    apply: data => { state = structuredClone(data); }, useAccount: uid => { account = uid; }, lock() {}
  };
  const auth = {currentUser: null};
  const authSdk = {
    getAuth: () => auth, setPersistence: async () => {}, browserLocalPersistence: {},
    GoogleAuthProvider: class { addScope() {} static credentialFromResult() { return null; } },
    onAuthStateChanged: (_, callback) => { authListener = callback; callback(null); },
    signOut: async () => { auth.currentUser = null; authListener(null); }
  };
  const snap = () => ({exists: () => remote !== null, data: () => structuredClone(remote), metadata: {hasPendingWrites: false, fromCache: false}});
  const dbSdk = {
    getFirestore: () => ({}), doc: (_, ...path) => path.join('/'), serverTimestamp: () => 'server-time',
    onSnapshot: (_, options, callback) => { snapshotListener = callback; return () => {}; },
    runTransaction: async (_, callback) => callback({
      get: async () => snap(), set: (_, data) => { remote = structuredClone(data); writes++; }
    })
  };
  let source = await readFile(new URL('../sync.js', import.meta.url), 'utf8');
  source = source.replace("import {emptyState, nextRevision, hasData} from './sync-core.mjs';", '');
  const begin = source.indexOf('  const [{initializeApp}');
  const end = source.indexOf('  const auth =', begin);
  source = source.slice(0, begin) + '  const {initializeApp, authSdk, dbSdk} = mocks;\n' + source.slice(end);
  const context = vm.createContext({
    emptyState, nextRevision, hasData,
    window: {miDia: app, miDiaCloudConfig: {apiKey:'public', projectId:'test', authDomain:'test', appId:'test'},
      addEventListener: (name, cb) => listeners.set(name, cb), dispatchEvent: () => {}},
    document: {getElementById: el}, localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, data) => storage.set(key, data)},
    mocks: {initializeApp() {}, authSdk, dbSdk}, confirm: () => true, Event: class {}, CustomEvent: class {},
    setTimeout, console
  });
  vm.runInContext(source, context);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await tick();
  auth.currentUser = {uid: 'alice', email: 'alice@example.test'};
  authListener(auth.currentUser);
  assert.equal(account, 'alice');
  snapshotListener(snap()); await tick();
  assert.equal(writes, 1);
  assert.equal(remote.state.tasks[0].text, 'Original local');
  state.tasks.push({text: 'Desde ordenador', done: false});
  listeners.get('mi-dia-change')(); await tick();
  assert.equal(remote.revision, 2);
  assert.equal(remote.state.tasks.length, 2);
  // Otro dispositivo guarda antes de la siguiente edición local.
  remote.revision = 3;
  remote.state.tasks.push({text: 'Desde móvil', done: false});
  state.tasks.push({text: 'Edición en conflicto', done: false});
  listeners.get('mi-dia-change')(); await tick();
  assert.equal(writes, 2, 'el conflicto no sobrescribe el documento remoto');
  assert.equal(el('sync-resolve').hidden, false);
  assert.match(storage.get('mi-dia-sync-alice'), /Edición en conflicto/);
  await el('sign-out').onclick();
  assert.equal(account, undefined);
  assert.equal(state.tasks.length, 1, 'salir restaura las listas locales originales');
  assert.equal(state.tasks[0].text, 'Original local');
  assert.equal(el('sign-in').hidden, false);
});
