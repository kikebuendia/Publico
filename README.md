# Mi día

Panel personal adaptable a móvil, sin dependencias de instalación. Las listas funcionan sin cuenta en modo local; la sincronización opcional usa Google y Firebase. el calendario es opcional y requiere autorización de Google. Tareas, llamadas, acceso a la nota compartida de comidas y compra en Google Keep y búsquedas de viajes guardadas.

## Ejecutar

Desde este directorio:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Sin iniciar sesión, los datos se guardan en localStorage del navegador y origen utilizados. Con Firebase configurado y una sesión de Google, se guardan por cuenta en Firestore y se actualizan en los dispositivos conectados. Consulta el estado de sincronización en la tarjeta superior. El botón «Exportar copia» descarga los datos como JSON. Para restaurar una copia, pulsa «Importar copia», selecciona el JSON exportado y confirma. La importación valida el contenido y reemplaza los datos actuales de este navegador, incluido el enlace de Keep; exporta antes si quieres conservarlos. Si cancelas, el archivo no es válido o falla el guardado, se mantienen los datos actuales. El tamaño máximo es 5 MB.

La nota compartida de comidas y compra permanece en Keep: configura su único enlace desde el panel. No hay integración con Gmail/Keep ni alertas automáticas de precios. Las fuentes de Google son opcionales; hay fuentes de respaldo locales.

Para usarlo en el móvil fuera del entorno de desarrollo será necesario publicarlo en un alojamiento HTTPS. La sesión de Google es persistente: cierra sesión si utilizas un navegador compartido. El modo local conserva sus datos en ese navegador.

## Publicar en GitHub Pages

En GitHub, abre **Settings → Pages** del repositorio. Selecciona **Deploy from a branch**, rama **main**, carpeta **/ (root)** y pulsa **Save**. El panel es estático y no requiere compilación. GitHub mostrará la URL cuando termine el despliegue.

La web publicada no contiene los pendientes ni las notas personales: estos se introducen en el navegador. Cada navegador mantiene sus propios datos. El enlace de Keep sigue requiriendo acceso a la nota en Google.

## Dictar pendientes

En Chrome para Android, pulsa «Dictar pendiente», permite el micrófono y habla en español. Revisa el texto y pulsa + para añadirlo; nunca se guarda automáticamente. Si ya habías escrito un borrador, el dictado se añade al final (máximo 200 caracteres). Puedes terminar el dictado con el mismo botón. Requiere HTTPS (o localhost para desarrollo) y un navegador compatible con SpeechRecognition/webkitSpeechRecognition. El servicio del navegador puede necesitar Internet y procesar audio fuera del dispositivo. Si no está disponible, puedes escribir o usar el micrófono del teclado.

## Calendario de Google (opcional, solo lectura)

La sección de agenda muestra el calendario principal de la cuenta autorizada, esta semana y la próxima (lunes a domingo, en la zona horaria del navegador). Expande citas recurrentes, pagina los resultados e incluye eventos de todo el día. Las semanas se calculan al actualizar; pulsa Actualizar citas al cambiar de semana.

Configuración inicial en https://console.cloud.google.com/:

