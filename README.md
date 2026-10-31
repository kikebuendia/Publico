# Mi día

Panel personal adaptable a móvil, sin dependencias de instalación. Las listas funcionan sin cuenta; el calendario es opcional y requiere autorización de Google. Tareas, llamadas, acceso a la nota compartida de comidas y compra en Google Keep y búsquedas de viajes guardadas.

## Ejecutar

Desde este directorio:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Los datos se guardan en localStorage del navegador y origen utilizados. No hay sincronización entre dispositivos ni copia en servidor. El botón «Exportar copia» descarga los datos como JSON. Para restaurar una copia, pulsa «Importar copia», selecciona el JSON exportado y confirma. La importación valida el contenido y reemplaza los datos actuales de este navegador, incluido el enlace de Keep; exporta antes si quieres conservarlos. Si cancelas, el archivo no es válido o falla el guardado, se mantienen los datos actuales. El tamaño máximo es 5 MB.

La nota compartida de comidas y compra permanece en Keep: configura su único enlace desde el panel. No hay integración con Gmail/Keep ni alertas automáticas de precios. Las fuentes de Google son opcionales; hay fuentes de respaldo locales.

Para usarlo en el móvil fuera del entorno de desarrollo será necesario publicarlo en un alojamiento HTTPS. No incluye autenticación: evita usarlo en navegadores compartidos.

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
