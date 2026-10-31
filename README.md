# Mi día

Panel personal adaptable a móvil, sin dependencias ni cuentas. Tareas, llamadas, accesos a las notas compartidas de Google Keep y búsquedas de viajes guardadas.

## Ejecutar

Desde este directorio:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Los datos se guardan en localStorage del navegador y origen utilizados. No hay sincronización entre dispositivos ni copia en servidor. El botón «Exportar copia» descarga los datos como JSON. Las notas compartidas permanecen en Keep: configura sus enlaces desde el panel. No hay integración con Gmail/Keep ni alertas automáticas de precios. Las fuentes de Google son opcionales; hay fuentes de respaldo locales.

Para usarlo en el móvil fuera del entorno de desarrollo será necesario publicarlo en un alojamiento HTTPS. No incluye autenticación: evita usarlo en navegadores compartidos.

## Publicar en GitHub Pages

En GitHub, abre **Settings → Pages** del repositorio. Selecciona **Deploy from a branch**, rama **main**, carpeta **/ (root)** y pulsa **Save**. El panel es estático y no requiere compilación. GitHub mostrará la URL cuando termine el despliegue.

La web publicada no contiene los pendientes ni las notas personales: estos se introducen en el navegador. Cada navegador mantiene sus propios datos. Los enlaces de Keep siguen requiriendo acceso a las notas en Google.
