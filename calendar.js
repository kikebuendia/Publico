'use strict';
(() => {
  const el = id => document.getElementById(id);
  const clientKey = 'mi-dia-calendar-client-id';
  let clientId = '';
  try { clientId = localStorage.getItem(clientKey) || ''; } catch { /* La configuración puede mantenerse en memoria. */ }
  let token = '', expiryTimer, generation = 0, sdkPromise;
  const message = text => { el('calendar-status').textContent = text; };
  function clearEvents() {
    el('calendar-weeks').hidden = true;
    el('calendar-this').replaceChildren();
    el('calendar-next').replaceChildren();
  }
  function disconnected(text) {
    generation++;
    clearTimeout(expiryTimer);
    token = '';
    clearEvents();
    el('calendar-connect').disabled = false;
    el('calendar-connect').hidden = false;
    el('calendar-refresh').hidden = true;
    el('calendar-disconnect').hidden = true;
    message(text);
  }
  function loadSdk() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => fail(), 15000);
      const fail = () => {
        clearTimeout(timer); script.remove(); sdkPromise = null;
        reject(new Error('No se pudo cargar Google. Comprueba tu conexión y vuelve a intentarlo.'));
      };
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        if (window.google?.accounts?.oauth2) resolve(); else fail();
      };
      script.onerror = fail;
      document.head.append(script);
    });
    return sdkPromise;
  }
  function weekBounds(now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const next = new Date(start); next.setDate(next.getDate() + 7);
    const end = new Date(next); end.setDate(end.getDate() + 7);
    return {start, next, end};
  }
  function eventDate(value) {
    if (value?.dateTime) return new Date(value.dateTime);
    if (value?.date) {
      const [year, month, day] = value.date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(NaN);
  }
  const shortDate = date => date.toLocaleDateString('es', {day:'numeric', month:'short'});
  function renderWeek(id, events, from, to) {
    const list = el(id);
    list.replaceChildren();
    const matches = events.filter(event => eventDate(event.start) < to && eventDate(event.end) > from);
    if (!matches.length) {
      const li = document.createElement('li'); li.textContent = 'No tienes citas esta semana.'; list.append(li);
    }
    for (const event of matches) {
      const li = document.createElement('li');
      const title = document.createElement('strong'); title.textContent = event.summary || 'Sin título';
      const when = document.createElement('small');
      const start = eventDate(event.start), end = eventDate(event.end);
      if (event.start.date) {
        const last = new Date(end); last.setDate(last.getDate() - 1);
        when.textContent = `${shortDate(start)}${last > start ? ' – ' + shortDate(last) : ''} · Todo el día`;
      } else {
        const format = date => date.toLocaleString('es', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
        when.textContent = `${format(start)} – ${format(end)}`;
      }
      li.append(title, when); list.append(li);
    }
  }
  async function refresh() {
    if (!token) return;
    const current = ++generation;
    clearEvents();
    el('calendar-refresh').disabled = true;
    message('Cargando tus citas…');
    const {start, next, end} = weekBounds();
    try {
      const events = [];
      let pageToken = '';
      do {
        const query = new URLSearchParams({timeMin:start.toISOString(), timeMax:end.toISOString(), singleEvents:'true', orderBy:'startTime', maxResults:'250', timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
        if (pageToken) query.set('pageToken', pageToken);
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {headers:{Authorization:`Bearer ${token}`}});
        if (current !== generation) return;
        if (response.status === 401) { disconnected('La sesión ha caducado. Pulsa Conectar Google Calendar para volver a entrar.'); return; }
        if (!response.ok) throw new Error(response.status === 403
          ? 'Google no permite leer el calendario. Comprueba que Calendar API está habilitada y que has aceptado el permiso de lectura.'
          : 'No se pudieron cargar las citas. Comprueba tu conexión y pulsa Actualizar.');
        const data = await response.json();
        if (current !== generation) return;
        events.push(...(data.items || []).filter(event => event.status !== 'cancelled'));
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      renderWeek('calendar-this', events, start, next);
      renderWeek('calendar-next', events, next, end);
      el('calendar-this-range').textContent = `${shortDate(start)} – ${shortDate(new Date(next.getTime() - 1))}`;
      el('calendar-next-range').textContent = `${shortDate(next)} – ${shortDate(new Date(end.getTime() - 1))}`;
      el('calendar-weeks').hidden = false;
      message(`Calendario principal · Horario de ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Actualizado a las ${new Date().toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'})}.`);
    } catch (error) {
      if (current === generation) message(error instanceof TypeError ? 'No se pudo conectar con Google. Comprueba tu conexión y pulsa Actualizar.' : error.message);
    } finally {
      if (current === generation) el('calendar-refresh').disabled = false;
    }
  }
  function openSettings() {
    el('calendar-client').value = clientId;
    el('calendar-config-error').textContent = '';
    el('calendar-settings').showModal();
  }
  el('calendar-configure').onclick = openSettings;
  el('calendar-cancel').onclick = () => el('calendar-settings').close();
  el('calendar-config-form').onsubmit = event => {
    event.preventDefault();
    const value = el('calendar-client').value.trim();
    if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(value)) {
      el('calendar-config-error').textContent = 'Pega el ID de cliente web que termina en .apps.googleusercontent.com, no una contraseña.';
      return;
    }
    try { localStorage.setItem(clientKey, value); }
    catch { el('calendar-config-error').textContent = 'No se pudo guardar la configuración en este navegador.'; return; }
    clientId = value;
    disconnected('Configuración guardada. Pulsa Conectar Google Calendar y autoriza el acceso de lectura.');
    el('calendar-settings').close();
  };
  // Precargar al configurar o al entrar para que la autorización se abra desde un clic directo.
  async function prepareConnection() {
    try {
      await loadSdk();
      message('Google está preparado. Pulsa de nuevo Conectar Google Calendar para elegir tu cuenta.');
    } catch (error) { message(error.message); }
    finally { el('calendar-connect').disabled = false; }
  }
  el('calendar-connect').onclick = () => {
    if (!clientId) { openSettings(); return; }
    if (!window.google?.accounts?.oauth2) {
      el('calendar-connect').disabled = true;
      message('Preparando la conexión con Google…');
      prepareConnection();
      return;
    }
    const attempt = ++generation;
    el('calendar-connect').disabled = true;
    message('Elige tu cuenta de Google y permite leer tus citas.');
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id:clientId,
        scope:'https://www.googleapis.com/auth/calendar.events.readonly',
        callback: response => {
          if (attempt !== generation) return;
          if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response, 'https://www.googleapis.com/auth/calendar.events.readonly')) {
            disconnected('No se ha concedido acceso de lectura al calendario. Puedes volver a conectarlo.'); return;
          }
          token = response.access_token;
          el('calendar-connect').hidden = true;
          el('calendar-refresh').hidden = false;
          el('calendar-refresh').disabled = false;
          el('calendar-disconnect').hidden = false;
          clearTimeout(expiryTimer);
          expiryTimer = setTimeout(() => disconnected('La sesión ha caducado. Vuelve a conectar Google Calendar para ver tus citas.'), Math.max(1, Number(response.expires_in) || 3600) * 1000);
          refresh();
        },
        error_callback: () => { if (attempt === generation) disconnected('No se completó la conexión. Permite las ventanas emergentes y vuelve a pulsar Conectar Google Calendar.'); }
      });
      client.requestAccessToken({prompt:''});
    } catch { disconnected('No se pudo iniciar la conexión. Revisa la configuración de Google Calendar.'); }
  };
  el('calendar-refresh').onclick = refresh;
  el('calendar-disconnect').onclick = () => {
    const previous = token;
    disconnected('Calendario desconectado. Las citas se han retirado de la pantalla.');
    if (previous && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(previous, () => {});
  };
  window.addEventListener('mi-dia-account-change', () => disconnected('Entra con Google para autorizar el calendario.'));
  window.addEventListener('mi-dia-calendar-token', event => {
    token = event.detail;
    el('calendar-connect').hidden = true;
    el('calendar-refresh').hidden = false;
    el('calendar-refresh').disabled = false;
    el('calendar-disconnect').hidden = false;
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => disconnected('Renueva el permiso de Google para ver tus citas.'), 3500 * 1000);
    refresh();
  });
  if (clientId) message('Pulsa Conectar Google Calendar para ver tus citas.');
})();