1. Crea un proyecto y habilita **Google Calendar API** (https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
2. Configura **Google Auth Platform**: información de la app y correo de soporte; audiencia externa. Si está en Testing, añade tu Gmail a los usuarios de prueba.
3. En Acceso a los datos, añade `https://www.googleapis.com/auth/calendar.events.readonly`.
4. Crea un cliente OAuth **Aplicación web**. Añade el origen JavaScript autorizado `https://kikebuendia.github.io` (sin ruta ni barra final). Para pruebas locales añade `http://localhost:8000` y, si se usa, `http://127.0.0.1:8000`. Este flujo de token usa ventanas emergentes y no requiere URI de redirección ni secreto de cliente en la app.
5. En el dashboard, pulsa Configurar calendario, pega el **ID de cliente** terminado en `.apps.googleusercontent.com` y guarda. Pulsa Conectar Google Calendar; si prepara el servicio, vuelve a pulsarlo cuando lo indique. Autoriza solo lectura en Google. El modo de prueba puede mostrar avisos de app sin verificar y requerir volver a autorizar; para uso público Google puede exigir verificación del permiso.

El ID público se guarda en este navegador, separado de las listas. Los tokens OAuth y eventos solo viven en memoria, no en localStorage, en el repositorio ni en las exportaciones JSON. Al recargar se necesita volver a conectar. Desconectar limpia las citas y solicita revocar el token. No se leen correos ni notas de Keep. No se modifican eventos.

La conexión requiere HTTPS (o localhost en desarrollo) y acceso del navegador a `accounts.google.com` y `www.googleapis.com`. El SDK se carga al pulsar Conectar. No se requiere clave API ni secreto de cliente. Una conexión real solo puede verificarse con un ID OAuth válido y la autorización del propietario del calendario.


## Activar inicio de sesión y sincronización (una sola vez)

Esta versión incluye el código, pero no crea ni publica servicios de Firebase. Hasta completar esta configuración sigue funcionando en modo local.

1. En [Firebase Console](https://console.firebase.google.com/), añade Firebase al **mismo proyecto de Google Cloud** utilizado para Calendar. Registra una aplicación **Web**.
2. En **Authentication → Sign-in method**, activa **Google**, selecciona el correo de soporte y guarda. En **Authentication → Settings → Authorized domains**, añade `kikebuendia.github.io`. Para pruebas locales añade `localhost` si falta.
3. Crea **Cloud Firestore** en modo de producción y elige la ubicación de almacenamiento. En la pestaña **Rules**, sustituye las reglas por el contenido completo de `firestore.rules` y pulsa **Publicar**. Estas reglas permiten leer y escribir únicamente el documento del usuario autenticado; no habilites reglas públicas de prueba.
4. En **Configuración del proyecto → Tus aplicaciones → Web**, copia el objeto de configuración público en `cloud-config.js`, reemplazando `null`. Incluye `apiKey`, `authDomain`, `projectId` y `appId`. Estos identificadores son públicos; nunca incluyas claves de cuenta de servicio, secretos OAuth ni tokens. Si limitas la API key, permite las APIs necesarias para Firebase Authentication y Firestore, además del origen de la web.
5. Mantén Calendar API habilitada y tu cuenta añadida como usuario de prueba de Google Auth Platform. Firebase solicita también el permiso `calendar.events.readonly` al entrar. Ya no hace falta introducir el ID de cliente de Calendar en cada dispositivo. Google puede pedir nuevamente consentimiento o bloquear cuentas no autorizadas mientras la aplicación esté en pruebas.
6. Publica los archivos del repositorio en GitHub Pages. Entra primero desde el navegador donde tienes tus listas. Si la cuenta aún no tiene datos, se ofrece subir las listas locales; la copia local original se conserva. Entra con **la misma cuenta** desde el móvil.

La aplicación usa inicio de sesión mediante ventana emergente; permite las ventanas de Google. La sesión de Firebase se conserva al recargar, pero Google Calendar tiene un permiso independiente y temporal: pulsa **Conectar Google Calendar** para renovarlo. No se guardan tokens de Calendar en las listas ni en Firestore, y no hay servidor que renueve permisos de Calendar en segundo plano.

Las listas sincronizadas están en `users/{uid}/data/dashboard`. Se guardan mediante transacciones con revisión y se escuchan cambios en tiempo real. Una edición simultánea desde una revisión antigua se detiene y ofrece descargar los cambios locales antes de cargar la versión de la nube; no combina listas automáticamente. Los cambios pendientes se conservan localmente por cuenta y se reintentan al recuperar conexión. Espera a ver **Sincronizado** antes de cambiar de dispositivo. Salir restaura el modo local y conserva las copias de cada cuenta para próximos accesos.

Si ya hay datos en la nube, se cargan esos datos; las listas previas del modo local no se mezclan ni se borran. Puedes recuperarlas cerrando sesión y exportándolas. Importar una copia mientras estás conectado reemplaza tus listas y, cuando el estado indique Sincronizado, también las de la nube. La configuración OAuth manual antigua y los tokens no se exportan ni sincronizan.

### Comprobaciones antes de darlo por activado

- Ejecutar `node --test tests/*.test.mjs` y las comprobaciones de sintaxis de los JavaScript.
- Con el proyecto real: entrar desde dos navegadores con la misma cuenta; crear, completar y borrar un pendiente y comprobar que aparece en el otro. Recargar y verificar la sesión.
- Probar desconexión y reconexión, edición simultánea y cambio de cuenta. Comprobar que otra cuenta no puede acceder al documento de la primera; validar las reglas con el emulador o Rules Playground antes de publicar datos reales.
- Autorizar Calendar y comprobar las dos semanas; cerrar sesión y verificar que desaparecen las citas.

Las pruebas locales de lógica no verifican por sí solas OAuth, las reglas desplegadas ni la comunicación con Firebase. Firebase aplica cuotas; revisa el uso del proyecto y sus condiciones antes de habilitar facturación.


## Preparar un pendiente con ChatGPT

Cada pendiente tiene un botón **Preparar con ChatGPT**. Permite guardar un **próximo paso** (hasta 500 caracteres), que se incluye en la sincronización y en las copias JSON. Las copias antiguas siguen siendo compatibles.

Puedes añadir contexto temporal, revisar o editar la petición, pulsar **Copiar petición** y abrir ChatGPT para pegarla. La web no envía automáticamente datos a ChatGPT ni necesita una clave de OpenAI. El contexto temporal no se guarda en las listas. Al cambiar el próximo paso o el contexto se regenera la petición.

Validación de interfaz: con el servidor local en el puerto 8000, Playwright y Chromium disponibles, ejecutar `node tests/task-help.browser.cjs` (opcionalmente `CHROMIUM_PATH`). Esta prueba usa un navegador nuevo y bloquea la sincronización remota: comprueba la interfaz móvil, el portapapeles, la persistencia local y la conservación del nuevo campo al validar datos, sin acceder a cuentas reales.
