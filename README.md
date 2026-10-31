# Mi día

Panel personal adaptable a móvil, sin dependencias ni cuentas. Tareas, llamadas, acceso a la nota compartida de comidas y compra en Google Keep y búsquedas de viajes guardadas.

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
