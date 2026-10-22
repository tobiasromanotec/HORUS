# Ver inspección con dron en vivo

1. En YouTube Studio, crea la transmisión de la inspección, habilita la inserción y elige visibilidad pública o no listada.
2. Envía la imagen del dron a esa transmisión mediante tu aplicación o equipo de emisión. HORUS muestra la señal publicada por YouTube; no reemplaza el software que transmite desde el dron.
3. Copia el enlace del video desde **Compartir** en YouTube. No copies la dirección del canal, la URL de YouTube Studio ni la clave privada de transmisión.
4. En HORUS, entra con una cuenta administradora y abre **Equipos → tu torre → Inspección con dron**. El apartado también aparece en la vista general del equipo.
5. Pulsa **Configurar transmisión**, pega el enlace y selecciona **Guardar transmisión**.
6. Pulsa **Ver transmisión** para verla dentro de HORUS. El video comienza sin sonido; los controles de YouTube permiten activarlo y usar pantalla completa.

Cada torre tiene su propio enlace. **Editar transmisión** permite reemplazarlo para otra inspección; **Quitar enlace** lo desvincula sin borrar ni detener el video de YouTube. Una cuenta observadora puede mirar, pero no editar. Al cerrar la transmisión, salir de la sección o cerrar sesión se desmonta el reproductor.

El distintivo **Enlace disponible** confirma que existe una configuración, no que el dron esté transmitiendo. YouTube muestra si el vivo está programado, activo, finalizado o no disponible. Al terminar, puede mostrarse la grabación si el propietario la conserva.

Si el reproductor no carga, prueba **Recargar video** o **Abrir en YouTube**. Comprueba que la emisión permita inserción, no sea privada y esté disponible para ese visitante (por ejemplo, sin restricciones de edad o región). El navegador necesita acceso a YouTube y a sus servidores de video. No se puede reproducir dentro de HORUS un video cuyo propietario prohíbe la inserción.

La asociación se guarda en SQLite, por lo que se conserva al recargar y al reiniciar usando la misma base. En la demo gratuita de Render, el disco es temporal: una nueva instancia o despliegue puede reiniciar los datos y habrá que configurar otra vez el enlace. Para conservar configuraciones de una operación real entre despliegues, se necesita almacenamiento persistente.

## Auditoría

Validación realizada el 22 de octubre de 2026:

- `npm run build`: compilación TypeScript y Vite correcta. Continúa el aviso existente de tamaño del módulo HLS, ajeno al reproductor de YouTube.
- `npm test`: 23 pruebas aprobadas, sin fallos ni omisiones.
- `npm run test:e2e`: 14 pruebas aprobadas, incluidas las funciones existentes de autenticación, mapas, cámaras HLS, parámetros y anomalías.
- Tras ajustar el encabezado y el ancho del reproductor en celulares, se repitieron la compilación y las cuatro pruebas de inspección con dron: aprobadas. Revisión visual de escritorio y de anchos de 390 y 320 píxeles.
- No se agregaron dependencias ni se modificaron los datos existentes o el logo.

Las pruebas de servidor cubren validación de enlaces, permisos, persistencia, separación entre torres, eliminación y preservación de cámaras y telemetría. Las de navegador cubren configuración, errores recuperables, recarga, reproducción integrada bajo demanda, cierre del iframe, permisos de la interfaz y tamaños móviles. Comprueban el iframe sobre la compilación de producción, incluida su política CSP y el encabezado Referer requerido por YouTube.

En las pruebas automatizadas se intercepta únicamente la respuesta del iframe de YouTube con una página identificada como **Reproductor simulado**. Esto comprueba la integración sin depender de transmisiones de terceros; no certifica una emisión real. Los enlaces de prueba no se incluyen en los datos de la aplicación. La validación final de imagen y sonido requiere el enlace de una inspección real y acceso de red a YouTube.

La solicitud de verificación a `https://horus-demo.onrender.com/api/health` fue bloqueada por el proxy de la nube antes de llegar al servicio (`CONNECT tunnel failed, response 403`). Por ello, los resultados anteriores corresponden a la compilación de producción ejecutada localmente; no prueban que el nuevo despliegue de Render haya terminado.
