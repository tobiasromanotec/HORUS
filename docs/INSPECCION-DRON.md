# Ver inspección con dron en vivo

1. En YouTube Studio, crea la transmisión de la inspección, habilita la inserción y elige visibilidad pública o no listada.
2. Envía la imagen del dron a esa transmisión mediante tu aplicación o equipo de emisión. HORUS muestra la señal publicada por YouTube; no reemplaza el software que transmite desde el dron.
3. Copia el enlace del video desde **Compartir** en YouTube. No copies la dirección del canal, la URL de YouTube Studio ni la clave privada de transmisión.
4. En HORUS, entra con una cuenta administradora y abre **Administración**.
5. Pega el enlace de YouTube y selecciona **Guardar transmisión**. Es un único enlace para toda la plataforma.
6. Vuelve a **Vista general** y pulsa **Ver transmisión** para verla dentro de HORUS. El video comienza sin sonido; los controles de YouTube permiten activarlo y usar pantalla completa.

El acceso está en el inicio y no tiene botones de configuración. No hay un apartado de dron en las fichas de los equipos ni es necesario repetir enlaces por torre. En **Administración**, se puede reemplazar el enlace para otra inspección o usar **Quitar enlace** para desvincularlo sin borrar ni detener el video de YouTube. Si una nueva emisión tiene otra dirección de YouTube, basta cambiarla una sola vez aquí. Una cuenta observadora puede mirar, pero no abrir Administración ni editar. Al cerrar la transmisión, salir del inicio o cerrar sesión se desmonta el reproductor.

Si no hay un enlace disponible, el inicio muestra **Próxima inspección**, sin controles de edición. Las configuraciones anteriores por torre se conservan: se reutiliza automáticamente un único enlace previo, pero no se elige entre varios videos diferentes. La preferencia compartida guardada desde Administración tiene prioridad.

El distintivo **Enlace disponible** confirma que existe una configuración, no que el dron esté transmitiendo. YouTube muestra si el vivo está programado, activo, finalizado o no disponible. Al terminar, puede mostrarse la grabación si el propietario la conserva.

Si el reproductor no carga, prueba **Recargar video** o **Abrir en YouTube**. Comprueba que la emisión permita inserción, no sea privada y esté disponible para ese visitante (por ejemplo, sin restricciones de edad o región). El navegador necesita acceso a YouTube y a sus servidores de video. No se puede reproducir dentro de HORUS un video cuyo propietario prohíbe la inserción.

La asociación se guarda en SQLite, por lo que se conserva al recargar y al reiniciar usando la misma base. En la demo gratuita de Render, el disco es temporal: una nueva instancia o despliegue puede reiniciar los datos y habrá que configurar otra vez el enlace. Para conservar configuraciones de una operación real entre despliegues, se necesita almacenamiento persistente.

## Auditoría

Validación realizada el 22 de octubre de 2026:

- `npm run build`: compilación TypeScript y Vite correcta. Continúa el aviso existente de tamaño del módulo HLS, ajeno al reproductor de YouTube.
- `npm test`: 26 pruebas aprobadas, sin fallos ni omisiones.
- `npm run test:e2e`: 14 pruebas aprobadas, incluidas las funciones existentes de autenticación, mapas, cámaras HLS, parámetros y anomalías.
- La revisión de navegador comprueba acceso desde el inicio, ausencia de configuración en ese apartado, administración restringida, eliminación del apartado por torre y tamaños móviles de 390 y 320 píxeles.
- No se agregaron dependencias ni se modificaron los datos existentes o el logo.

Las pruebas de servidor cubren validación de enlaces, permisos, persistencia global, reutilización de enlaces previos, eliminación y preservación de cámaras y telemetría. Las de navegador cubren configuración, errores recuperables, recarga, reproducción integrada bajo demanda, cierre del iframe, permisos de la interfaz y tamaños móviles. Comprueban el iframe sobre la compilación de producción, incluida su política CSP y el encabezado Referer requerido por YouTube.

En las pruebas automatizadas se intercepta únicamente la respuesta del iframe de YouTube con una página identificada como **Reproductor simulado**. Esto comprueba la integración sin depender de transmisiones de terceros; no certifica una emisión real. Los enlaces de prueba no se incluyen en los datos de la aplicación. La validación final de imagen y sonido requiere el enlace de una inspección real y acceso de red a YouTube.

La solicitud de verificación a `https://horus-demo.onrender.com/api/health` fue bloqueada por el proxy de la nube antes de llegar al servicio (`CONNECT tunnel failed, response 403`). Por ello, los resultados anteriores corresponden a la compilación de producción ejecutada localmente; no prueban que el nuevo despliegue de Render haya terminado.
