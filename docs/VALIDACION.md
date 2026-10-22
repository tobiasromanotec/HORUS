# Revisión de HORUS

Se retomó el proyecto existente después de la interrupción, conservando el código, el lockfile y la base SQLite de desarrollo. El objetivo revisado fue una web para torres petroleras RIG/PULLING/WORKOVER con acceso, mapa, catálogo, cámaras, parámetros y anomalías. El repositorio está en la rama `work`, sin commits previos; los archivos de la implementación siguen en el checkout local.

## Resultados ejecutados

| Comprobación | Resultado |
| --- | --- |
| Instalación reproducible: `npm_config_cache=/workspace/.npm-cache bash scripts/setup.sh` | Correcta: `npm ci` y compilación completados, sin reemplazar los datos locales. |
| TypeScript y Vite: `npm run build` | Correctos. |
| Integración del servidor: `npm test` | **18 aprobadas**, 0 fallidas, 0 omitidas. |
| Navegador Chromium: `npm run test:e2e` | **10 aprobadas**, 0 fallidas, 0 omitidas. Se ejecutó contra la compilación de producción en una base temporal. |
| Dependencias: `npm audit --audit-level=high` | **0 vulnerabilidades reportadas** por el registro consultado. |

Las pruebas cubren autenticación, cookies de sesión, expiración y cierre, limitación de intentos, origen de solicitudes, roles, validación de coordenadas, persistencia entre reinicios, cámaras HTTPS, recuperación de contraseña, carga atómica de telemetría y registro de anomalías.

En navegador se comprobaron acceso fallido y correcto, navegación, filtros, selección desde el mapa, fichas por torre, imágenes, pestañas, cambio persistente de estado de anomalías, alta de equipos, configuración de cámara, diálogos y navegación móvil sin desbordamiento horizontal. También se verificó que los parámetros y hallazgos ingresados por API aparezcan en la torre correcta.

La reproducción HLS se probó con segmentos H.264 sintéticos locales servidos mediante una ruta de prueba interceptada: el video carga, reproduce y avanza su tiempo. Al cambiar de pestaña se libera el reproductor. La prueba no usa ni certifica una cámara externa.

Se bloquearon deliberadamente los mosaicos externos del mapa durante una prueba y se verificaron la cartografía local, los marcadores, las etiquetas y el estado vacío de los filtros.

## Problemas encontrados y corregidos

- Zona horaria IANA inexistente que provocaba una excepción al mostrar anomalías: sustituida por `America/Argentina/Salta`.
- Proxy Vite que alteraba Host y causaba rechazo de inicio de sesión: configurado para conservarlo.
- Tabla que generaba desbordamiento horizontal en móvil: contenida y adaptada a filas con acciones visibles.
- Fuentes externas incompatibles con la política de contenido de producción: reemplazadas por fuentes locales.
- URLs de cámara no textuales que podían guardarse en estado desconectado: validadas explícitamente.
- Ingestión de parámetros y recuperación de contraseña implementadas pero sin verificar al interrumpirse: completadas y cubiertas por pruebas.
- Ausencia de ingreso de anomalías reales: agregada una ruta autenticada con validación de cámara, imagen, fecha y prioridad.
- Descarga innecesaria del reproductor HLS en vistas de imágenes: convertida en carga bajo demanda.

## Límites comprobados

La red de este entorno rechazó la cartografía remota de CARTO; el mapa local funciona. Se guardaron en el borrador del entorno los dominios necesarios, junto con instalación y arranque, pero guardar el borrador no activa la red ni publica una versión.

La compilación advierte que el módulo completo de HLS supera 500 KiB minificado (aproximadamente 186 KiB comprimido). Se carga únicamente al abrir una fuente HLS; no es un fallo de compilación.

No se recibieron direcciones, permisos o protocolos de instalaciones reales. Las imágenes, mediciones y anomalías iniciales son demostrativas. Quedan por configurar y validar las fuentes de campo, el almacenamiento privado de evidencia y el despliegue HTTPS. No se ejecutó un despliegue público, un pentest externo, ni una certificación industrial. La detección automática de anomalías no forma parte de esta implementación.

Las capturas de la auditoría se guardan en `.local/audit`, y los informes de navegador en `playwright-report`. La ejecución de pruebas no borra ni reutiliza la base SQLite de desarrollo.
