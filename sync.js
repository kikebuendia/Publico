import {emptyState, nextRevision, hasData} from './sync-core.mjs';
const el = id => document.getElementById(id);
const message = text => el('sync-status').textContent = text;
const app = window.miDia;
const config = window.miDiaCloudConfig;
if (!config?.apiKey || !config?.projectId || !config?.authDomain || !config?.appId) {
  message('Modo local. Falta activar la sincronización en la configuración de la web. Tus listas siguen guardadas en este navegador.');
} else {
  start().catch(() => message('No se pudo iniciar Google. Tus listas locales siguen disponibles. Recarga para reintentar.'));
}
async function start() {
  const version = '11.10.0';
  const [{initializeApp}, authSdk, dbSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]);
  const auth = authSdk.getAuth(initializeApp(config));
  const db = dbSdk.getFirestore();
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
  const provider = new authSdk.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events.readonly');
  let user = null, revision = 0, pending = null, busy = false, ready = false, unsubscribe, epoch = 0;
  let latest = null;
  let guest = app.read();
  const cacheKey = uid => `mi-dia-sync-${uid}`;
  function persist() {
    localStorage.setItem(cacheKey(user.uid), JSON.stringify({revision, pending}));
  }
  function calendar(result) {
    const credential = authSdk.GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) window.dispatchEvent(new CustomEvent('mi-dia-calendar-token', {detail: credential.accessToken}));
  }
  el('sign-in').disabled = false;
  el('sign-in').onclick = async () => {
    try { calendar(await authSdk.signInWithPopup(auth, provider)); }
    catch { message('No se pudo entrar. Permite la ventana de Google y comprueba que tu cuenta es usuario de prueba.'); }
  };
  el('calendar-connect').onclick = async () => {
    try {
      const result = auth.currentUser
        ? await authSdk.reauthenticateWithPopup(auth.currentUser, provider)
        : await authSdk.signInWithPopup(auth, provider);
      calendar(result);
    } catch { document.getElementById('calendar-status').textContent = 'No se pudo autorizar el calendario. Vuelve a pulsar Conectar y permite leer tus citas.'; }
  };
  el('calendar-configure').hidden = true;
  el('sign-out').onclick = async () => {
    if ((pending || busy) && !confirm('Hay cambios sin sincronizar. Se conservarán en este dispositivo para esta cuenta. ¿Salir?')) return;
    try { await authSdk.signOut(auth); }
    catch { message('No se pudo cerrar la sesión. Vuelve a intentarlo.'); }
  };
  function conflict() {
    message('Hay cambios de otro dispositivo. Tus cambios están conservados aquí. Descarga una copia antes de cargar la versión de la nube.');
    el('sync-resolve').hidden = false;
  }
  async function flush() {
    if (!ready || !user || !pending || busy) return;
    const current = epoch, uid = user.uid, data = pending, base = revision;
    busy = true;
    el('sync-retry').hidden = true;
    message('Guardando tus cambios…');
    try {
      await dbSdk.runTransaction(db, async transaction => {
        const ref = dbSdk.doc(db, 'users', uid, 'data', 'dashboard');
        const snapshot = await transaction.get(ref);
        const next = nextRevision(snapshot.exists() ? snapshot.data() : null, base);
        transaction.set(ref, {state: data, revision: next, updatedAt: dbSdk.serverTimestamp()});
      });
      if (current !== epoch) return;
      revision = base + 1;
      if (pending === data) pending = null;
      persist();
      message(pending ? 'Quedan cambios por guardar…' : `Sincronizado · ${user.email}`);
    } catch (error) {
      if (current !== epoch) return;
      if (error.message === 'conflict') conflict();
      else { message('No se pudo sincronizar. Tus cambios están guardados en este dispositivo. Reintenta cuando tengas conexión.'); el('sync-retry').hidden = false; }
    } finally {
      if (current === epoch) {
        busy = false;
        if (!pending && latest && latest.revision > revision) {
          try { app.apply(latest.state); revision = latest.revision; persist(); }
          catch { message('No se pudo conservar la última versión localmente. Recarga para reintentar.'); }
        }
        if (pending && pending !== data && el('sync-resolve').hidden && el('sync-retry').hidden) flush();
      }
    }
  }
  window.addEventListener('mi-dia-change', () => {
    if (!user) { guest = app.read(); return; }
    if (!ready) return;
    pending = app.read();
    try { persist(); } catch { message('No hay espacio local para conservar cambios. Exporta una copia antes de salir.'); return; }
    if (el('sync-resolve').hidden) flush();
  });
  el('sync-retry').onclick = flush;
  window.addEventListener('online', flush);
  el('sync-resolve').onclick = () => {
    if (!latest) return;
    const blob = new Blob([JSON.stringify(app.read(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'mi-dia-cambios-sin-sincronizar.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (!confirm('Comprueba que se ha descargado la copia. ¿Cargar ahora las listas de la nube?')) return;
    try {
      app.apply(latest.state); revision = latest.revision; pending = null; persist();
      el('sync-resolve').hidden = true; el('sync-retry').hidden = true;
      message(`Sincronizado · ${user.email}`);
    } catch { message('No se pudo guardar la versión de la nube en este navegador. Tus cambios se conservan.'); }
  };
  authSdk.onAuthStateChanged(auth, next => {
    ++epoch; unsubscribe?.(); user = next; ready = false; busy = false; pending = null; latest = null; revision = 0;
    el('sync-resolve').hidden = true; el('sync-retry').hidden = true;
    el('sign-in').hidden = !!user; el('sign-out').hidden = !user;
    app.useAccount(user?.uid);
    if (!user) window.dispatchEvent(new Event('mi-dia-account-change'));
    if (!user) {
      app.apply(guest); app.lock(false);
      message('Modo local. Entra con Google para sincronizar tus listas.'); return;
    }
    app.lock(true); app.apply(emptyState());
    message(`Cargando las listas de ${user.email}…`);
    const current = epoch;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(user.uid)) || 'null');
      if (cached) {
        revision = cached.revision;
        if (cached.pending) { pending = app.validate(cached.pending); app.apply(pending); }
      }
    } catch { message('No se pudo recuperar la copia local. Exporta tus datos antes de continuar.'); return; }
    unsubscribe = dbSdk.onSnapshot(dbSdk.doc(db, 'users', user.uid, 'data', 'dashboard'), {includeMetadataChanges: true}, snapshot => {
      if (current !== epoch || snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) return;
      try {
        const remote = snapshot.exists() ? snapshot.data() : {state: emptyState(), revision: 0};
        remote.state = app.validate(remote.state);
        if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw new Error('Invalid revision');
        latest = remote;
        if (busy) return;
        ready = true; app.lock(false);
        if (pending) {
          if (remote.revision !== revision) { conflict(); return; }
          app.apply(pending); flush(); return;
        }
        revision = remote.revision;
        if (!snapshot.exists() && hasData(guest) && confirm('Tu cuenta aún no tiene listas. ¿Subir los pendientes y datos de este navegador? La copia local se conservará.')) {
          app.apply(guest); pending = app.read(); persist(); flush();
        } else {
          app.apply(remote.state); persist(); message(`Sincronizado · ${user.email}`);
        }
      } catch { app.lock(true); message('No se pudieron cargar o conservar las listas. Tus copias locales no se han borrado.'); }
    }, () => { app.lock(true); message('No se puede acceder al almacenamiento. Comprueba la conexión y la configuración de Firebase y recarga. Las copias locales se conservan.'); });
  });
}
